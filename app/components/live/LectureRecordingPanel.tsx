'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, Download, Loader2, Mic, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, SEGMENT_SECONDS, type RecordingSummary } from '@/lib/live-recording';
import { useLectureRecorder, type LiveSegment, type RecorderError } from './useLectureRecorder';
import { IndeterminateBar, RecordingList } from './RecordingList';

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

  const recorderErrors: Record<RecorderError, string> = {
    MIC_UNSUPPORTED: say('這個瀏覽器不支援錄音，請改用最新版 Chrome、Edge 或 Safari。', 'This browser cannot record. Use a current Chrome, Edge or Safari.'),
    MIC_DENIED: say('無法使用麥克風：請在瀏覽器網址列允許本網站使用麥克風。', 'Microphone blocked. Allow microphone access for this site in the address bar.'),
    RECORDINGS_NOT_READY: say('錄音功能尚未啟用：請先在 Supabase 執行錄音功能的 migration。', 'Recording is not set up yet: run the lecture-recording migration in Supabase.'),
    START_FAILED: say('無法開始錄音，請再試一次。', 'Could not start recording. Please try again.'),
  };

  const live = recorder.segments;
  const pending = live.filter((segment) => segment.status === 'uploading' || segment.status === 'transcribing').length;

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
            <div className="space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                <span>
                  {say('目前段落', 'Current segment')} {formatClock(recorder.elapsed % SEGMENT_SECONDS)} / {formatClock(SEGMENT_SECONDS)}
                </span>
                <span>{say(`已轉錄 ${transcribedCount} 段`, `${transcribedCount} transcribed`)}</span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                <div
                  className="h-full rounded-full bg-red-400 transition-[width] duration-1000 ease-linear motion-reduce:transition-none"
                  style={{ width: `${((recorder.elapsed % SEGMENT_SECONDS) / SEGMENT_SECONDS) * 100}%` }}
                />
              </div>
              <p className="text-[11px] leading-4 text-muted-foreground">
                {say('每滿 5 分鐘會自動送出一段轉錄。', 'A segment is sent for transcription every 5 minutes.')}
              </p>
            </div>
            <SegmentTrack segments={live} zh={zh} onRetry={recorder.retry} />
            <Button variant="outline" className="w-full border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40" disabled={phase === 'stopping'} onClick={() => void recorder.stop()}>
              {phase === 'stopping' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Square className="mr-2 h-3.5 w-3.5 fill-current" />}
              {phase === 'stopping' ? say('正在結束錄音…', 'Finishing…') : say('停止錄音', 'Stop recording')}
            </Button>
          </div>
        ) : (
          <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
            <p className="text-sm font-medium">
              {say('錄音完成', 'Recording finished')} · {formatClock(recorder.elapsed)}
            </p>
            {pending > 0 && (
              <div className="space-y-2" role="status">
                <p className="flex items-center gap-2 text-xs font-medium text-foreground">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                  {say(`正在轉錄最後 ${pending} 段，通常需要 10–30 秒…`, `Transcribing the last ${pending} segment(s), usually 10–30 seconds…`)}
                </p>
                <IndeterminateBar />
              </div>
            )}
            <SegmentTrack segments={live} zh={zh} onRetry={recorder.retry} />
            <p className="text-xs text-muted-foreground">
              {pending > 0
                ? say('完成前請不要關閉這個頁面。', 'Keep this page open until they finish.')
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

        {recorder.error && <p role="alert" className="text-xs leading-5 text-destructive">{recorderErrors[recorder.error]}</p>}

        <div className="space-y-2 border-t pt-3">
          <p className="text-xs font-medium text-muted-foreground">{say('這堂課的錄音', 'Recordings for this session')}</p>
          {listError ? (
            <p className="text-xs text-muted-foreground">{listError}</p>
          ) : recordings === null ? (
            <div className="flex justify-center py-3"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
          ) : recordings.length === 0 ? (
            <p className="text-xs text-muted-foreground">{say('還沒有錄音。', 'No recordings yet.')}</p>
          ) : (
            <RecordingList
              recordings={recordings}
              recordingNowId={phase === 'recording' || phase === 'stopping' ? recorder.recordingId : null}
              onReload={() => void loadRecordings()}
              onRemoved={(id) => setRecordings((previous) => previous?.filter((item) => item.id !== id) ?? previous)}
            />
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// One chip per five-minute segment, so the teacher can see each one move
// from upload to transcription to done (or retry a failed one).
function SegmentTrack({ segments, zh, onRetry }: { segments: LiveSegment[]; zh: boolean; onRetry: (idx: number) => void }) {
  if (!segments.length) return null;
  const label = (segment: LiveSegment) => ({
    uploading: zh ? '上傳中' : 'Uploading',
    transcribing: zh ? '轉錄中' : 'Transcribing',
    transcribed: zh ? '已完成' : 'Done',
    failed: zh ? '失敗，點擊重試' : 'Failed, click to retry',
  })[segment.status];
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label={zh ? '各段轉錄進度' : 'Segment progress'}>
      {segments.map((segment) => {
        const working = segment.status === 'uploading' || segment.status === 'transcribing';
        const content = (
          <>
            {working ? <Loader2 className="h-3 w-3 animate-spin" />
              : segment.status === 'transcribed' ? <Check className="h-3 w-3" />
              : <AlertCircle className="h-3 w-3" />}
            <span className="font-mono tabular-nums">{formatClock(segment.startSeconds)}</span>
            {working && <span>{label(segment)}</span>}
          </>
        );
        const tone = segment.status === 'transcribed'
          ? 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300'
          : segment.status === 'failed'
            ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
            : 'border-primary/20 bg-primary/5 text-foreground';
        return (
          <li key={segment.idx}>
            {segment.status === 'failed' ? (
              <button type="button" title={label(segment)} aria-label={`${formatClock(segment.startSeconds)} ${label(segment)}`} onClick={() => onRetry(segment.idx)} className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs', tone)}>
                {content}
                <RotateCcw className="h-3 w-3" />
              </button>
            ) : (
              <span title={label(segment)} className={cn('inline-flex h-7 items-center gap-1 rounded-full border px-2.5 text-xs', tone)}>{content}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
