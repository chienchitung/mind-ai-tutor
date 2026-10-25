'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { RECORDING_BUCKET, RECORDING_HEARTBEAT_MS, SEGMENT_SAMPLE_RATE, SEGMENT_SECONDS, segmentPath, type SlideMark } from '@/lib/live-recording';
import { concatSamples, downsample, encodeWav } from '@/lib/wav';

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
  | 'MIC_UNSUPPORTED' | 'MIC_DENIED' | 'RECORDINGS_NOT_READY' | 'START_FAILED';

const DOWNLOAD_MIME_TYPES = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'];
const COOLDOWN_RETRY_MS = 4_000;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function pickDownloadMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  return DOWNLOAD_MIME_TYPES.find((type) => MediaRecorder.isTypeSupported?.(type));
}

// Records the teacher's microphone in two forms at once:
// - 16 kHz mono PCM, cut into SEGMENT_SECONDS WAV segments that are uploaded
//   and transcribed one after another while the lesson is still going, so
//   only the notes step is left when the lesson ends;
// - a compressed MediaRecorder copy of the whole lesson, kept in memory for
//   the teacher to download afterwards (it never leaves the browser).
export type RecorderTarget = { sessionId: string; title: string; language: 'zh-TW' | 'en'; currentPage?: number };

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

  const streamRef = useRef<MediaStream | null>(null);
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

  const segmentsRef = useRef<LiveSegment[]>([]);
  useEffect(() => { segmentsRef.current = segments; }, [segments]);

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
    blobsRef.current.set(idx, encodeWav(downsample(samples, rate, SEGMENT_SAMPLE_RATE), SEGMENT_SAMPLE_RATE));
    const segment: LiveSegment = { idx, startSeconds, durationSeconds, status: 'uploading', uploaded: false };
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
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = null;
    if (heartbeatRef.current) clearInterval(heartbeatRef.current);
    heartbeatRef.current = null;
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
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, channelCount: 1 } });
    } catch {
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
        pcmRef.current.push(new Float32Array(input));
        totalSamplesRef.current += input.length;
        if (totalSamplesRef.current - segmentStartRef.current >= SEGMENT_SECONDS * rateRef.current) cutSegment();
      };
      source.connect(processor);
      processor.connect(mute);
      mute.connect(context.destination);

      const mimeType = pickDownloadMime();
      mediaChunksRef.current = [];
      if (mimeType) {
        const recorder = new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32_000 });
        recorder.ondataavailable = (event) => { if (event.data.size) mediaChunksRef.current.push(event.data); };
        recorder.start(10_000);
        mediaRecorderRef.current = recorder;
      }

      streamRef.current = stream;
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
      timerRef.current = setInterval(() => setElapsed(Math.floor(seconds())), 1_000);
      // Keeps the students' "recording" notice alive; a closed or crashed tab
      // stops sending this, and the notice lapses on its own.
      heartbeatRef.current = setInterval(() => void saveProgress(), RECORDING_HEARTBEAT_MS);
      setPhase('recording');
    } catch (cause) {
      stream.getTracks().forEach((track) => track.stop());
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
      const type = mediaChunksRef.current[0].type || 'audio/webm';
      const extension = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
      const stamp = new Date().toISOString().slice(0, 16).replace(/[:T]/g, '-');
      setDownload({ url: URL.createObjectURL(new Blob(mediaChunksRef.current, { type })), fileName: `${targetRef.current?.title ?? 'lecture'}-${stamp}.${extension}` });
      mediaChunksRef.current = [];
    }
    setElapsed(Math.floor(seconds()));
    await saveProgress({ status: 'stopped' });
    setPhase('stopped');
  }, [phase, cutSegment, saveProgress]);

  const markSlide = useCallback((page: number) => {
    if (phase !== 'recording') return;
    const marks = marksRef.current;
    if (marks.at(-1)?.page === page) return;
    marks.push({ t: Math.round(seconds() * 10) / 10, page });
  }, [phase]);

  const retry = useCallback((idx: number) => {
    const segment = segments.find((item) => item.idx === idx);
    if (segment && segment.status === 'failed') void enqueue(segment);
  }, [segments, enqueue]);

  const reset = useCallback(() => {
    if (phase !== 'stopped') return;
    setDownload((previous) => { if (previous) URL.revokeObjectURL(previous.url); return null; });
    idsRef.current = null;
    targetRef.current = null;
    setTarget(null);
    setRecordingId(null);
    setSegments([]);
    setElapsed(0);
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

  return { phase, target, elapsed, recordingId, segments, download, error, start, stop, markSlide, retry, reset };
}
