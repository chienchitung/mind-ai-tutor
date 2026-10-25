'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ExternalLink, FileText, Loader2, RotateCcw, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, type LessonNotes, type RecordingSummary } from '@/lib/live-recording';
import { extractDeckText } from '@/lib/deck-text';
import { LectureNotesDialog } from './LectureNotesDialog';

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyKind, setBusyKind] = useState<'notes' | 'retry' | null>(null);
  const [actionError, setActionError] = useState<{ id: string; message: string } | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [freshNotes, setFreshNotes] = useState<{ id: string; notes: LessonNotes } | null>(null);
  const [toDelete, setToDelete] = useState<RecordingSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const aiErrorMessage = (code: string | undefined) => {
    switch (code) {
      case 'INSUFFICIENT_POINTS': return say('AI 點數不足。', 'Not enough AI points.');
      case 'DAILY_LIMIT': return say('今天的 AI 使用次數已達上限。', 'Daily AI limit reached.');
      case 'NO_TRANSCRIPT': return say('還沒有完成轉錄的段落，請稍候或重試失敗的段落。', 'Nothing has been transcribed yet. Wait or retry the failed segments.');
      default: return say('AI 產生失敗，請再試一次。', 'AI generation failed. Please try again.');
    }
  };

  const generateNotes = async (item: RecordingSummary) => {
    if (busyId) return;
    setBusyId(item.id);
    setBusyKind('notes');
    setActionError(null);
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
        if (!response.ok) { setActionError({ id: item.id, message: aiErrorMessage(body.error) }); return; }
        setFreshNotes({ id: item.id, notes: body.notes });
        setOpenId(item.id);
        onReload();
        return;
      }
      setActionError({ id: item.id, message: aiErrorMessage('COOLDOWN') });
    } finally {
      setBusyId(null);
      setBusyKind(null);
    }
  };

  // Failed segments keep their audio in Storage, so they can be retried
  // later even after the page that recorded them was closed.
  const retryFailed = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setBusyKind('retry');
    setActionError(null);
    try {
      const detail = await fetch(`/api/live-recordings/${id}`, { cache: 'no-store' }).then((response) => response.json());
      const failed = (detail.segments ?? []).filter((segment: { status: string }) => segment.status === 'failed');
      for (const [index, segment] of failed.entries()) {
        if (index > 0) await sleep(3_500);
        const response = await fetch(`/api/live-recordings/${id}/segments`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idx: segment.idx, startSeconds: segment.startSeconds, durationSeconds: segment.durationSeconds, language: zh ? 'zh-TW' : 'en' }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          setActionError({
            id,
            message: body.error === 'SEGMENT_NOT_UPLOADED'
              ? say('部分段落的音訊沒有上傳成功，無法重新轉錄。', 'Some segment audio never finished uploading and cannot be transcribed.')
              : aiErrorMessage(body.error),
          });
          break;
        }
      }
    } catch {
      setActionError({ id, message: aiErrorMessage(undefined) });
    } finally {
      setBusyId(null);
      setBusyKind(null);
      onReload();
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/live-recordings/${toDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      onRemoved(toDelete.id);
      setToDelete(null);
    } catch {
      setActionError({ id: toDelete.id, message: say('刪除失敗，請再試一次。', 'Could not delete. Please try again.') });
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
          const busy = busyId === item.id;
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
                  <Button size="sm" className="h-8" onClick={() => setOpenId(item.id)}>
                    <FileText className="mr-1.5 h-3.5 w-3.5" />
                    {say('查看筆記', 'View notes')}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant={item.hasNotes ? 'outline' : 'default'}
                  className={cn('h-8', capturing && 'hidden')}
                  disabled={busy || !!busyId || item.transcribed === 0}
                  onClick={() => void generateNotes(item)}
                >
                  {busy && busyKind === 'notes' ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                  {item.hasNotes ? say('重新產生', 'Regenerate') : say('產生教學筆記', 'Generate notes')}
                </Button>
                {!item.hasNotes && item.transcribed > 0 && (
                  <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpenId(item.id)}>
                    {say('逐字稿', 'Transcript')}
                  </Button>
                )}
                {item.failed > 0 && !capturing && (
                  <Button size="sm" variant="ghost" className="h-8" disabled={!!busyId} onClick={() => void retryFailed(item.id)}>
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
                        ? say('正在整理教學筆記，約需 20–40 秒…', 'Writing teaching notes, about 20–40 seconds…')
                        : say('正在重新轉錄失敗的段落…', 'Retrying failed segments…')}
                    </p>
                    <IndeterminateBar />
                  </div>
                )}
                {actionError?.id === item.id && (
                  <p role="alert" className="w-full text-xs leading-5 text-destructive">{actionError.message}</p>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <LectureNotesDialog
        recordingId={openId}
        initialNotes={freshNotes && freshNotes.id === openId ? freshNotes.notes : null}
        onClose={() => { setOpenId(null); setFreshNotes(null); }}
      />
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
