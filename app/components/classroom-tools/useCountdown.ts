'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { clampSeconds } from '@/lib/classroom-tools';

// Counts down against the wall clock rather than counting ticks, so a
// background tab or a busy laptop never makes the timer run slow.
export function useCountdown(durationSeconds: number, onFinish: () => void) {
  const [remaining, setRemainingState] = useState(durationSeconds);
  const [endsAt, setEndsAtState] = useState<number | null>(null);
  const remainingRef = useRef(durationSeconds);
  const endsAtRef = useRef<number | null>(null);
  const finishRef = useRef(onFinish);
  finishRef.current = onFinish;

  const setRemaining = (seconds: number) => { remainingRef.current = seconds; setRemainingState(seconds); };
  const setEndsAt = (at: number | null) => { endsAtRef.current = at; setEndsAtState(at); };

  // A new duration resets an idle timer to it.
  useEffect(() => {
    if (endsAtRef.current === null) setRemaining(durationSeconds);
  }, [durationSeconds]);

  useEffect(() => {
    if (endsAt === null) return;
    const tick = () => {
      const left = Math.max(0, (endsAt - Date.now()) / 1000);
      setRemaining(left);
      if (left <= 0) {
        setEndsAt(null);
        finishRef.current();
      }
    };
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [endsAt]);

  const start = useCallback(() => {
    if (endsAtRef.current !== null) return;
    const from = remainingRef.current > 0 ? remainingRef.current : durationSeconds;
    if (from <= 0) return;
    setRemaining(from);
    setEndsAt(Date.now() + from * 1000);
  }, [durationSeconds]);

  const pause = useCallback(() => {
    const end = endsAtRef.current;
    if (end === null) return;
    setRemaining(Math.max(0, (end - Date.now()) / 1000));
    setEndsAt(null);
  }, []);

  const reset = useCallback(() => {
    setEndsAt(null);
    setRemaining(durationSeconds);
  }, [durationSeconds]);

  // ±1 minute, while running or not.
  const adjust = useCallback((seconds: number) => {
    const end = endsAtRef.current;
    if (end === null) {
      setRemaining(clampSeconds(remainingRef.current + seconds));
      return;
    }
    const left = clampSeconds((end - Date.now()) / 1000 + seconds);
    setRemaining(left);
    setEndsAt(Date.now() + left * 1000);
  }, []);

  return { remaining, running: endsAt !== null, start, pause, reset, adjust };
}
