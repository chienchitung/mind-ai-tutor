'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const STALE_AFTER_MS = 30000; // ~3 missed heartbeats (see the audience page's ping interval)

/**
 * Online-count via broadcast heartbeats instead of Supabase's native
 * Presence feature. Presence has a reported, still-open production incident
 * (supabase/realtime-js) where its sync/join/leave delivery can silently
 * stop working server-side - polling channel.presenceState() directly
 * didn't help either, meaning the underlying state itself never populated,
 * not just the callback. Broadcast is the one primitive every other part of
 * Live Session already depends on and is confirmed working end-to-end, so
 * counting via broadcast heartbeats instead sidesteps the bug entirely.
 *
 * The caller wires `registerPing` into its own channel's
 * `.on('broadcast', { event: 'presence:ping' }, ({ payload }) => registerPing(payload.participantId))`
 * (every `.on()` listener has to be registered on the channel before
 * `.subscribe()`, so this can't subscribe to the channel itself).
 */
export function useOnlinePresenceCount() {
  const lastSeenRef = useRef<Map<string, number>>(new Map());
  const [onlineCount, setOnlineCount] = useState(0);

  const registerPing = useCallback((participantId: string) => {
    lastSeenRef.current.set(participantId, Date.now());
    setOnlineCount(lastSeenRef.current.size);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      const cutoff = Date.now() - STALE_AFTER_MS;
      let changed = false;
      Array.from(lastSeenRef.current.entries()).forEach(([id, lastSeen]) => {
        if (lastSeen < cutoff) { lastSeenRef.current.delete(id); changed = true; }
      });
      if (changed) setOnlineCount(lastSeenRef.current.size);
    }, 5000);
    return () => clearInterval(interval);
  }, []);

  return { onlineCount, registerPing };
}
