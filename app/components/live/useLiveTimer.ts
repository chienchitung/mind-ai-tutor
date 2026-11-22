'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readTimer, timerRemaining, type LiveTimer, type TimerAction } from '@/lib/live-timer';

type Payload = { timer?: unknown; serverNow?: unknown };

const TIMER_REPAIR_MS = 20_000;

// The class timer as one screen sees it. `load` reads it (on subscribe and
// reconnect), `apply` takes a `timer:update` broadcast, and `command` (the
// teacher's page only) changes it. Remaining time is worked out against the
// server's clock, so every screen reaches zero together.
export function useLiveTimer(url: string, commandUrl?: string) {
  const [timer, setTimer] = useState<LiveTimer | null>(null);
  const [available, setAvailable] = useState(true);
  const skewRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());
  // Every answer carries the server time it reflects (a write's time, or a
  // read's). Anything older than what is on screen - a delayed broadcast or
  // a slow read - is dropped, whatever order they arrive in.
  const shownAtRef = useRef(0);

  const show = useCallback((payload: Payload) => {
    if (typeof payload.serverNow === 'number') {
      if (payload.serverNow < shownAtRef.current) return;
      shownAtRef.current = payload.serverNow;
      skewRef.current = payload.serverNow - Date.now();
    }
    setTimer(readTimer(payload.timer));
    setNow(Date.now());
  }, []);
  const apply = show;

  const load = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 503) { setAvailable(false); return; }
      if (!response.ok) return;
      setAvailable(true);
      show(await response.json());
    } catch {
      // Keep what is on screen; the next read or broadcast repairs it.
    }
  }, [url, show]);

  // Broadcasts are best effort: re-read now and then, and on coming back to
  // the tab, so a missed one never leaves a screen on an old countdown.
  useEffect(() => {
    void load();
    const repair = window.setInterval(() => void load(), TIMER_REPAIR_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') void load(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(repair);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  const running = Boolean(timer?.endsAt);
  useEffect(() => {
    if (!running) return;
    const tick = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(tick);
  }, [running]);

  const command = useCallback(async (action: TimerAction): Promise<boolean> => {
    if (!commandUrl) return false;
    try {
      const response = await fetch(commandUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(action),
      });
      if (!response.ok) return false;
      apply(await response.json());
      return true;
    } catch {
      return false;
    }
  }, [commandUrl, apply]);

  const remaining = timer ? timerRemaining(timer, now + skewRef.current) : 0;
  return {
    timer,
    available,
    remaining,
    running: running && remaining > 0,
    /** Ran to zero (not merely paused or reset). */
    finished: Boolean(timer?.endsAt) && remaining <= 0,
    load,
    apply,
    command,
  };
}
