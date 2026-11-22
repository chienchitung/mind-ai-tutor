'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { readTimer, timerRemaining, type LiveTimer, type TimerAction } from '@/lib/live-timer';

type Payload = { timer?: unknown; serverNow?: unknown };

// The class timer as one screen sees it. `load` reads it (on subscribe and
// reconnect), `apply` takes a `timer:update` broadcast, and `command` (the
// teacher's page only) changes it. Remaining time is worked out against the
// server's clock, so every screen reaches zero together.
export function useLiveTimer(url: string, commandUrl?: string) {
  const [timer, setTimer] = useState<LiveTimer | null>(null);
  const [available, setAvailable] = useState(true);
  const skewRef = useRef(0);
  const [now, setNow] = useState(() => Date.now());

  const apply = useCallback((payload: Payload) => {
    if (typeof payload.serverNow === 'number') skewRef.current = payload.serverNow - Date.now();
    setTimer(readTimer(payload.timer));
    setNow(Date.now());
  }, []);

  const load = useCallback(async () => {
    try {
      const response = await fetch(url, { cache: 'no-store' });
      if (response.status === 503) { setAvailable(false); return; }
      if (!response.ok) return;
      setAvailable(true);
      apply(await response.json());
    } catch {
      // Keep what is on screen; the next broadcast or reconnect repairs it.
    }
  }, [url, apply]);

  useEffect(() => { void load(); }, [load]);

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
