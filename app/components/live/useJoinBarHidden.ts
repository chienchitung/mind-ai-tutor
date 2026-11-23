"use client";
import { useCallback, useEffect, useState } from "react";

// Whether the join bar (link, code, QR) under the projected slide is hidden.
// Kept in localStorage, so it is remembered per browser and shared by the
// teacher's windows: the presenter page's switch hides it on the projector
// window at once (the storage event reaches the other window), and the
// projector's own toolbar button updates the presenter page the same way.
export const JOIN_BAR_KEY = "live:join-bar-hidden";

function read(): boolean {
  try {
    return window.localStorage.getItem(JOIN_BAR_KEY) === "1";
  } catch {
    return false;
  }
}

export function useJoinBarHidden(): [boolean, (hidden: boolean) => void] {
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    setHidden(read());
    const sync = (event: StorageEvent) => {
      if (event.key === JOIN_BAR_KEY || event.key === null) setHidden(read());
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  const set = useCallback((next: boolean) => {
    setHidden(next);
    try {
      window.localStorage.setItem(JOIN_BAR_KEY, next ? "1" : "0");
    } catch {
      /* preference only: this window still follows the click */
    }
  }, []);
  return [hidden, set];
}
