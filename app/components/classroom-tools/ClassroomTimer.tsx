'use client';

import { useEffect, useRef, useState } from 'react';
import { Minus, Pause, Play, Plus, RotateCcw, Timer as TimerIcon, Volume2, VolumeX } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MAX_TIMER_MINUTES, TIMER_PRESETS_MINUTES, formatClock } from '@/lib/classroom-tools';
import { useCountdown } from './useCountdown';
import { playChime } from './chime';

const MUSIC_SRC = '/classroom-tools/timer-music.mp3';

export function ClassroomTimer({
  zh, durationSeconds, muted, large, onDurationChange, onMutedChange, onFinish, onRunningChange,
}: {
  zh: boolean;
  durationSeconds: number;
  muted: boolean;
  /** Fullscreen projection: much bigger digits. */
  large: boolean;
  onDurationChange: (seconds: number) => void;
  onMutedChange: (muted: boolean) => void;
  onFinish: () => void;
  /** Lets the page mark the timer's tab while it counts down elsewhere. */
  onRunningChange?: (running: boolean) => void;
}) {
  const [finished, setFinished] = useState(false);
  const { remaining, running, start, pause, reset, adjust } = useCountdown(durationSeconds, () => {
    setFinished(true);
    playChime();
    onFinish();
  });
  const [customMinutes, setCustomMinutes] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { onRunningChange?.(running); }, [running, onRunningChange]);

  // Background music while the timer runs (as in the workshop timer).
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    if (running && !muted) void audio.play().catch(() => undefined);
    else audio.pause();
  }, [running, muted]);

  const total = Math.max(durationSeconds, remaining, 1);
  const lastMinute = running && remaining <= 60;
  const rewindMusic = () => { if (audioRef.current) audioRef.current.currentTime = 0; };
  // Picking a length (even the current one) starts the countdown over from it.
  const choose = (seconds: number) => { setFinished(false); rewindMusic(); reset(); onDurationChange(seconds); };

  return (
    <section aria-label={zh ? '課程計時器' : 'Course timer'} className="flex flex-col items-center rounded-3xl border bg-card p-6 text-center shadow-sm sm:p-8" style={{ containerType: 'inline-size' }}>
      <audio ref={audioRef} src={MUSIC_SRC} loop preload="none" />
      <h2 className="flex items-center gap-2 self-start text-sm font-semibold text-muted-foreground">
        <TimerIcon className="h-4 w-4" />{zh ? '課程計時器' : 'Course timer'}
      </h2>
      <p
        role="timer"
        aria-live="off"
        className={cn(
          'my-4 font-mono font-black tabular-nums tracking-tight transition-colors',
          // Sized to the card's own width (container units), so the digits
          // never spill out of it on a projector; h:mm:ss needs a smaller size.
          'leading-none',
          remaining >= 3600
            ? (large ? 'text-[min(20cqw,12rem)]' : 'text-[min(20cqw,6rem)]')
            : (large ? 'text-[min(29cqw,16rem)]' : 'text-[min(29cqw,8rem)]'),
          finished ? 'text-destructive' : lastMinute ? 'text-amber-500' : 'text-foreground',
        )}
      >
        {formatClock(remaining)}
      </p>
      <p role="status" className="min-h-7 text-lg font-bold text-destructive">{finished ? (zh ? '時間到！' : "Time's up!") : ''}</p>

      <div className="my-4 h-3 w-full overflow-hidden rounded-full bg-muted" aria-hidden="true">
        <div className={cn('h-full rounded-full transition-[width] duration-200 motion-reduce:transition-none', lastMinute || finished ? 'bg-amber-500' : 'bg-primary')} style={{ width: `${(remaining / total) * 100}%` }} />
      </div>

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="outline" size="icon" className="h-11 w-11" aria-label={zh ? '減少 1 分鐘' : 'Minus 1 minute'} onClick={() => adjust(-60)}>
          <Minus className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          className="h-16 w-16 rounded-full"
          aria-label={running ? (zh ? '暫停' : 'Pause') : (zh ? '開始' : 'Start')}
          onClick={() => { if (running) pause(); else { setFinished(false); start(); } }}
        >
          {running ? <Pause className="h-7 w-7" /> : <Play className="ml-1 h-7 w-7" />}
        </Button>
        <Button variant="outline" size="icon" className="h-11 w-11" aria-label={zh ? '增加 1 分鐘' : 'Plus 1 minute'} onClick={() => adjust(60)}>
          <Plus className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label={zh ? '重設' : 'Reset'} onClick={() => { setFinished(false); rewindMusic(); reset(); }}>
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-pressed={muted} aria-label={zh ? '背景音樂靜音' : 'Mute music'} onClick={() => onMutedChange(!muted)}>
          {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        {TIMER_PRESETS_MINUTES.map((minutes) => (
          <Button
            key={minutes}
            size="sm"
            variant={durationSeconds === minutes * 60 ? 'secondary' : 'outline'}
            aria-pressed={durationSeconds === minutes * 60}
            disabled={running}
            onClick={() => choose(minutes * 60)}
          >
            {zh ? `${minutes} 分鐘` : `${minutes} min`}
          </Button>
        ))}
        <form
          className="flex items-center gap-1"
          onSubmit={(event) => {
            event.preventDefault();
            const minutes = Number(customMinutes);
            if (minutes > 0 && minutes <= MAX_TIMER_MINUTES) { choose(Math.round(minutes * 60)); setCustomMinutes(''); }
          }}
        >
          <Input
            type="number"
            inputMode="decimal"
            min={0.5}
            max={MAX_TIMER_MINUTES}
            step={0.5}
            value={customMinutes}
            onChange={(event) => setCustomMinutes(event.target.value)}
            disabled={running}
            className="h-9 w-20"
            aria-label={zh ? '自訂分鐘數' : 'Custom minutes'}
            placeholder={zh ? '分鐘' : 'min'}
          />
          <Button type="submit" size="sm" variant="outline" disabled={running || !(Number(customMinutes) > 0)}>
            {zh ? '設定' : 'Set'}
          </Button>
        </form>
      </div>
    </section>
  );
}
