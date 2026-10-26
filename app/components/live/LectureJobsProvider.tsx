'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Check, ChevronDown, Download, FileText, Loader2, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, RECORDING_BUCKET, segmentPath, type LessonNotes, type RecordingSummary } from '@/lib/live-recording';
import { isRecordingOwnedElsewhere, mediaExtension, openRecordingVault, type VaultMeta } from '@/lib/recording-vault';
import { recoverRecording } from '@/lib/recording-recovery';
import { supabase } from '@/lib/supabase';
import { extractDeckText } from '@/lib/deck-text';
import { useLectureRecorder } from './useLectureRecorder';
import { LectureNotesDialog } from './LectureNotesDialog';

export type LectureJob = {
  recordingId: string;
  kind: 'notes' | 'retry';
  label: string;
  sessionId: string | null;
  status: 'running' | 'done' | 'error';
  error?: string;
  startedAt: number;
  /** Where the job was started; it opens its result itself only there. */
  startedOn: string;
};

/** A recording left in this browser's vault by an earlier visit. */
export type Leftover = {
  meta: VaultMeta;
  /** Recorded but never sent for transcription (crash), in seconds. */
  unsentSeconds: number;
  hasAudio: boolean;
  /** The tab died mid-lesson; otherwise only the download copy is left. */
  interrupted: boolean;
  status: 'idle' | 'recovering' | 'error';
};

const LEFTOVER_KEEP_MS = 7 * 24 * 60 * 60 * 1000;

type LectureJobs = {
  recorder: ReturnType<typeof useLectureRecorder>;
  jobs: Record<string, LectureJob>;
  /** Bumped whenever a job finishes, so recording lists know to reload. */
  version: number;
  generateNotes: (item: RecordingSummary) => void;
  retryFailed: (item: RecordingSummary) => void;
  dismiss: (recordingId: string) => void;
  openNotes: (recordingId: string) => void;
  leftovers: Leftover[];
  recoverLeftover: (recordingId: string) => void;
  downloadLeftover: (recordingId: string) => void;
  discardLeftover: (recordingId: string) => void;
};

const LectureJobsContext = createContext<LectureJobs | null>(null);
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function useLectureJobs() {
  const value = useContext(LectureJobsContext);
  if (!value) throw new Error('useLectureJobs must be used inside LectureJobsProvider');
  return value;
}

