'use client';

import { useEffect, useRef, useState } from 'react';
import { Maximize, MonitorUp, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  DISPLAY_CHANNEL, formatClock, snapshotRemaining,
  type ClassroomDisplayMessage, type ClassroomDisplayState,
} from '@/lib/classroom-tools';
import { Confetti } from './Confetti';

// The projector window: shows what the classroom tools page is doing, big,
// with no controls. The teacher drags it onto the projector screen once and
// keeps working on the tools page; sound plays from the tools page.
export function ClassroomToolsDisplay() {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const [state, setState] = useState<ClassroomDisplayState | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [fullscreen, setFullscreen] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const finishedRef = useRef(false);

  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return;
    const channel = new BroadcastChannel(DISPLAY_CHANNEL);
    channel.onmessage = (event: MessageEvent<ClassroomDisplayMessage>) => {
      if (event.data?.type === 'state') { setState(event.data.state); setNow(Date.now()); }
    };
    channel.postMessage({ type: 'hello' } satisfies ClassroomDisplayMessage);
    return () => channel.close();
  }, []);

  const running = state?.timer.endsAt != null;
  useEffect(() => {
    if (!running) return;
    const timer = window.setInterval(() => setNow(Date.now()), 200);
    return () => window.clearInterval(timer);
  }, [running]);

  const finished = state?.timer.finished ?? false;
  useEffect(() => {
    if (finished && !finishedRef.current) setConfetti(Date.now());
    finishedRef.current = finished;
  }, [finished]);
  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(0), 4500);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  useEffect(() => {
    const sync = () => setFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);

  if (!state) {
    return (
      <main className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background px-6 text-center">
        <MonitorUp className="h-10 w-10 text-muted-foreground" />
        <p role="status" className="max-w-md text-lg text-muted-foreground">
          {zh ? '等待課堂工具頁連線⋯ 請保持課堂工具頁在同一個瀏覽器中開啟。' : 'Waiting for the classroom tools page… keep it open in this browser.'}
        </p>
      </main>
    );
  }

  const remaining = snapshotRemaining(state.timer, now);
  const total = Math.max(state.timer.durationSeconds, remaining, 1);
  const lastMinute = running && remaining <= 60;

  return (
    <main className="relative flex min-h-dvh flex-col bg-background px-6 py-8 sm:px-12" style={{ containerType: 'inline-size' }}>
      <Confetti burst={confetti} />
      {!fullscreen && (
        <Button
          variant="outline"
          size="sm"
          className="absolute right-4 top-4 z-10"
          onClick={() => void document.documentElement.requestFullscreen?.().catch(() => undefined)}
        >
          <Maximize className="mr-2 h-4 w-4" />
          {zh ? '全螢幕' : 'Full screen'}
        </Button>
      )}
      {state.courseName.trim() && (
        <h1 className="break-words text-center sm:px-28 text-[min(6cqw,4rem)] font-black tracking-tight">{state.courseName}</h1>
      )}

      {state.tab === 'timer' ? (
        <section aria-label={zh ? '課程計時器' : 'Course timer'} className="flex flex-1 flex-col items-center justify-center">
          <p
            role="timer"
            aria-live="off"
            className={cn(
              'font-mono font-black leading-none tabular-nums tracking-tight transition-colors',
              remaining >= 3600 ? 'text-[min(18cqw,30vh)]' : 'text-[min(26cqw,45vh)]',
              finished ? 'text-destructive' : lastMinute ? 'text-amber-500' : 'text-foreground',
            )}
          >
            {formatClock(remaining)}
          </p>
          <p role="status" className="mt-4 min-h-[1.2em] text-[min(5cqw,3rem)] font-black text-destructive">
            {finished ? (zh ? '時間到！' : "Time's up!") : ''}
          </p>
          <div className="mt-6 h-4 w-full max-w-5xl overflow-hidden rounded-full bg-muted" aria-hidden="true">
            <div
              className={cn('h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none', lastMinute || finished ? 'bg-amber-500' : 'bg-primary')}
              style={{ width: `${(remaining / total) * 100}%` }}
            />
          </div>
        </section>
      ) : (
        <section aria-label={zh ? '報告順序' : 'Presentation order'} className="flex flex-1 flex-col items-center justify-center">
          {state.order.length === 0 ? (
            <p className="flex items-center gap-3 text-[min(4cqw,2.5rem)] text-muted-foreground">
              <Users className="h-[1em] w-[1em]" />
              {zh ? '等待抽籤' : 'Waiting for the draw'}
            </p>
          ) : (
            <div className="w-full max-w-6xl">
              <p role="status" className="mb-6 text-center text-[min(3cqw,1.75rem)] font-semibold uppercase tracking-widest text-muted-foreground">
                {state.drawing ? (zh ? '抽籤中⋯' : 'Drawing…') : (zh ? '報告順序' : 'Presentation order')}
              </p>
              <ol className={cn('grid gap-4', state.order.length > 5 && 'sm:grid-cols-2')}>
                {state.order.map((name, index) => (
                  <li
                    key={`${index}-${name}`}
                    className={cn('flex items-center gap-4 rounded-2xl bg-primary px-5 py-4 text-primary-foreground', state.drawing && 'opacity-70')}
                  >
                    <span className="flex h-[1.6em] w-[1.6em] shrink-0 items-center justify-center rounded-full bg-white text-[min(3.5cqw,2.25rem)] font-black text-primary">{index + 1}</span>
                    <span className="min-w-0 break-words text-[min(4cqw,3rem)] font-bold">{name}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </section>
      )}
    </main>
  );
}
