"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import type {
  PresentationCommand,
  PresentationSnapshot,
} from "@/lib/live-presentation";

const REMOTE_PENDING_MS = 10_000;

/** Broadcasts are hints, not authority. Re-read after subscribe/reconnect and
 * periodically repair missed events. One request at a time, including writes. */
export function usePresentationSnapshot(url: string, sessionId?: string) {
  const [snapshot, setSnapshot] = useState<PresentationSnapshot | null>(null);
  // Mirrors `snapshot` as of the last committed render. command() reads this
  // (not a setState functional updater) to capture "the value before my
  // optimistic guess": React doesn't guarantee an updater runs synchronously
  // at the setState call site, but an effect is guaranteed to have flushed
  // by the time a user-triggered command() call runs.
  const snapshotRef = useRef<PresentationSnapshot | null>(null);
  useEffect(() => {
    snapshotRef.current = snapshot;
  }, [snapshot]);
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);
  const [actionError, setActionError] = useState(false);
  const busy = useRef(false);
  const queued = useRef(false);
  const mounted = useRef(true);
  const writing = useRef(false);
  const readDone = useRef<Promise<void> | null>(null);
  // Bumped whenever a fresher snapshot arrives without a read (a command's
  // own response, or one pushed by the presenter window). A GET that started
  // before that is older than what is on screen and must not overwrite it.
  const generation = useRef(0);
  // Set while another window's optimistic guess is on screen and its write
  // is still in flight: a read here could only return the state before that
  // write. Cleared by the final result (or revert), or after a safety window.
  const remotePendingSince = useRef(0);
  const remotePending = () => remotePendingSince.current > 0 && Date.now() - remotePendingSince.current < REMOTE_PENDING_MS;
  const refresh = useCallback((): Promise<void> => {
    if (busy.current) {
      queued.current = true;
      return readDone.current ?? Promise.resolve();
    }
    busy.current = true;
    const request = (async () => {
      try {
        do {
          queued.current = false;
          const startedAt = generation.current;
          const response = await fetch(url, {
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
          });
          if (response.status === 404) {
            if (mounted.current) {
              setSnapshot((previous) =>
                previous
                  ? {
                      ...previous,
                      status: "closed",
                      mode: "blank",
                      poll: null,
                      questions: [],
                    }
                  : null,
              );
              setError(false);
            }
            return;
          }
          if (!response.ok) throw new Error();
          const value = await response.json();
          // Skipped while a command is in flight too: its response is newer
          // than anything this read could have seen.
          if (mounted.current && startedAt === generation.current && !writing.current && !remotePending()) {
            setSnapshot(value);
            setError(false);
          }
        } while (queued.current && mounted.current && !writing.current);
      } catch {
        if (mounted.current) setError(true);
      } finally {
        busy.current = false;
        readDone.current = null;
      }
    })();
    readDone.current = request;
    return request;
  }, [url]);
  useEffect(() => {
    mounted.current = true;
    void refresh();
    const timer = setInterval(() => void refresh(), 5000);
    const online = () => void refresh();
    window.addEventListener("online", online);
    return () => {
      mounted.current = false;
      clearInterval(timer);
      window.removeEventListener("online", online);
    };
  }, [refresh]);
  useEffect(() => {
    if (!sessionId) return;
    const local =
      typeof BroadcastChannel === "undefined"
        ? null
        : new BroadcastChannel(`live-presentation:${sessionId}`);
    const update = () => void refresh();
    if (local) {
      // Same-origin windows of the same teacher: the presenter sends the
      // snapshot its command just returned, so the projected window applies
      // it immediately instead of spending another round trip to read it.
      local.onmessage = ({ data }) => {
        if (data?.type === "snapshot" && data.snapshot && typeof data.snapshot === "object") {
          generation.current++;
          remotePendingSince.current = data.pending === true ? Date.now() : 0;
          setSnapshot(data.snapshot as PresentationSnapshot);
          setError(false);
          return;
        }
        update();
      };
    }
    window.addEventListener("live:presentation-refresh", update);
    return () => {
      local?.close();
      window.removeEventListener("live:presentation-refresh", update);
    };
  }, [sessionId, refresh]);
  const pushToOtherWindows = useCallback((value: PresentationSnapshot, pending = false) => {
    if (!sessionId || typeof BroadcastChannel === "undefined") return;
    const local = new BroadcastChannel(`live-presentation:${sessionId}`);
    local.postMessage({ type: "snapshot", snapshot: value, pending });
    local.close();
  }, [sessionId]);
  const command = useCallback(
    async (
      value: PresentationCommand,
      // Applied right before the request goes out, so the panel reflects the
      // click immediately instead of waiting on the round trip - the
      // authoritative response (or a revert on failure) always overwrites it,
      // so a guess that turns out wrong self-heals within one request rather
      // than drifting. Only supplied for commands whose outcome is a simple,
      // fully-known local field flip (see PresentationControls.tsx); commands
      // whose result depends on server-side computation (pagination totals,
      // "next question by sort") pass no patch and behave as before.
      optimisticPatch?: (previous: PresentationSnapshot) => PresentationSnapshot,
    ) => {
      if (writing.current) return false;
      writing.current = true;
      setActionError(false);
      setPending(true);
      // Only the very first read is worth waiting for (the optimistic patch
      // needs a snapshot to patch). A background poll in flight is not: the
      // generation bump below makes its older result land as a no-op.
      if (!snapshotRef.current) await readDone.current;
      generation.current++;
      if (!mounted.current) {
        writing.current = false;
        return false;
      }
      busy.current = true;
      let ok = false;
      const previous = snapshotRef.current;
      if (optimisticPatch && previous) {
        const guess = optimisticPatch(previous);
        setSnapshot(guess);
        // The projected window shows the same guess at once; the server's
        // answer (or a revert) follows over the same channel.
        pushToOtherWindows(guess, true);
      }
      try {
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(value),
          signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) throw new Error();
        const next = await response.json();
        generation.current++;
        if (mounted.current) {
          setSnapshot(next);
          setError(false);
        }
        pushToOtherWindows(next);
        ok = true;
      } catch {
        if (mounted.current) {
          setActionError(true);
          if (optimisticPatch && previous) {
            setSnapshot(previous);
            pushToOtherWindows(previous);
          }
        }
      } finally {
        busy.current = false;
        writing.current = false;
        if (mounted.current) setPending(false);
        void refresh();
      }
      return ok;
    },
    [url, refresh, pushToOtherWindows],
  );
  return {
    snapshot,
    error: error || actionError,
    pending,
    refresh,
    command,
    retry: () => {
      setActionError(false);
      void refresh();
    },
  };
}