// Lecture recording, its transcription and note writing run here, above the
// pages, so the teacher can start them and keep working elsewhere in the
// app. A pill in the corner shows what is still running and opens the
// result when it is done (like mind-map-note's voice-note pill).
export function LectureJobsProvider({ children }: { children: ReactNode }) {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const pathname = usePathname() ?? '';
  const pathnameRef = useRef(pathname);
  useEffect(() => { pathnameRef.current = pathname; }, [pathname]);
  const recorder = useLectureRecorder();
  const [jobs, setJobs] = useState<Record<string, LectureJob>>({});
  const jobsRef = useRef(jobs);
  useEffect(() => { jobsRef.current = jobs; }, [jobs]);
  const [version, setVersion] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);
  const [leftovers, setLeftovers] = useState<Leftover[]>([]);

  // What an earlier visit left in this browser (see lib/recording-vault.ts),
  // for whoever is signed in now. Checked once per signed-in teacher.
  const checkedFor = useRef<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const vault = await openRecordingVault();
      if (!vault) return;
      const { data } = await supabase().auth.getUser().catch(() => ({ data: { user: null } }));
      const userId = data.user?.id;
      if (!userId || checkedFor.current === userId) return;
      const found: Leftover[] = [];
      for (const meta of await vault.listMeta()) {
        if (meta.userId !== userId) continue;
        // Still being recorded (or finished) by another open tab.
        if (await isRecordingOwnedElsewhere(meta)) continue;
        const [segments, tail, media] = await Promise.all([
          vault.listSegments(meta.recordingId), vault.readTail(meta.recordingId), vault.readMedia(meta.recordingId),
        ]);
        const interrupted = !meta.finished || segments.length > 0;
        if (!interrupted && (!media.length || Date.now() - meta.startedAt > LEFTOVER_KEEP_MS)) {
          await vault.remove(meta.recordingId);
          continue;
        }
        const unsentSeconds = Math.round(tail.length / 16_000 + segments.reduce((sum, segment) => sum + segment.durationSeconds, 0));
        found.push({ meta, unsentSeconds, hasAudio: media.length > 0, interrupted, status: 'idle' });
      }
      // Marked only once applied: a run cancelled midway (a remount) must not
      // stop the next one from showing what it found.
      if (cancelled) return;
      checkedFor.current = userId;
      setLeftovers(found.sort((a, b) => b.meta.startedAt - a.meta.startedAt));
    })().catch(() => undefined);
    return () => { cancelled = true; };
  }, [pathname]);

  const patchLeftover = (recordingId: string, patch: Partial<Leftover> | null) =>
    setLeftovers((previous) => (patch === null
      ? previous.filter((item) => item.meta.recordingId !== recordingId)
      : previous.map((item) => (item.meta.recordingId === recordingId ? { ...item, ...patch } : item))));

  const recoverLeftover = useCallback((recordingId: string) => {
    const leftover = leftovers.find((item) => item.meta.recordingId === recordingId);
    if (!leftover || leftover.status === 'recovering') return;
    patchLeftover(recordingId, { status: 'recovering' });
    void (async () => {
      const vault = await openRecordingVault();
      if (!vault) { patchLeftover(recordingId, { status: 'error' }); return; }
      // Checked again right before: another tab may have picked it up since.
      if (await isRecordingOwnedElsewhere(leftover.meta)) { patchLeftover(recordingId, null); return; }
      const result = await recoverRecording(vault, leftover.meta, {
        transcribed: async (meta) => {
          const response = await fetch(`/api/live-recordings/${meta.recordingId}`, { cache: 'no-store' });
          const body = response.ok ? await response.json() : {};
          return new Set<number>((body.segments ?? [])
            .filter((segment: { status: string }) => segment.status === 'transcribed')
            .map((segment: { idx: number }) => segment.idx));
        },
        upload: async (meta, segment) => {
          const { error } = await supabase().storage.from(RECORDING_BUCKET)
            .upload(segmentPath(meta.userId, meta.recordingId, segment.idx), segment.blob, { contentType: 'audio/wav', upsert: true });
          return !error;
        },
        transcribe: async (meta, segment) => {
          for (let attempt = 0; attempt < 4; attempt++) {
            const response = await fetch(`/api/live-recordings/${meta.recordingId}/segments`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ idx: segment.idx, startSeconds: segment.startSeconds, durationSeconds: segment.durationSeconds, language: meta.language }),
            });
            if (response.ok) return true;
            const body = await response.json().catch(() => ({}));
            if (response.status === 429 && body.error === 'COOLDOWN') { await sleep(4_000); continue; }
            return false;
          }
          return false;
        },
        finalize: async (meta, body) => (await fetch(`/api/live-recordings/${meta.recordingId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        })).ok,
      }).catch(() => null);
      setVersion((value) => value + 1);
      if (!result || result.failed > 0 || !result.finalized) { patchLeftover(recordingId, { status: 'error' }); return; }
      // Transcribed and closed; what is left is the download copy, if any.
      if (leftover.hasAudio) patchLeftover(recordingId, { status: 'idle', interrupted: false, unsentSeconds: 0 });
      else { await vault.remove(recordingId); patchLeftover(recordingId, null); }
    })();
  }, [leftovers]);

  const downloadLeftover = useCallback((recordingId: string) => {
    const leftover = leftovers.find((item) => item.meta.recordingId === recordingId);
    if (!leftover) return;
    void (async () => {
      const media = await (await openRecordingVault())?.readMedia(recordingId);
      if (!media?.length) return;
      const type = media[0].type || (leftover.meta.hasVideo ? 'video/webm' : 'audio/webm');
      const extension = mediaExtension(type);
      const url = URL.createObjectURL(new Blob(media, { type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `${leftover.meta.title.replace(/[\\/:*?"<>|]/g, '_')}-${new Date(leftover.meta.startedAt).toISOString().slice(0, 10)}.${extension}`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    })();
  }, [leftovers]);

  const discardLeftover = useCallback((recordingId: string) => {
    void (async () => {
      await (await openRecordingVault())?.remove(recordingId);
      patchLeftover(recordingId, null);
    })();
  }, []);
  const [freshNotes, setFreshNotes] = useState<{ id: string; notes: LessonNotes } | null>(null);

  const finish = useCallback((recordingId: string, patch: Partial<LectureJob>) => {
    setJobs((previous) => previous[recordingId] ? { ...previous, [recordingId]: { ...previous[recordingId], ...patch } } : previous);
    setVersion((value) => value + 1);
  }, []);

  const begin = (item: RecordingSummary, kind: LectureJob['kind']) => {
    if (Object.values(jobsRef.current).some((job) => job.status === 'running')) return false;
    const job: LectureJob = {
      recordingId: item.id, kind, label: item.sessionTitle ?? item.title, sessionId: item.sessionId,
      status: 'running', startedAt: Date.now(), startedOn: pathnameRef.current,
    };
    jobsRef.current = { ...jobsRef.current, [item.id]: job };
    setJobs(jobsRef.current);
    return true;
  };

  const generateNotes = useCallback((item: RecordingSummary) => {
    if (!begin(item, 'notes')) return;
    void (async () => {
      try {
        const slides = item.deckUrl ? await extractDeckText(item.deckUrl).catch(() => []) : [];
        for (let attempt = 0; attempt < 3; attempt++) {
          const response = await fetch(`/api/live-recordings/${item.id}/notes`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ language: zh ? 'zh-TW' : 'en', slides }),
          });
          const body = await response.json().catch(() => ({}));
          if (response.status === 429 && body.error === 'COOLDOWN') { await sleep(4_000); continue; }
          if (!response.ok) { finish(item.id, { status: 'error', error: body.error ?? 'AI_FAILED' }); return; }
          setFreshNotes({ id: item.id, notes: body.notes });
          const stayed = jobsRef.current[item.id]?.startedOn === pathnameRef.current;
          finish(item.id, { status: 'done' });
          // Still where it was started: show the notes. Elsewhere, the pill
          // says they are ready instead of covering what the teacher is doing.
          if (stayed) {
            setOpenId(item.id);
            setJobs((previous) => { const { [item.id]: _, ...rest } = previous; return rest; });
          }
          return;
        }
        finish(item.id, { status: 'error', error: 'COOLDOWN' });
      } catch {
        finish(item.id, { status: 'error', error: 'AI_FAILED' });
      }
    })();
  }, [zh, finish]);

  // Failed segments keep their audio in Storage, so they can be retried
  // later even after the page that recorded them was closed.
  const retryFailed = useCallback((item: RecordingSummary) => {
    if (!begin(item, 'retry')) return;
    void (async () => {
      try {
        const detail = await fetch(`/api/live-recordings/${item.id}`, { cache: 'no-store' }).then((response) => response.json());
        const failed = (detail.segments ?? []).filter((segment: { status: string }) => segment.status === 'failed');
        for (const [index, segment] of failed.entries()) {
          if (index > 0) await sleep(3_500);
          const response = await fetch(`/api/live-recordings/${item.id}/segments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idx: segment.idx, startSeconds: segment.startSeconds, durationSeconds: segment.durationSeconds, language: zh ? 'zh-TW' : 'en' }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            finish(item.id, { status: 'error', error: body.error ?? 'AI_FAILED' });
            return;
          }
        }
        finish(item.id, { status: 'done' });
      } catch {
        finish(item.id, { status: 'error', error: 'AI_FAILED' });
      }
    })();
  }, [zh, finish]);

  const dismiss = useCallback((recordingId: string) => {
    setJobs((previous) => {
      if (previous[recordingId]?.status === 'running') return previous;
      const { [recordingId]: _, ...rest } = previous;
      return rest;
    });
  }, []);

  const openNotes = useCallback((recordingId: string) => {
    setOpenId(recordingId);
    dismiss(recordingId);
  }, [dismiss]);

  // Closing the tab drops whatever is still running.
  const busy = Object.values(jobs).some((job) => job.status === 'running');
  useEffect(() => {
    if (!busy) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  const value = useMemo(
    () => ({ recorder, jobs, version, generateNotes, retryFailed, dismiss, openNotes, leftovers, recoverLeftover, downloadLeftover, discardLeftover }),
    [recorder, jobs, version, generateNotes, retryFailed, dismiss, openNotes, leftovers, recoverLeftover, downloadLeftover, discardLeftover],
  );

  return (
    <LectureJobsContext.Provider value={value}>
      {children}
      <LectureJobsPill />
      <LectureNotesDialog
        recordingId={openId}
        initialNotes={freshNotes && freshNotes.id === openId ? freshNotes.notes : null}
        onClose={() => { setOpenId(null); setFreshNotes(null); }}
      />
    </LectureJobsContext.Provider>
  );
}

export function lectureJobError(code: string | undefined, zh: boolean) {
  switch (code) {
    case 'INSUFFICIENT_POINTS': return zh ? 'AI 點數不足。' : 'Not enough AI points.';
    case 'DAILY_LIMIT': return zh ? '今天的 AI 使用次數已達上限。' : 'Daily AI limit reached.';
    case 'NO_TRANSCRIPT': return zh ? '還沒有完成轉錄的段落，請稍候或重試失敗的段落。' : 'Nothing has been transcribed yet. Wait or retry the failed segments.';
    case 'TRANSCRIPT_TOO_SHORT': return zh ? '錄到的講解太短，無法整理成筆記（需要至少約半分鐘的講解內容）。沒有扣點數。' : 'The recorded speech is too short to make notes from (about half a minute is needed). No points were used.';
    case 'SEGMENT_NOT_UPLOADED': return zh ? '部分段落的音訊沒有上傳成功，無法重新轉錄。' : 'Some segment audio never finished uploading and cannot be transcribed.';
    default: return zh ? 'AI 產生失敗，請再試一次。' : 'AI generation failed. Please try again.';
  }
}

function useNow(active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => setNow(Date.now()), 1_000);
    return () => clearInterval(timer);
  }, [active]);
  return now;
}

// The corner pill: one line for what matters most right now, and a list of
// everything (recording, transcription, notes) when opened.
function LectureJobsPill() {
  const { recorder, jobs, dismiss, openNotes, leftovers: allLeftovers, recoverLeftover, downloadLeftover, discardLeftover } = useLectureJobs();
  const leftovers = allLeftovers.filter((item) => item.meta.recordingId !== recorder.recordingId);
  const [confirmDiscard, setConfirmDiscard] = useState<string | null>(null);
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  const pathname = usePathname() ?? '';
  const [open, setOpen] = useState(false);

  const transcribing = recorder.segments.filter((segment) => segment.status === 'uploading' || segment.status === 'transcribing').length;
  const recordingNow = recorder.phase === 'recording' || recorder.phase === 'stopping';
  const workspacePath = recorder.target ? `/live/${recorder.target.sessionId}/present` : null;
  // The full-lesson audio lives only in this tab's memory; keep offering it
  // until the teacher downloads it or dismisses it.
  const finishedWithAudio = recorder.phase === 'stopped' && !!recorder.download;
  // The workspace already shows its own recording control.
  const showRecorder = (recordingNow || transcribing > 0 || finishedWithAudio) && pathname !== workspacePath;
  const list = Object.values(jobs).sort((a, b) => b.startedAt - a.startedAt);
  const running = list.find((job) => job.status === 'running');
  const now = useNow(!!running || recordingNow);
  const onWorkspace = /^\/live\/[^/]+\/present$/.test(pathname);
  if (!showRecorder && list.length === 0 && leftovers.length === 0) return null;
  const interrupted = leftovers.some((item) => item.interrupted);

  const summary = recordingNow && showRecorder
    ? { icon: <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />, text: `${say('錄音中', 'Recording')} ${formatClock(recorder.elapsed)}` }
    : running
      ? { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />, text: `${running.kind === 'notes' ? say('整理教學筆記', 'Writing notes') : say('重新轉錄', 'Re-transcribing')} ${formatClock(Math.floor((now - running.startedAt) / 1000))}` }
      : transcribing > 0 && showRecorder
        ? { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />, text: say(`轉錄中 ${transcribing} 段`, `Transcribing ${transcribing}`) }
        : finishedWithAudio && showRecorder && list.length === 0
          ? { icon: <Check className="h-3.5 w-3.5 text-emerald-600" />, text: say('錄音完成', 'Recording finished') }
        : interrupted && !running
          ? { icon: <AlertCircle className="h-3.5 w-3.5 text-amber-600" />, text: say('有錄音沒有正常結束', 'A recording did not finish') }
        : list.some((job) => job.status === 'error')
          ? { icon: <AlertCircle className="h-3.5 w-3.5 text-destructive" />, text: say('有工作失敗', 'A job failed') }
          : { icon: <Check className="h-3.5 w-3.5 text-emerald-600" />, text: say('教學筆記完成', 'Notes ready') };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            'fixed right-4 z-40 flex items-center gap-2.5 rounded-full border bg-card/95 py-2.5 pl-3 pr-4 text-sm font-medium shadow-lg backdrop-blur transition-shadow hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            // Clear of the workspace's bottom tab bar on phones.
            onWorkspace ? 'bottom-24 lg:bottom-4' : 'bottom-4',
          )}
          aria-label={`${say('背景工作', 'Background work')}: ${summary.text}`}
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10">{summary.icon}</span>
          <span className="tabular-nums">{summary.text}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[min(92vw,360px)] space-y-2 p-3">
        <p className="px-1 text-xs font-medium text-muted-foreground">{say('背景工作', 'Background work')}</p>
        {showRecorder && recorder.target && (
          <div className="space-y-2 rounded-xl border p-3">
            <p className="truncate text-sm font-medium">{recorder.target.title}</p>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground" role="status">
              {recordingNow
                ? <><span className="h-2 w-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />{say('錄音中', 'Recording')} {formatClock(recorder.elapsed)}</>
                : transcribing > 0
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />{say(`正在轉錄最後 ${transcribing} 段，完成前請不要關閉分頁`, `Transcribing the last ${transcribing}; keep this tab open`)}</>
                  : <><Check className="h-3.5 w-3.5 text-emerald-600" />{recorder.hasVideo
                    ? say(`錄音完成 · ${formatClock(recorder.elapsed)}；錄影檔只存在這台電腦，記得下載`, `Finished · ${formatClock(recorder.elapsed)}. The video lives only on this computer; download it`)
                    : say(`錄音完成 · ${formatClock(recorder.elapsed)}；錄音檔只存在這個分頁，記得下載`, `Finished · ${formatClock(recorder.elapsed)}. The audio file lives only in this tab; download it`)}</>}
            </p>
            <div className="flex flex-wrap gap-2">
              {recorder.phase === 'recording' && (
                <Button size="sm" variant="outline" className="h-8 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" onClick={() => void recorder.stop()}>
                  <Square className="mr-1.5 h-3 w-3 fill-current" />
                  {say('停止錄音', 'Stop recording')}
                </Button>
              )}
              {finishedWithAudio && recorder.download && (
                <Button asChild size="sm" variant="outline" className="h-8">
                  <a href={recorder.download.url} download={recorder.download.fileName}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {recorder.hasVideo ? say('下載錄影檔', 'Download video') : say('下載錄音檔', 'Download audio')}
                  </a>
                </Button>
              )}
              <Button asChild size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>
                <Link href={workspacePath!}>{say('回到課程', 'Back to the session')}</Link>
              </Button>
              {finishedWithAudio && transcribing === 0 && (
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" onClick={recorder.reset}>
                  {say('完成', 'Done')}
                </Button>
              )}
            </div>
          </div>
        )}
        {leftovers.map((item) => (
          <div key={item.meta.recordingId} className={cn('space-y-2 rounded-xl border p-3', item.interrupted && 'border-amber-300 bg-amber-50/60 dark:border-amber-900 dark:bg-amber-950/30')}>
            <p className="truncate text-sm font-medium">{item.meta.title}</p>
            <p className="text-xs leading-5 text-muted-foreground" role="status">
              {item.status === 'recovering'
                ? say('正在補傳並轉錄…', 'Uploading and transcribing…')
                : item.status === 'error'
                  ? say('補傳失敗，錄音仍保存在這台電腦，可以再試一次。', 'Recovery failed; the audio is still on this computer. Try again.')
                  : item.interrupted
                    ? say(
                      `錄音沒有正常結束（${new Date(item.meta.startedAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}）。這台電腦還保存著約 ${formatClock(item.unsentSeconds)} 尚未轉錄的錄音。`,
                      `This recording did not finish. About ${formatClock(item.unsentSeconds)} not yet transcribed is saved on this computer.`)
                    : item.meta.hasVideo
                      ? say('完整錄影檔還保存在這台電腦，可以下載。', 'The full video is still on this computer.')
                      : say('完整錄音檔還保存在這台電腦，可以下載。', 'The full audio file is still on this computer.')}
            </p>
            <div className="flex flex-wrap gap-2">
              {item.interrupted && (
                <Button size="sm" className="h-8" disabled={item.status === 'recovering'} onClick={() => recoverLeftover(item.meta.recordingId)}>
                  {item.status === 'recovering' && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
                  {say('補傳並轉錄', 'Upload and transcribe')}
                </Button>
              )}
              {item.hasAudio && (
                <Button size="sm" variant="outline" className="h-8" onClick={() => downloadLeftover(item.meta.recordingId)}>
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                  {item.meta.hasVideo ? say('下載錄影檔', 'Download video') : say('下載錄音檔', 'Download audio')}
                </Button>
              )}
              {confirmDiscard === item.meta.recordingId ? (
                <Button size="sm" variant="ghost" className="h-8 text-destructive" onClick={() => { setConfirmDiscard(null); discardLeftover(item.meta.recordingId); }}>
                  {say('確定刪除？無法復原', 'Delete for good?')}
                </Button>
              ) : (
                <Button size="sm" variant="ghost" className="h-8 text-muted-foreground" disabled={item.status === 'recovering'} onClick={() => setConfirmDiscard(item.meta.recordingId)}>
                  {say('從這台電腦刪除', 'Delete from this computer')}
                </Button>
              )}
            </div>
          </div>
        ))}
        {list.map((job) => (
          <div key={job.recordingId} className="space-y-2 rounded-xl border p-3">
            <div className="flex items-start gap-2">
              <p className="min-w-0 flex-1 truncate text-sm font-medium">{job.label}</p>
              {job.status !== 'running' && (
                <button type="button" className="text-muted-foreground hover:text-foreground" aria-label={say('移除', 'Dismiss')} onClick={() => dismiss(job.recordingId)}>
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
            <p className={cn('flex items-center gap-1.5 text-xs', job.status === 'error' ? 'text-destructive' : 'text-muted-foreground')} role="status">
              {job.status === 'running' ? <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                : job.status === 'done' ? <Check className="h-3.5 w-3.5 text-emerald-600" />
                : <AlertCircle className="h-3.5 w-3.5" />}
              {job.status === 'running'
                ? (job.kind === 'notes'
                  ? say(`正在整理教學筆記，約需 20–40 秒 · ${formatClock(Math.floor((now - job.startedAt) / 1000))}`, `Writing teaching notes, about 20–40 s · ${formatClock(Math.floor((now - job.startedAt) / 1000))}`)
                  : say('正在重新轉錄失敗的段落…', 'Retrying failed segments…'))
                : job.status === 'done'
                  ? (job.kind === 'notes' ? say('教學筆記完成', 'Teaching notes are ready') : say('重新轉錄完成', 'Re-transcription finished'))
                  : lectureJobError(job.error, zh)}
            </p>
            {job.status === 'done' && (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" className="h-8" onClick={() => { setOpen(false); openNotes(job.recordingId); }}>
                  <FileText className="mr-1.5 h-3.5 w-3.5" />
                  {job.kind === 'notes' ? say('查看筆記', 'View notes') : say('查看逐字稿', 'View transcript')}
                </Button>
              </div>
            )}
          </div>
        ))}
        <Button asChild size="sm" variant="link" className="h-auto px-1 text-xs" onClick={() => setOpen(false)}>
          <Link href="/live/recordings">{say('所有錄音與筆記', 'All recordings & notes')}</Link>
        </Button>
      </PopoverContent>
    </Popover>
  );
}
