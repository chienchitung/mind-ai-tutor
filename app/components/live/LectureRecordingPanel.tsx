'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, Check, ChevronDown, Download, Loader2, Mic, MonitorUp, RotateCcw, Square } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { formatClock, SEGMENT_SECONDS, type RecordingSummary } from '@/lib/live-recording';
import { canRecordScreen, type LiveSegment, type RecorderError } from './useLectureRecorder';
import { CloudAudioStatus, useLectureJobs } from './LectureJobsProvider';
import { IndeterminateBar, RecordingList } from './RecordingList';

const RECORD_SCREEN_KEY = 'mindaitutor.lecture.recordScreen';

export function LectureRecordingPanel({ sessionId, sessionTitle, deckUrl, deckPage }: {
  sessionId: string;
  sessionTitle: string;
  deckUrl: string | null;
  deckPage: number;
}) {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const say = (zhText: string, enText: string) => (zh ? zhText : enText);
  // The recorder lives above the page (LectureJobsProvider) so a lesson keeps
  // recording and transcribing while the teacher works elsewhere.
  const { recorder, version } = useLectureJobs();
  const { markSlide } = recorder;
  const mine = recorder.target?.sessionId === sessionId;
  const elsewhere = !mine && recorder.target !== null && (recorder.phase === 'recording' || recorder.phase === 'stopping');
  // Another session's finished recording is not this panel's business.
  const phase = mine || recorder.phase === 'starting' ? recorder.phase : 'idle';

  const [recordings, setRecordings] = useState<RecordingSummary[] | null>(null);
  const [listError, setListError] = useState('');
  const [open, setOpen] = useState(false);
  useEffect(() => { if (mine) markSlide(deckPage); }, [deckPage, markSlide, mine]);
  // Recording the screen too is opt-in, remembered per browser.
  const [screenSupported, setScreenSupported] = useState(false);
  const [recordScreen, setRecordScreen] = useState(false);
  useEffect(() => {
    setScreenSupported(canRecordScreen());
    try { setRecordScreen(localStorage.getItem(RECORD_SCREEN_KEY) === '1'); } catch { /* private mode */ }
  }, []);
  const chooseRecordScreen = (value: boolean) => {
    setRecordScreen(value);
    try { localStorage.setItem(RECORD_SCREEN_KEY, value ? '1' : '0'); } catch { /* private mode */ }
  };
  const withScreen = screenSupported && recordScreen;
  const fileWord = recorder.hasVideo ? say('錄影檔', 'video') : say('錄音檔', 'audio');

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

  useEffect(() => { void loadRecordings(); }, [loadRecordings, version]);
  // Errors are explained in the details dialog, so surface it when one happens.
  useEffect(() => { if (recorder.error && !elsewhere) setOpen(true); }, [recorder.error, elsewhere]);
  // Refresh the list as the active recording progresses and when it ends.
  const ownSegments = mine ? recorder.segments : [];
  const transcribedCount = ownSegments.filter((segment) => segment.status === 'transcribed').length;
  const failedCount = ownSegments.filter((segment) => segment.status === 'failed').length;
  useEffect(() => {
    if (phase === 'recording' || phase === 'stopped') void loadRecordings();
  }, [phase, transcribedCount, failedCount, loadRecordings]);

  const recorderErrors: Record<RecorderError, string> = {
    MIC_UNSUPPORTED: say('這個瀏覽器不支援錄音，請改用最新版 Chrome、Edge 或 Safari。', 'This browser cannot record. Use a current Chrome, Edge or Safari.'),
    MIC_DENIED: say('無法使用麥克風：請在瀏覽器網址列允許本網站使用麥克風。', 'Microphone blocked. Allow microphone access for this site in the address bar.'),
    SCREEN_DENIED: say('沒有選擇要錄製的畫面，錄音沒有開始。只想錄音的話，請取消勾選「同時錄製螢幕畫面」。', 'No screen was chosen, so recording did not start. To record only your voice, untick "Also record the screen".'),
    RECORDINGS_NOT_READY: say('錄音功能尚未啟用：請先在 Supabase 執行錄音功能的 migration。', 'Recording is not set up yet: run the lecture-recording migration in Supabase.'),
    START_FAILED: say('無法開始錄音，請再試一次。', 'Could not start recording. Please try again.'),
  };

  const live = mine ? recorder.segments : [];
  const pending = live.filter((segment) => segment.status === 'uploading' || segment.status === 'transcribing').length;

  const recordingNow = phase === 'recording' || phase === 'stopping';
  const startRecording = () => void recorder.start({ sessionId, title: sessionTitle, language: zh ? 'zh-TW' : 'en', currentPage: deckUrl ? deckPage : undefined, video: withScreen });

  return (
    <div className="flex items-center gap-1.5">
      {phase === 'idle' || phase === 'starting' ? (
        // A split button: what gets recorded is chosen right next to the
        // button that starts it, so first-time teachers find the screen option.
        <div className="flex h-10 items-stretch rounded-md border border-input bg-background shadow-sm">
          <Button
            variant="ghost"
            className="h-full rounded-r-none px-3"
            disabled={phase === 'starting' || elsewhere}
            title={elsewhere ? say(`「${recorder.target?.title}」正在錄音`, `"${recorder.target?.title}" is recording`) : undefined}
            // Another lesson's audio is still waiting to be downloaded: say so
            // (in the details) before a new recording replaces it.
            onClick={!mine && recorder.phase === 'stopped' && recorder.download ? () => setOpen(true) : startRecording}
          >
            {phase === 'starting' ? <Loader2 className="h-4 w-4 animate-spin sm:mr-2" /> : <span className="h-2.5 w-2.5 rounded-full bg-red-500 sm:mr-2" />}
            <span className="sr-only sm:not-sr-only">{withScreen ? say('開始錄音＋畫面', 'Record voice + screen') : say('開始錄音', 'Start recording')}</span>
            {withScreen && <MonitorUp className="ml-1.5 hidden h-3.5 w-3.5 text-muted-foreground sm:block" aria-hidden="true" />}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="h-full w-9 rounded-l-none border-l border-input p-0 text-muted-foreground" aria-label={say('錄音選項', 'Recording options')}>
                <ChevronDown className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-72">
              <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">{say('錄製方式', 'What to record')}</DropdownMenuLabel>
              <DropdownMenuRadioGroup value={withScreen ? 'screen' : 'voice'} onValueChange={(value) => chooseRecordScreen(value === 'screen')}>
                <DropdownMenuRadioItem value="voice" className="items-start py-2">
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 font-medium"><Mic className="h-3.5 w-3.5" />{say('只錄聲音', 'Voice only')}</span>
                    <span className="block text-xs text-muted-foreground">{say('轉成逐字稿與教學筆記，錄音可在逐字稿播放', 'Transcribed into notes; play it back with the transcript')}</span>
                  </span>
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="screen" className="items-start py-2" disabled={!screenSupported}>
                  <span className="space-y-0.5">
                    <span className="flex items-center gap-1.5 font-medium"><MonitorUp className="h-3.5 w-3.5" />{say('錄音＋螢幕畫面', 'Voice + screen')}</span>
                    <span className="block text-xs text-muted-foreground">
                      {screenSupported
                        ? say('開始時選要錄的視窗或螢幕；影片只存在這台電腦', 'Pick a window or screen when starting; the video stays on this computer')
                        : say('這個瀏覽器不支援錄製畫面', 'This browser cannot record the screen')}
                    </span>
                  </span>
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => setOpen(true)}>{say('錄音紀錄與詳情…', 'Recordings and details…')}</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      ) : recordingNow ? (
        <>
          <span className="flex h-10 items-center gap-1.5 rounded-lg bg-red-50 px-2.5 text-xs font-medium text-red-700 dark:bg-red-950/40 dark:text-red-300" role="status">
            <span className="h-2 w-2 animate-pulse rounded-full bg-red-500 motion-reduce:animate-none" />
            <span className="sr-only sm:not-sr-only">{recorder.hasVideo && !recorder.screenEnded ? say('錄音＋畫面', 'Voice + screen') : say('錄音中', 'Recording')}</span>
            <span className="font-mono tabular-nums">{formatClock(recorder.elapsed)}</span>
          </span>
          <Button
            variant="outline"
            className="h-10 border-red-200 px-3 text-red-700 hover:bg-red-50 hover:text-red-800 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40"
            disabled={phase === 'stopping'}
            aria-label={phase === 'stopping' ? say('正在結束錄音…', 'Finishing…') : say('停止錄音', 'Stop recording')}
            onClick={() => void recorder.stop()}
          >
            {phase === 'stopping' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Square className="h-3.5 w-3.5 fill-current" />}
          </Button>
        </>
      ) : (
        <Button variant="outline" className="h-10 px-3" onClick={() => setOpen(true)}>
          {pending > 0 ? <Loader2 className="h-4 w-4 animate-spin text-primary sm:mr-2" /> : <Check className="h-4 w-4 text-emerald-600 sm:mr-2" />}
          <span className="sr-only sm:not-sr-only">
            {pending > 0 ? say(`轉錄中 ${pending} 段`, `Transcribing ${pending}`) : say('錄音完成', 'Recording done')}
          </span>
        </Button>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        {/* Before recording, the details are in the options menu. */}
        {phase !== 'idle' && phase !== 'starting' && (
          <DialogTrigger asChild>
            <Button variant="ghost" className="h-10 w-10 p-0 text-muted-foreground" aria-label={say('錄音詳情與紀錄', 'Recording details and history')}>
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DialogTrigger>
        )}
        <DialogContent className="max-h-[85dvh] w-[calc(100%-2rem)] max-w-lg overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mic className="h-4 w-4 text-muted-foreground" />
              {say('課堂錄音・教學筆記', 'Lecture recording & notes')}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {phase === 'idle' || phase === 'starting' ? (
              <div className="space-y-3">
                <p className="text-xs leading-5 text-muted-foreground">
                  {say(
                    '錄下你的講解，每 5 分鐘自動轉成逐字稿，下課後一鍵整理成教學筆記。只錄你的麥克風；下課後整堂錄音會壓縮存到你的私人雲端空間，可以在逐字稿邊聽邊看（只有你能播放）。錄影只留在這台電腦供下載。',
                    'Records your voice, transcribes it every 5 minutes, and turns it into teaching notes after class. Only your microphone is recorded; after class the whole lesson audio is saved, compressed, to your private cloud space so you can play it with the transcript (only you can). Screen video stays on this computer for download.',
                  )}
                </p>
                {!mine && recorder.phase === 'stopped' && recorder.download && (
                  <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
                    {say(`「${recorder.target?.title}」的${fileWord}還沒下載；開始新的錄音後就無法再下載（逐字稿與筆記不受影響）。`, `The ${fileWord} of "${recorder.target?.title}" has not been downloaded; starting a new recording discards it (transcripts and notes are kept).`)}
                    {' '}
                    <a className="font-medium underline" href={recorder.download.url} download={recorder.download.fileName} onClick={recorder.markDownloaded}>{say('先下載', 'Download first')}</a>
                  </p>
                )}
                {elsewhere && (
                  <p className="rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground">
                    {say(`「${recorder.target?.title}」正在錄音，先停止那堂課的錄音才能在這裡開始。`, `"${recorder.target?.title}" is recording. Stop it before recording here.`)}
                  </p>
                )}
                {screenSupported && (
                  <div className="flex items-start gap-2.5 rounded-lg border px-3 py-2.5">
                    <Checkbox id={`record-screen-${sessionId}`} className="mt-0.5" checked={recordScreen} disabled={phase === 'starting'} onCheckedChange={(value) => chooseRecordScreen(value === true)} />
                    <label htmlFor={`record-screen-${sessionId}`} className="space-y-0.5 text-sm leading-5">
                      <span className="block font-medium">{say('同時錄製螢幕畫面', 'Also record the screen')}</span>
                      <span className="block text-xs text-muted-foreground">
                        {say(
                          '開始時選擇要錄的視窗或螢幕。影片只存在這台電腦，下課後可下載，不會上傳到雲端；轉錄仍只用聲音。約每分鐘 6 MB。',
                          'Pick a window or screen when you start. The video stays on this computer for download and is never uploaded; only the voice is transcribed. About 6 MB a minute.',
                        )}
                      </span>
                    </label>
                  </div>
                )}
                <Button className="w-full" disabled={phase === 'starting' || elsewhere} onClick={startRecording}>
                  {phase === 'starting' ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <span className="mr-2 h-2.5 w-2.5 rounded-full bg-red-500" />}
                  {withScreen ? say('開始錄音＋畫面', 'Record voice + screen') : say('開始錄音', 'Start recording')}
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
                {recorder.hasVideo && (
                  <p className="flex items-start gap-1.5 rounded-lg bg-muted px-3 py-2 text-xs leading-5 text-muted-foreground" role="status">
                    <MonitorUp className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    {recorder.screenEnded
                      ? say('螢幕分享已停止，之後只錄聲音；轉錄不受影響。', 'Screen sharing stopped; only your voice is recorded from here. Transcription is unaffected.')
                      : say('正在同時錄製螢幕畫面，影片只存在這台電腦。', 'Recording the screen too; the video stays on this computer.')}
                  </p>
                )}
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
                <CloudAudioStatus recorder={recorder} zh={zh} />
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
                      <a href={recorder.download.url} download={recorder.download.fileName} onClick={recorder.markDownloaded}>
                        <Download className="mr-1.5 h-3.5 w-3.5" />
                        {say(`下載${fileWord}`, `Download ${fileWord}`)}
                      </a>
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" className="h-9" disabled={pending > 0 || recorder.cloudAudio === 'uploading'} onClick={recorder.reset}>
                    <Mic className="mr-1.5 h-3.5 w-3.5" />
                    {say('新的錄音', 'New recording')}
                  </Button>
                </div>
              </div>
            )}

            {!elsewhere && recorder.error && <p role="alert" className="text-xs leading-5 text-destructive">{recorderErrors[recorder.error]}</p>}

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
          </div>
        </DialogContent>
      </Dialog>
    </div>
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
