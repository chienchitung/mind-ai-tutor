'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { AlertCircle, Check, ChevronDown, Download, FileText, Loader2, Square, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, type LessonNotes, type RecordingSummary } from '@/lib/live-recording';
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

type LectureJobs = {
  recorder: ReturnType<typeof useLectureRecorder>;
  jobs: Record<string, LectureJob>;
  /** Bumped whenever a job finishes, so recording lists know to reload. */
  version: number;
  generateNotes: (item: RecordingSummary) => void;
  retryFailed: (item: RecordingSummary) => void;
  dismiss: (recordingId: string) => void;
  openNotes: (recordingId: string) => void;
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
    () => ({ recorder, jobs, version, generateNotes, retryFailed, dismiss, openNotes }),
    [recorder, jobs, version, generateNotes, retryFailed, dismiss, openNotes],
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
  const { recorder, jobs, dismiss, openNotes } = useLectureJobs();
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
  if (!showRecorder && list.length === 0) return null;

  const summary = recordingNow && showRecorder
    ? { icon: <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />, text: `${say('錄音中', 'Recording')} ${formatClock(recorder.elapsed)}` }
    : running
      ? { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />, text: `${running.kind === 'notes' ? say('整理教學筆記', 'Writing notes') : say('重新轉錄', 'Re-transcribing')} ${formatClock(Math.floor((now - running.startedAt) / 1000))}` }
      : transcribing > 0 && showRecorder
        ? { icon: <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />, text: say(`轉錄中 ${transcribing} 段`, `Transcribing ${transcribing}`) }
        : finishedWithAudio && showRecorder && list.length === 0
          ? { icon: <Check className="h-3.5 w-3.5 text-emerald-600" />, text: say('錄音完成', 'Recording finished') }
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
                  : <><Check className="h-3.5 w-3.5 text-emerald-600" />{say(`錄音完成 · ${formatClock(recorder.elapsed)}；錄音檔只存在這個分頁，記得下載`, `Finished · ${formatClock(recorder.elapsed)}. The audio file lives only in this tab; download it`)}</>}
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
                    {say('下載錄音檔', 'Download audio')}
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
