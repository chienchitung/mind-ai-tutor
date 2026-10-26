'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RECORDING_BUCKET, RECORDING_HEARTBEAT_MS, SEGMENT_SAMPLE_RATE, SEGMENT_SECONDS, segmentPath, type SlideMark } from '@/lib/live-recording';
import { concatSamples, downsample, encodeWav } from '@/lib/wav';
import { floatToInt16, mediaExtension, openRecordingVault, vaultLockName, type RecordingVault, type VaultMeta } from '@/lib/recording-vault';

export type RecorderPhase = 'idle' | 'starting' | 'recording' | 'stopping' | 'stopped';
export type LiveSegment = {
  idx: number;
  startSeconds: number;
  durationSeconds: number;
  status: 'uploading' | 'transcribing' | 'transcribed' | 'failed';
  uploaded: boolean;
  error?: string;
};
export type RecorderError =
  | 'MIC_UNSUPPORTED' | 'MIC_DENIED' | 'SCREEN_DENIED' | 'RECORDINGS_NOT_READY' | 'START_FAILED';

const DOWNLOAD_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
const VIDEO_MIME_TYPES = ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm', 'video/mp4'];
const COOLDOWN_RETRY_MS = 4_000;
// How often the unsent tail is copied to the browser's vault: at most this
// much is lost if the tab dies.
const VAULT_FLUSH_MS = 5_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pickMime(candidates: string[]): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return candidates.find((type) => MediaRecorder.isTypeSupported?.(type));
}

/** Whether this browser can offer to record the screen along with the voice. */
export function canRecordScreen(): boolean {
  return typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getDisplayMedia && !!pickMime(VIDEO_MIME_TYPES);
}

// Records the teacher's microphone in two forms at once:
// - 16 kHz mono PCM, cut into SEGMENT_SECONDS WAV segments that are uploaded
//   and transcribed one after another while the lesson is still going, so
//   only the notes step is left when the lesson ends;
// - a compressed MediaRecorder copy of the whole lesson, kept in memory for
//   the teacher to download afterwards (it never leaves the browser). With
//   `video`, that copy is a screen recording with the voice on it; only the
//   16 kHz audio segments are ever uploaded.
export type RecorderTarget = { sessionId: string; title: string; language: 'zh-TW' | 'en'; currentPage?: number; video?: boolean };

