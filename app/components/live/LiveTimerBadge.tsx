'use client';

import { Timer } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatClock } from '@/lib/classroom-tools';

// The class countdown as everyone sees it: on the projector and at the top
// of a student's page. Amber in the last minute, red once time is up.
export function LiveTimerBadge({
  remaining, finished, running, zh, size = 'md', className,
}: {
  remaining: number;
  finished: boolean;
  running: boolean;
  zh: boolean;
  size?: 'md' | 'lg';
  className?: string;
}) {
  const lastMinute = running && remaining <= 60;
  return (
    <div
      role="timer"
      aria-label={zh ? '課堂計時器' : 'Class timer'}
      className={cn(
        'inline-flex items-center gap-2 rounded-full font-mono font-bold tabular-nums shadow-lg',
        size === 'lg' ? 'px-5 py-2 text-4xl' : 'px-3 py-1 text-lg',
        finished ? 'bg-red-600 text-white' : lastMinute ? 'bg-amber-400 text-slate-950' : 'bg-slate-950/85 text-white',
        className,
      )}
    >
      <Timer className={size === 'lg' ? 'h-7 w-7' : 'h-4 w-4'} aria-hidden="true" />
      {finished ? (zh ? '時間到！' : "Time's up!") : formatClock(remaining)}
      {!running && !finished && <span className="font-sans text-xs font-medium opacity-70">{zh ? '暫停' : 'Paused'}</span>}
    </div>
  );
}
