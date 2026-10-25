'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, type RecordingSummary } from '@/lib/live-recording';
import { lectureJobError, useLectureJobs } from './LectureJobsProvider';

// The recordings list with its actions (notes, transcript, retry, delete),
// shared by the presenter workspace panel (one session) and the recordings
// overview page (every session).
export function RecordingList({ recordings, onReload, onRemoved, showSession = false, recordingNowId = null }: {
  recordings: RecordingSummary[];
  onReload: () => void;
  onRemoved: (id: string) => void;
  /** Show which session each recording belongs to (overview page). */
  showSession?: boolean;
  /** The recording this browser is capturing right now, if any. */
  recordingNowId?: string | null;
}) {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  // Notes and retries run in LectureJobsProvider, so they keep going (and
  // report back through the corner pill) if the teacher leaves this page.
  const { jobs, version, generateNotes, retryFailed, openNotes, dismiss } = useLectureJobs();
  const runningJob = Object.values(jobs).find((job) => job.status === 'running');
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<RecordingSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  // A job finishing changes what the list should show (notes, transcripts).
  const seenVersion = useRef(version);
  useEffect(() => {
    if (seenVersion.current === version) return;
    seenVersion.current = version;
    onReload();
  }, [version, onReload]);

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/live-recordings/${toDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      onRemoved(toDelete.id);
      setToDelete(null);
    } catch {
      setDeleteError(toDelete.id);
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  return (
    <>
      <ul className="space-y-2">
        {recordings.map((item) => {
          const capturing = item.id === recordingNowId || item.active;
          // A 'recording' row nobody is saving any more: the tab closed or
          // crashed without pressing stop. Its transcribed parts still count.
          const unfinished = item.status === 'recording' && !capturing;
          const job = jobs[item.id];
          const busy = job?.status === 'running';
          const busyKind = job?.kind;
          const actionError = job?.status === 'error'
            ? lectureJobError(job.error, zh)
            : deleteError === item.id ? say('刪除失敗，請再試一次。', 'Could not delete. Please try again.') : null;
          const when = new Date(item.createdAt).toLocaleString(zh ? 'zh-TW' : 'en-US', {
            ...(showSession ? { year: 'numeric' } : {}),
            month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit',
          });
          return (
            <li key={item.id} className="rounded-xl border bg-card p-3">
              <div className="flex items-start gap-2">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium" title={showSession ? item.sessionTitle ?? item.title : undefined}>
                    {showSession ? item.sessionTitle ?? item.title : when}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {showSession && `${when} · `}
                    {formatClock(item.durationSeconds)} · {say(`逐字稿 ${item.transcribed} 段`, `${item.transcribed} transcribed`)}
                    {item.failed > 0 && <span className="text-amber-700 dark:text-amber-400">{say(` · ${item.failed} 段失敗`, ` · ${item.failed} failed`)}</span>}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {capturing && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300">
                        <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
                        {say('錄音中', 'Recording')}
                      </span>
                    )}
                    {unfinished && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                        {say('未正常結束', 'Not stopped')}
                      </span>
                    )}
                    {item.hasNotes && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                        {say('已有教學筆記', 'Notes ready')}
                      </span>
                    )}
                    {showSession && !item.sessionId && (
                      <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                        {say('課程已刪除', 'Session deleted')}
                      </span>
                    )}
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                  aria-label={say('刪除錄音', 'Delete recording')}
                  disabled={capturing || busy}
                  onClick={() => setToDelete(item)}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {item.hasNotes && (
                  <Button size="sm" className="h-8" onClick={() => openNotes(item.id)}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    {say('查看筆記', 'View notes')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={item.hasNotes ? 'outline' : 'default'}
                  className={cn('h-8', capturing && 'hidden')}
                  disabled={busy || !!runningJob || item.transcribed === 0}
                  onClick={() => { dismiss(item.id); setDeleteError(null); generateNotes(item); }}
                >
                  {busy && busyKind === 'notes' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  {item.hasNotes ? say('重新產生', 'Regenerate') : say('產生教學筆記', 'Generate notes')}
                </Button>
                {!item.hasNotes && item.transcribed > 0 && (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => openNotes(item.id)}>
                    {say('逐字稿', 'Transcript')}
                  </Button>
                )}
                {item.failed > 0 && !capturing && (
                  <Button size="sm" variant="ghost" className="h-8" disabled={!!runningJob} onClick={() => { dismiss(item.id); retryFailed(item); }}>
                    <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                    {say('重試失敗段落', 'Retry failed')}
                  </Button>
                )}
                {showSession && item.sessionId && (
                  <Button asChild size="sm" variant="ghost" className="h-8">
                    <Link href={`/live/${item.sessionId}/present`}>
                      <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                      {say('前往課程', 'Open session')}
                    </Link>
                  </Button>
                )}
                {busy && (
                  <div className="w-full space-y-1.5 pt-1" role="status">
                    <p className="text-xs text-muted-foreground">
                      {busyKind === 'notes'
                        ? say('正在整理教學筆記，約需 20–40 秒。可以先去做別的事，完成後右下角會通知你。', 'Writing teaching notes, about 20–40 seconds. Feel free to keep working; the corner pill tells you when they are ready.')
                        : say('正在重新轉錄失敗的段落…', 'Retrying failed segments…')}
                    </p>
                    <IndeterminateBar />
                  </div>
                )}
                {actionError && (
                  <p role="alert" className="w-full text-xs leading-5 text-destructive">{actionError}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <DeleteConfirmation
        name={toDelete ? say('這段錄音與教學筆記', 'this recording and its notes') : null}
        busy={deleting}
        onCancel={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
      />
    </>
  );
}

export function IndeterminateBar() {
  return (
    <div className="h-1 overflow-hidden rounded-full bg-primary/10" aria-hidden="true">
      <div className="progress-indeterminate h-full w-2/5 rounded-full bg-primary/70" />
    </div>
  );
}