// One recorder for the whole app (see LectureJobsProvider), so a lesson keeps
// recording and transcribing while the teacher moves to other pages; which
// session it records is given to start().
export function useLectureRecorder() {
  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [target, setTarget] = useState<Omit<RecorderTarget, 'currentPage'> | null>(null);
  const targetRef = useRef<Omit<RecorderTarget, 'currentPage'> | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [recordingId, setRecordingId] = useState<string | null>(null);
  const [segments, setSegments] = useState<LiveSegment[]>([]);
  const [download, setDownload] = useState<{ url: string; fileName: string } | null>(null);
  const [error, setError] = useState<RecorderError | null>(null);
  // The download copy includes the screen; screenEnded once the teacher
  // stopped sharing mid-lesson (the voice keeps recording).
  const [hasVideo, setHasVideo] = useState(false);
  const [screenEnded, setScreenEnded] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const screenRef = useRef<MediaStream | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const pcmRef = useRef<Float32Array[]>([]);
  const rateRef = useRef(SEGMENT_SAMPLE_RATE);
  const totalSamplesRef = useRef(0);
  const segmentStartRef = useRef(0);
  const nextIdxRef = useRef(0);
  const blobsRef = useRef(new Map<number, Blob>());
  const queueRef = useRef<Promise<void>>(Promise.resolve());
  const marksRef = useRef<SlideMark[]>([]);
  const idsRef = useRef<{ recordingId: string; userId: string } | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const heartbeatRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // The crash copy (see lib/recording-vault.ts). Writes run one at a time so
  // a tail flush and the segment cut that supersedes it land in order.
  const vaultRef = useRef<RecordingVault | null>(null);
  const vaultQueueRef = useRef<Promise<void>>(Promise.resolve());
  const vaultMetaRef = useRef<VaultMeta | null>(null);
  const unflushedRef = useRef<Float32Array[]>([]);
  const vaultTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const releaseLockRef = useRef<(() => void) | null>(null);

  const segmentsRef = useRef<LiveSegment[]>([]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

  const persist = (write: (vault: RecordingVault) => Promise<void>) => {
    const vault = vaultRef.current;
    if (!vault) return;
    vaultQueueRef.current = vaultQueueRef.current.then(() => write(vault)).catch(() => undefined);
  };
  const persistMeta = (patch: Partial<VaultMeta>) => {
    const meta = vaultMetaRef.current;
    if (!meta) return;
    const next = { ...meta, ...patch, marks: [...marksRef.current] };
    vaultMetaRef.current = next;
    persist((vault) => vault.putMeta(next));
  };
  const flushTail = () => {
    const meta = vaultMetaRef.current;
    if (!meta || !unflushedRef.current.length) return;
    const samples = downsample(concatSamples(unflushedRef.current), rateRef.current, SEGMENT_SAMPLE_RATE);
    unflushedRef.current = [];
    persist((vault) => vault.appendTail(meta.recordingId, floatToInt16(samples)));
    persistMeta({ elapsedSeconds: Math.round(totalSamplesRef.current / rateRef.current), heartbeatAt: Date.now() });
  };

  const patchSegment = (idx: number, patch: Partial<LiveSegment>) =>
    setSegments((previous) => previous.map((segment) => (segment.idx === idx ? { ...segment, ...patch } : segment)));

  const seconds = () => totalSamplesRef.current / rateRef.current;

  const saveProgress = useCallback((extra: Record<string, unknown> = {}) => {
    const ids = idsRef.current;
    if (!ids) return Promise.resolve();
    return fetch(`/api/live-recordings/${ids.recordingId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ durationSeconds: Math.round(seconds()), slideMarks: marksRef.current, ...extra }),
    }).then(() => undefined, () => undefined);
  }, []);

  const runSegment = useCallback(async (segment: LiveSegment) => {
    const ids = idsRef.current;
    if (!ids) return;
    const blob = blobsRef.current.get(segment.idx);
    if (!segment.uploaded && blob) {
      patchSegment(segment.idx, { status: 'uploading', error: undefined });
      const { error: uploadError } = await supabase().storage.from(RECORDING_BUCKET)
        .upload(segmentPath(ids.userId, ids.recordingId, segment.idx), blob, { contentType: 'audio/wav', upsert: true })
        .catch(() => ({ error: new Error('UPLOAD') }));
      if (uploadError) {
        patchSegment(segment.idx, { status: 'failed', error: 'UPLOAD' });
        return;
      }
      segment = { ...segment, uploaded: true };
      patchSegment(segment.idx, { uploaded: true });
    }
    patchSegment(segment.idx, { status: 'transcribing', error: undefined });
    for (let attempt = 0; attempt < 4; attempt++) {
      const response = await fetch(`/api/live-recordings/${ids.recordingId}/segments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idx: segment.idx, startSeconds: segment.startSeconds, durationSeconds: segment.durationSeconds, language: targetRef.current?.language ?? 'zh-TW' }),
      }).catch(() => null);
      const body = response ? await response.json().catch(() => ({})) : {};
      if (response?.ok) {
        blobsRef.current.delete(segment.idx);
        patchSegment(segment.idx, { status: 'transcribed' });
        // Only now is the local copy redundant: until the text is saved, the
        // vault is the one record of this segment that survives a crash.
        const doneIdx = segment.idx;
        persist((vault) => vault.deleteSegment(ids.recordingId, doneIdx));
        return;
      }
      // The AI quota allows one request every 3s; segments rarely collide,
      // but a retry burst or the notes request can.
      if (response?.status === 429 && body.error === 'COOLDOWN') {
        await sleep(COOLDOWN_RETRY_MS);
        continue;
      }
      patchSegment(segment.idx, { status: 'failed', error: body.error ?? 'NETWORK' });
      return;
    }
    patchSegment(segment.idx, { status: 'failed', error: 'COOLDOWN' });
  }, []);

  const enqueue = useCallback((segment: LiveSegment) => {
    queueRef.current = queueRef.current.then(() => runSegment(segment)).catch(() => undefined);
    return queueRef.current;
  }, [runSegment]);

  const cutSegment = useCallback(() => {
    const samples = concatSamples(pcmRef.current);
    pcmRef.current = [];
    const rate = rateRef.current;
    const startSeconds = Math.round(segmentStartRef.current / rate);
    segmentStartRef.current = totalSamplesRef.current;
    const durationSeconds = Math.round(samples.length / rate);
    if (durationSeconds < 1) return;
    const idx = nextIdxRef.current++;
    const blob = encodeWav(downsample(samples, rate, SEGMENT_SAMPLE_RATE), SEGMENT_SAMPLE_RATE);
    blobsRef.current.set(idx, blob);
    const segment: LiveSegment = { idx, startSeconds, durationSeconds, status: 'uploading', uploaded: false };
    // The tail so far is now this segment: keep the segment until it is
    // uploaded, and start a fresh tail.
    unflushedRef.current = [];
    const recordingId = idsRef.current?.recordingId;
    if (recordingId) {
      persist((vault) => vault.putSegment(recordingId, { idx, startSeconds, durationSeconds, blob }));
      persist((vault) => vault.clearTail(recordingId));
      persistMeta({ tailStartSeconds: Math.round(segmentStartRef.current / rate), nextIdx: idx + 1, elapsedSeconds: Math.round(totalSamplesRef.current / rate) });
    }
    setSegments((previous) => [...previous, segment]);
    void enqueue(segment);
    void saveProgress();
  }, [enqueue, saveProgress]);

  const teardownAudio = () => {
    processorRef.current?.disconnect();
    processorRef.current = null;
    void contextRef.current?.close().catch(() => undefined);
    contextRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    screenRef.current?.getTracks().forEach((track) => track.stop());
    screenRef.current = null;
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
    if (vaultTimerRef.current) clearInterval(vaultTimerRef.current);
    vaultTimerRef.current = null;
  };

  const start = useCallback(async ({ currentPage, ...next }: RecorderTarget) => {
    if (phase === 'starting' || phase === 'recording' || phase === 'stopping') return;
    // A finished recording still transcribing its tail stays on screen.
    if (phase === 'stopped' && segmentsRef.current.some((segment) => segment.status === 'uploading' || segment.status === 'transcribing')) return;
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia || (typeof AudioContext === 'undefined')) {
      setError('MIC_UNSUPPORTED');
      return;
    }
    setPhase('starting');
    // Asked first, while the click still counts as the user's: browsers only
    // show the screen picker in direct response to one.
    let screen: MediaStream | null = null;
    if (next.video && canRecordScreen()) {
      try {
        screen = await navigator.mediaDevices.getDisplayMedia({
          video: { frameRate: { ideal: 15, max: 15 }, width: { max: 1920 }, height: { max: 1080 } },
          audio: false,
        });
      } catch {
        setError('SCREEN_DENIED');
        setPhase('idle');
        return;
      }
    }
    vaultRef.current = await openRecordingVault();
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
      screen?.getTracks().forEach((track) => track.stop());
      setError('MIC_DENIED');
      setPhase('idle');
      return;
    }
    try {
      const response = await fetch('/api/live-recordings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: next.sessionId, title: next.title }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(body.error === 'RECORDINGS_NOT_READY' ? 'RECORDINGS_NOT_READY' : 'START_FAILED');
      idsRef.current = { recordingId: body.id, userId: body.userId };
      targetRef.current = next;
      setTarget(next);
      setRecordingId(body.id);

      let context: AudioContext;
      try {
        // Asking for 16 kHz lets the browser resample natively; some
        // browsers refuse a custom rate, in which case we downsample ourselves.
        context = new AudioContext({ sampleRate: SEGMENT_SAMPLE_RATE });
      } catch {
        context = new AudioContext();
      }
      rateRef.current = context.sampleRate;
      const source = context.createMediaStreamSource(stream);
      const processor = context.createScriptProcessor(4096, 1, 1);
      const mute = context.createGain();
      mute.gain.value = 0;
      processor.onaudioprocess = (event) => {
        const input = event.inputBuffer.getChannelData(0);
        const copy = new Float32Array(input);
        pcmRef.current.push(copy);
        unflushedRef.current.push(copy);
        totalSamplesRef.current += input.length;
        if (totalSamplesRef.current - segmentStartRef.current >= SEGMENT_SECONDS * rateRef.current) cutSegment();
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);

      const videoMime = screen ? pickMime(VIDEO_MIME_TYPES) : undefined;
      const mimeType = videoMime ?? pickMime(DOWNLOAD_MIME_TYPES);
      if (screen && !videoMime) {
        screen.getTracks().forEach((track) => track.stop());
        screen = null;
      }
      mediaChunksRef.current = [];
      if (mimeType) {
        // Slides change slowly, so 15 fps at ~0.8 Mbps stays sharp at about
        // 6 MB a minute; the chunks live in the browser (and its vault) only.
        const recorder = screen
          ? new MediaRecorder(new MediaStream([...screen.getVideoTracks(), ...stream.getAudioTracks()]), { mimeType, videoBitsPerSecond: 800_000, audioBitsPerSecond: 32_000 })
          : new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
        recorder.ondataavailable = (event) => {
          if (!event.data.size) return;
          mediaChunksRef.current.push(event.data);
          const recordingId = idsRef.current?.recordingId;
          if (recordingId) persist((vault) => vault.appendMedia(recordingId, event.data));
        };
        recorder.start(10_000);
        mediaRecorderRef.current = recorder;
      }

      streamRef.current = stream;
      screenRef.current = screen;
      setHasVideo(!!screen && !!mimeType);
      setScreenEnded(false);
      // Stopping the share from the browser's bar ends only the picture.
      screen?.getVideoTracks()[0]?.addEventListener('ended', () => setScreenEnded(true));
      if (screen) void navigator.storage?.persist?.().catch(() => false);
      contextRef.current = context;
      processorRef.current = processor;
      pcmRef.current = [];
      totalSamplesRef.current = 0;
      segmentStartRef.current = 0;
      nextIdxRef.current = 0;
      blobsRef.current.clear();
      marksRef.current = currentPage ? [{ t: 0, page: currentPage }] : [];
      setSegments([]);
      setElapsed(0);
      setDownload((previous) => { if (previous) URL.revokeObjectURL(previous.url); return null; });
      unflushedRef.current = [];
      vaultMetaRef.current = {
        recordingId: body.id, userId: body.userId, sessionId: next.sessionId, title: next.title, language: next.language,
        startedAt: Date.now(), tailStartSeconds: 0, nextIdx: 0, elapsedSeconds: 0, marks: [...marksRef.current], finished: false,
        hasVideo: !!screen && !!mimeType,
      };
      persistMeta({ heartbeatAt: Date.now() });
      // Held until this tab is done with the recording (reset or a new one);
      // the browser releases it if the tab dies, which is what recovery checks.
      releaseLockRef.current?.();
      releaseLockRef.current = null;
      if (typeof navigator !== 'undefined' && navigator.locks?.request) {
        void navigator.locks.request(vaultLockName(body.id), () => new Promise<void>((resolve) => { releaseLockRef.current = resolve; }))
          .catch(() => undefined);
      }
      vaultTimerRef.current = setInterval(flushTail, VAULT_FLUSH_MS);
      timerRef.current = setInterval(() => setElapsed(Math.floor(seconds())), 1_000);
      // Keeps the students' "recording" notice alive; a closed or crashed tab
      // stops sending this, and the notice lapses on its own.
      heartbeatRef.current = setInterval(() => void saveProgress(), RECORDING_HEARTBEAT_MS);
      setPhase('recording');
    } catch (cause) {
      stream.getTracks().forEach((track) => track.stop());
      screen?.getTracks().forEach((track) => track.stop());
      setError(cause instanceof Error && cause.message === 'RECORDINGS_NOT_READY' ? 'RECORDINGS_NOT_READY' : 'START_FAILED');
      setPhase('idle');
    }
  }, [phase, cutSegment, saveProgress]);

  const stop = useCallback(async () => {
    if (phase !== 'recording') return;
    setPhase('stopping');
    processorRef.current?.disconnect();
    cutSegment();
    const recorder = mediaRecorderRef.current;
    mediaRecorderRef.current = null;
    if (recorder && recorder.state !== 'inactive') {
      await new Promise<void>((resolve) => { recorder.onstop = () => resolve(); recorder.stop(); });
    }
    teardownAudio();
    if (mediaChunksRef.current.length) {
      const type = mediaChunksRef.current[0].type || (hasVideo ? 'video/webm' : 'audio/webm');
      const extension = mediaExtension(type);
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      setDownload({ url: URL.createObjectURL(new Blob(mediaChunksRef.current, { type })), fileName: `${targetRef.current?.title ?? 'lecture'}-${stamp}.${extension}` });
      mediaChunksRef.current = [];
    }
    setElapsed(Math.floor(seconds()));
    await saveProgress({ status: 'stopped' });
    // Stopped normally: only the download copy (and any segment still
    // uploading) is left in the vault.
    persistMeta({ finished: true, elapsedSeconds: Math.round(seconds()) });
    setPhase('stopped');
  }, [phase, cutSegment, saveProgress, hasVideo]);

  const markSlide = useCallback((page: number) => {
    if (phase !== 'recording') return;
    const marks = marksRef.current;
    if (marks.at(-1)?.page === page) return;
    marks.push({ t: Math.round(seconds() * 10) / 10, page });
  }, [phase]);

  // The teacher saved the download copy: a later visit need not offer it.
  const markDownloaded = useCallback(() => persistMeta({ downloaded: true }), []);

  const retry = useCallback((idx: number) => {
    const segment = segments.find((item) => item.idx === idx);
    if (segment && segment.status === 'failed') void enqueue(segment);
  }, [segments, enqueue]);

  const reset = useCallback(() => {
    if (phase !== 'stopped') return;
    setDownload((previous) => { if (previous) URL.revokeObjectURL(previous.url); return null; });
    const finishedId = idsRef.current?.recordingId;
    if (finishedId) persist((vault) => vault.remove(finishedId));
    vaultMetaRef.current = null;
    releaseLockRef.current?.();
    releaseLockRef.current = null;
    idsRef.current = null;
    targetRef.current = null;
    setTarget(null);
    setRecordingId(null);
    setSegments([]);
    setElapsed(0);
    setHasVideo(false);
    setScreenEnded(false);
    setPhase('idle');
  }, [phase]);

  // Leaving mid-lesson would drop the unsent tail and the download copy.
  useEffect(() => {
    if (phase !== 'recording' && !segments.some((segment) => segment.status === 'uploading' || segment.status === 'transcribing')) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase, segments]);

  useEffect(() => () => {
    mediaRecorderRef.current?.stop();
    teardownAudio();
  }, []);

  return { phase, target, elapsed, recordingId, segments, download, error, hasVideo, screenEnded, start, stop, markSlide, retry, reset, markDownloaded };
}
