"use client";
import { useEffect, useRef, useState } from "react";
/** One write at a time; local navigation never waits for network reads. */
export function useFastDeckPage(
  sessionId: string,
  deckUrl: string | null | undefined,
  serverPage: number,
  refresh: () => Promise<void>,
) {
  const [target, setTarget] = useState<{ url: string; page: number } | null>(
    null,
  );
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
  const preview = (url: string, page: number) => {
    if (url === deckUrl && Number.isInteger(page) && page > 0)
      setRemote({ url, page });
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
                if (mounted.current) setTarget(null);
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
