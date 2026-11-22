import { describe, expect, it } from 'vitest';
import { applyTimerAction, readTimer, timerRemaining, timerRunning } from './live-timer';

const t0 = Date.parse('2026-11-22T10:00:00.000Z');

describe('live class timer', () => {
  it('sets, starts against the server clock, pauses and resumes from what was left', () => {
    let timer = applyTimerAction(null, { action: 'set', seconds: 180 }, t0)!;
    expect(timer).toEqual({ durationSeconds: 180, remainingSeconds: 180, endsAt: null });
    timer = applyTimerAction(timer, { action: 'start' }, t0)!;
    expect(timer.endsAt).toBe('2026-11-22T10:03:00.000Z');
    expect(timerRemaining(timer, t0 + 60_000)).toBe(120);
    timer = applyTimerAction(timer, { action: 'pause' }, t0 + 60_000)!;
    expect(timer).toEqual({ durationSeconds: 180, remainingSeconds: 120, endsAt: null });
    expect(timerRemaining(timer, t0 + 600_000)).toBe(120);
    timer = applyTimerAction(timer, { action: 'start' }, t0 + 100_000)!;
    expect(timer.endsAt).toBe('2026-11-22T10:03:40.000Z');
  });

  it('adds or takes a minute while running or paused, never below zero', () => {
    const running = applyTimerAction({ durationSeconds: 300, remainingSeconds: 300, endsAt: null }, { action: 'start' }, t0)!;
    expect(timerRemaining(applyTimerAction(running, { action: 'adjust', seconds: 60 }, t0 + 10_000)!, t0 + 10_000)).toBe(350);
    expect(applyTimerAction(running, { action: 'adjust', seconds: -600 }, t0)).toEqual({ durationSeconds: 300, remainingSeconds: 0, endsAt: null });
    expect(applyTimerAction({ durationSeconds: 300, remainingSeconds: 30, endsAt: null }, { action: 'adjust', seconds: 60 }, t0)!.remainingSeconds).toBe(90);
  });

  it('starts over from the full length once time is up, resets, and hides', () => {
    const done = { durationSeconds: 60, remainingSeconds: 60, endsAt: '2026-11-22T09:59:00.000Z' };
    expect(timerRunning(done, t0)).toBe(false);
    expect(applyTimerAction(done, { action: 'start' }, t0)!.endsAt).toBe('2026-11-22T10:01:00.000Z');
    expect(applyTimerAction(done, { action: 'reset' }, t0)).toEqual({ durationSeconds: 60, remainingSeconds: 60, endsAt: null });
    expect(applyTimerAction(done, { action: 'clear' }, t0)).toBeNull();
  });

  it('only trusts a well-formed stored timer', () => {
    expect(readTimer({ durationSeconds: 60, remainingSeconds: 60, endsAt: null })).not.toBeNull();
    expect(readTimer({ durationSeconds: -1, remainingSeconds: 60, endsAt: null })).toBeNull();
    expect(readTimer('soon')).toBeNull();
    expect(readTimer(null)).toBeNull();
  });
});
