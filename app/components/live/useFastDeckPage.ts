"use client";
import { useEffect, useRef, useState } from "react";

// After a page is saved, how long it stays on screen while waiting for a
// read that shows it, before giving way to whatever the server says.
const SAVED_HOLD_MS = 4000;

/** One write at a time; local navigation never waits for network reads.
 * The page turned to stays on screen until a read reflects it: a read that
 * resolves without new data (e.g. superseded by another read, such as the
 * one the page's own broadcast triggers) must not flash the old page back. */
export function useFastDeckPage(
  sessionId: string,
  deckUrl: string | null | undefined,
  serverPage: number,
  refresh: () => Promise<void>,
) {
  const [target, setTarget] = useState<{
    url: string;
    page: number;
    /** Written to the server; only waiting for a read to catch up. */
    saved?: boolean;
  } | null>(null);
  const [remote, setRemote] = useState<{ url: string; page: number } | null>(
    null,
  );
  const [error, setError] = useState(false);
  const wanted = useRef<{ url: string; page: number } | null>(null);
  const writing = useRef(false);
  const mounted = useRef(true);
  const currentDeck = useRef(deckUrl);
  currentDeck.current = deckUrl;
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!remote) return;
    if (remote.url !== deckUrl || remote.page === serverPage) {
      setRemote(null);
      return;
    }
    const timer = setTimeout(() => setRemote(null), 8000);
    return () => clearTimeout(timer);
  }, [remote, deckUrl, serverPage]);
  // A saved page gives way once the server shows it (or a different deck),
  // or after a short hold if a read never does (another window moved on).
  useEffect(() => {
    if (!target?.saved) return;
    if (target.url !== deckUrl || target.page === serverPage) {
      setTarget(null);
      return;
    }
    const timer = setTimeout(() => setTarget(null), SAVED_HOLD_MS);
    return () => clearTimeout(timer);
  }, [target, deckUrl, serverPage]);
  const preview = (url: string, page: number) => {
    if (url === deckUrl && Number.isInteger(page) && page > 0) {
      // A turn made in the other window is the latest one: it wins over a
      // turn made here, whether saved or still being saved (its write still
      // finishes, but no longer holds the screen).
      setTarget(null);
      setRemote({ url, page });
    }
  };
  const navigate = (page: number) => {
    if (!deckUrl) return;
    const next = { url: deckUrl, page };
    wanted.current = next;
    setTarget(next);
    setRemote(null);
    setError(false);
    if (writing.current) return;
    writing.current = true;
    void (async () => {
      try {
        while (wanted.current && mounted.current) {
          const request = wanted.current;
          if (request.url !== currentDeck.current) {
            wanted.current = null;
            break;
          }
          try {
            const response = await fetch(`/api/live-sessions/${sessionId}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ deckPage: request.page }),
              signal: AbortSignal.timeout(8000),
            });
            if (!response.ok) throw new Error("PAGE_SAVE_FAILED");
            if (wanted.current === request) {
              await refresh();
              if (wanted.current === request) {
                wanted.current = null;
                if (mounted.current)
                  setTarget((current) =>
                    current === request ? { ...request, saved: true } : current,
                  );
              }
            }
          } catch {
            if (wanted.current === request) {
              wanted.current = null;
              if (mounted.current) {
                setTarget(null);
                setError(true);
              }
              void refresh();
            }
          }
        }
      } finally {
        writing.current = false;
      }
    })();
  };
  return {
    page:
      target && target.url === deckUrl
        ? target.page
        : remote && remote.url === deckUrl
          ? remote.page
          : serverPage,
    navigate,
    preview,
    error,
  };
}
