import { z } from 'zod';
import { clampSeconds } from './classroom-tools';

// The live-class countdown. Times come from the server, so every screen
// counts toward the same end; each client corrects for its own clock with
// the server time sent alongside (skew).

export interface LiveTimer {
  durationSeconds: number;
  remainingSeconds: number;
  /** ISO time it reaches zero; null while paused or not started. */
  endsAt: string | null;
}

export const liveTimerSchema = z.object({
  durationSeconds: z.number().int().min(0).max(180 * 60),
  remainingSeconds: z.number().min(0).max(180 * 60),
  endsAt: z.string().datetime().nullable(),
});

export const timerActionSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('set'), seconds: z.number().int().min(1).max(180 * 60) }),
  z.object({ action: z.literal('start') }),
  z.object({ action: z.literal('pause') }),
  z.object({ action: z.literal('reset') }),
  z.object({ action: z.literal('adjust'), seconds: z.number().int().min(-180 * 60).max(180 * 60) }),
  z.object({ action: z.literal('clear') }),
]);
export type TimerAction = z.infer<typeof timerActionSchema>;

export function readTimer(value: unknown): LiveTimer | null {
  const parsed = liveTimerSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Seconds left at `nowMs` (the server's clock). */
export function timerRemaining(timer: LiveTimer, nowMs: number): number {
  if (!timer.endsAt) return timer.remainingSeconds;
  return Math.max(0, (Date.parse(timer.endsAt) - nowMs) / 1000);
}

export const timerRunning = (timer: LiveTimer | null, nowMs: number) =>
  Boolean(timer?.endsAt) && timerRemaining(timer!, nowMs) > 0;

/** The timer after a teacher's action, at server time `nowMs`. */
export function applyTimerAction(current: LiveTimer | null, action: TimerAction, nowMs: number): LiveTimer | null {
  const timer = current ?? { durationSeconds: 300, remainingSeconds: 300, endsAt: null };
  const left = timerRemaining(timer, nowMs);
  const iso = (ms: number) => new Date(ms).toISOString();
  switch (action.action) {
    case 'clear':
      return null;
    case 'set':
      return { durationSeconds: action.seconds, remainingSeconds: action.seconds, endsAt: null };
    case 'reset':
      return { ...timer, remainingSeconds: timer.durationSeconds, endsAt: null };
    case 'pause':
      return { ...timer, remainingSeconds: left, endsAt: null };
    case 'start': {
      const from = left > 0 ? left : timer.durationSeconds;
      if (from <= 0) return timer;
      return { ...timer, remainingSeconds: from, endsAt: iso(nowMs + from * 1000) };
    }
    case 'adjust': {
      const next = clampSeconds(left + action.seconds);
      if (!timer.endsAt || left <= 0) return { ...timer, remainingSeconds: next, endsAt: null };
      return { ...timer, remainingSeconds: next, endsAt: next > 0 ? iso(nowMs + next * 1000) : null };
    }
  }
}
