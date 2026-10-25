'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Download, FileText, Loader2, Mic, RotateCcw, Sparkles, Square, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { DeleteConfirmation } from '@/components/ui/delete-confirmation';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, type LessonNotes } from '@/lib/live-recording';
import { extractDeckText } from '@/lib/deck-text';
import { useLectureRecorder, type RecorderError } from './useLectureRecorder';
import { LectureNotesDialog } from './LectureNotesDialog';

type RecordingSummary = {
  id: string;
  title: string;
  status: 'recording' | 'stopped';
  durationSeconds: number;
  hasNotes: boolean;
  createdAt: string;
  transcribed: number;
  failed: number;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export function LectureRecordingPanel({ sessionId, sessionTitle, deckUrl, deckPage }: {
  sessionId: string;
  sessionTitle: string;
  deckUrl: string | null;
  deckPage: number;
}) {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  const recorder = useLectureRecorder({ sessionId, title: sessionTitle, language: zh ? 'zh-TW' : 'en' });
  const { markSlide, phase } = recorder;

  const [recordings, setRecordings] = useState<RecordingSummary[] | null>(null);
  const [listError, setListError] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [freshNotes, setFreshNotes] = useState<{ id: string; notes: LessonNotes } | null>(null);
  const [toDelete, setToDelete] = useState<RecordingSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => { markSlide(deckPage); }, [deckPage, markSlide]);

  const loadRecordings = useCallback(async () => {
    try {
      const response = await fetch(`/api/live-recordings?sessionId=${sessionId}`, { cache: 'no-store' });
      const body = await response.json().catch(() => null);
      if (!response.ok || !Array.isArray(body)) {
        setListError(body?.error === 'RECORDINGS_NOT_READY'
          ? say('錄音功能尚未啟用：請先在 Supabase 執行錄音功能的 migration。', 'Recording is not set up yet: run the lecture-recording migration in Supabase.')
          : say('無法載入錄音紀錄。', 'Could not load recordings.'));
        return;
      }
      setListError('');
      setRecordings(body);
    } catch {
      setListError(say('無法載入錄音紀錄。', 'Could not load recordings.'));
    }
  }, [sessionId, zh]);

  useEffect(() => { void loadRecordings(); }, [loadRecordings]);
  // Refresh the list as the active recording progresses and when it ends.
  const transcribedCount = recorder.segments.filter((segment) => segment.status === 'transcribed').length;
  const failedCount = recorder.segments.filter((segment) => segment.status === 'failed').length;
  useEffect(() => {
    if (phase === 'recording' || phase === 'stopped') void loadRecordings();
  }, [phase, transcribedCount, failedCount, loadRecordings]);

  const aiErrorMessage = (code: string | undefined) => {
    switch (code) {
      case 'INSUFFICIENT_POINTS': return say('AI 點數不足。', 'Not enough AI points.');
      case 'DAILY_LIMIT': return say('今天的 AI 使用次數已達上限。', 'Daily AI limit reached.');
      case 'NO_TRANSCRIPT': return say('還沒有完成轉錄的段落，請稍候或重試失敗的段落。', 'Nothing has been transcribed yet. Wait or retry the failed segments.');
      default: return say('AI 產生失敗，請再試一次。', 'AI generation failed. Please try again.');
    }
  };

  const generateNotes = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setActionError('');
    try {
      const slides = deckUrl ? await extractDeckText(deckUrl).catch(() => []) : [];
      for (let attempt = 0; attempt < 3; attempt++) {
        const response = await fetch(`/api/live-recordings/${id}/notes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ language: zh ? 'zh-TW' : 'en', slides }),
        });
        const body = await response.json().catch(() => ({}));
        if (response.status === 429 && body.error === 'COOLDOWN') { await sleep(4_000); continue; }
        if (!response.ok) { setActionError(aiErrorMessage(body.error)); return; }
        setFreshNotes({ id, notes: body.notes });
        setOpenId(id);
        void loadRecordings();
        return;
      }
      setActionError(aiErrorMessage('COOLDOWN'));
    } finally {
      setBusyId(null);
    }
  };

  // Failed segments keep their audio in Storage, so they can be retried
  // later even after the page that recorded them was closed.
  const retryFailed = async (id: string) => {
    if (busyId) return;
    setBusyId(id);
    setActionError('');
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
          setActionError(body.error === 'SEGMENT_NOT_UPLOADED'
            ? say('部分段落的音訊沒有上傳成功，無法重新轉錄。', 'Some segment audio never finished uploading and cannot be transcribed.')
            : aiErrorMessage(body.error));
          break;
        }
      }
    } catch {
      setActionError(aiErrorMessage(undefined));
    } finally {
      setBusyId(null);
      void loadRecordings();
    }
  };

  const confirmDelete = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/live-recordings/${toDelete.id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error();
      setRecordings((previous) => previous?.filter((item) => item.id !== toDelete.id) ?? previous);
      setToDelete(null);
    } catch {
      setActionError(say('刪除失敗，請再試一次。', 'Could not delete. Please try again.'));
    } finally {
      setDeleting(false);
    }
  };

  const recorderErrors: Record<RecorderError, string> = {
    MIC_UNSUPPORTED: say('這個瀏覽器不支援錄音，請改用最新版 Chrome、Edge 或 Safari。', 'This browser cannot record. Use a current Chrome, Edge or Safari.'),
    MIC_DENIED: say('無法使用麥克風：請在瀏覽器網址列允許本網站使用麥克風。', 'Microphone blocked. Allow microphone access for this site in the address bar.'),
    RECORDINGS_NOT_READY: say('錄音功能尚未啟用：請先在 Supabase 執行錄音功能的 migration。', 'Recording is not set up yet: run the lecture-recording migration in Supabase.'),
    START_FAILED: say('無法開始錄音，請再試一次。', 'Could not start recording. Please try again.'),
  };

  const live = recorder.segments;
  const pending = live.filter((segment) => segment.status === 'uploading' || segment.status === 'transcribing').length;
  const failedLive = live.filter((segment) => segment.status === 'failed');

  return (
    <Card>
      <CardContent className="space-y-4 p-4 md:p-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Mic className="h-4 w-4 text-muted-foreground" />
            {say('課堂錄音・教學筆記', 'Lecture recording & notes')}
          </h2>
          {phase === 'recording' && (
            <span className="flex items-center gap-1.5 rounded-full bg-red-50 px-2.5 py-1 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300" role="status">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
              {say('錄音中', 'Recording')} {formatClock(recorder.elapsed)}
            </span>
          )}
        </div>

        {phase === 'idle' || phase === 'starting' ? (
          <div className="space-y-3">
            <p className="text-xs leading-5 text-muted-foreground">
              {say(
                '錄下你的講解，每 5 分鐘自動轉成逐字稿，下課後一鍵整理成教學筆記。只錄你的麥克風；音訊轉成文字後就會從雲端刪除，完整錄音只留在這台電腦供下載。',
                'Records your voice, transcribes it every 5 minutes, and turns it into teaching notes after class. Only your microphone is recorded; audio is deleted from the cloud once transcribed, and the full recording stays on this computer for download.',
              )}
            </p>
            <Button className="w-full" disabled={phase === 'starting'} onClick={() => void recorder.start(deckUrl ? deckPage : undefined)}>
              {phase === 'starting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
              {say('開始錄音', 'Start recording')}
            </Button>
          </div>
        ) : phase === 'recording' || phase === 'stopping' ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              {say(`已轉錄 ${transcribedCount} 段`, `${transcribedCount} segment(s) transcribed`)}
              {pending > 0 && say(` · 處理中 ${pending} 段`, ` · ${pending} in progress`)}
              {say('（每 5 分鐘一段）', ' (one every 5 minutes)')}
            </p>
            <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" disabled={phase === 'stopping'} onClick={() => void recorder.stop()}>
              {phase === 'stopping' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-3.5 w-3.5 fill-current" />}
              {say('停止錄音', 'Stop recording')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {say('錄音完成', 'Recording finished')} · {formatClock(recorder.elapsed)}
            </p>
            <p className="text-xs text-muted-foreground">
              {pending > 0
                ? say(`還有 ${pending} 段正在轉錄，完成前請不要關閉這個頁面。`, `${pending} segment(s) still transcribing. Keep this page open until they finish.`)
                : failedCount > 0
                  ? say('部分段落轉錄失敗，重試後就能產生完整的教學筆記。', 'Some segments failed. Retry them to get complete notes.')
                  : say('逐字稿已處理完成，可以在下方產生教學筆記。', 'Transcription finished. Generate notes below.')}
            </p>
            <div className="flex flex-wrap gap-2">
              {recorder.download && (
                <Button asChild size="sm" variant="outline" className="h-9">
                  <a href={recorder.download.url} download={recorder.download.fileName}>
                    <Download className="mr-1.5 h-3.5 w-3.5" />
                    {say('下載錄音檔', 'Download audio')}
                  </a>
                </Button>
              )}
              <Button size="sm" variant="ghost" className="h-9" disabled={pending > 0} onClick={recorder.reset}>
                <Mic className="mr-1.5 h-3.5 w-3.5" />
                {say('新的錄音', 'New recording')}
              </Button>
            </div>
          </div>
        )}

        {failedLive.length > 0 && (
          <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            <p className="flex items-center gap-1.5 font-medium">
              <AlertCircle className="h-3.5 w-3.5" />
              {say(`${failedLive.length} 段轉錄失敗`, `${failedLive.length} segment(s) failed`)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {failedLive.map((segment) => (
                <Button key={segment.idx} size="sm" variant="outline" className="h-7 bg-background px-2 text-xs" onClick={() => recorder.retry(segment.idx)}>
                  <RotateCcw className="mr-1 h-3 w-3" />
                  {formatClock(segment.startSeconds)}
                </Button>
              ))}
            </div>
          </div>
        )}

        {recorder.error && <p role="alert" className="text-xs leading-5 text-destructive">{recorderErrors[recorder.error]}</p>}
        {actionError && <p role="alert" className="text-xs leading-5 text-destructive">{actionError}</p>}

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{say('這堂課的錄音', 'Recordings for this session')}</p>
          {listError ? (
            <p className="text-xs text-muted-foreground">{listError}</p>
          ) : recordings === null ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : recordings.length === 0 ? (
            <p className="text-xs text-muted-foreground">{say('還沒有錄音。', 'No recordings yet.')}</p>
          ) : (
            <ul className="space-y-2">
              {recordings.map((item) => {
                const active = item.id === recorder.recordingId && (phase === 'recording' || phase === 'stopping');
                const busy = busyId === item.id;
                return (
                  <li key={item.id} className="rounded-xl border p-3">
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">
                          {new Date(item.createdAt).toLocaleString(zh ? 'zh-TW' : 'en-US', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatClock(item.durationSeconds)} · {say(`逐字稿 ${item.transcribed} 段`, `${item.transcribed} transcribed`)}
                          {item.failed > 0 && <span className="text-amber-700 dark:text-amber-400">{say(` · ${item.failed} 段失敗`, ` · ${item.failed} failed`)}</span>}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-destructive"
                        aria-label={say('刪除錄音', 'Delete recording')}
                        disabled={active || busy}
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
                        className={cn('h-8', active && 'hidden')}
                        disabled={busy || !!busyId || item.transcribed === 0}
                        onClick={() => void generateNotes(item.id)}
                      >
                        {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Sparkles className="mr-1.5 h-3.5 w-3.5" />}
                        {item.hasNotes ? say('重新產生', 'Regenerate') : say('產生教學筆記', 'Generate notes')}
                      </Button>
                      {!item.hasNotes && item.transcribed > 0 && (
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpenId(item.id)}>
                          {say('逐字稿', 'Transcript')}
                        </Button>
                      )}
                      {item.failed > 0 && !active && (
                        <Button size="sm" variant="ghost" className="h-8" disabled={!!busyId} onClick={() => void retryFailed(item.id)}>
                          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                          {say('重試失敗段落', 'Retry failed')}
                        </Button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </CardContent>
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
    </Card>
  );
}
