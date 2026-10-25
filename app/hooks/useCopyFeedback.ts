'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

// Copy-to-clipboard with a short "copied" state that every click restarts.
// `tick` changes on each successful copy, so keying the confirmation icon on
// it replays its animation even when the button already says "copied".
// Clipboard failures are thrown to the caller, which decides how to report.
export function useCopyFeedback(duration = 1800) {
  const [state, setState] = useState<{ key: string | null; tick: number }>({ key: null, tick: 0 });
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = useCallback(async (text: string, key = 'default') => {
    await navigator.clipboard.writeText(text);
    window.clearTimeout(timer.current);
    setState((previous) => ({ key, tick: previous.tick + 1 }));
    timer.current = window.setTimeout(() => setState((previous) => ({ ...previous, key: null })), duration);
  }, [duration]);

  const reset = useCallback(() => {
    window.clearTimeout(timer.current);
    setState((previous) => ({ ...previous, key: null }));
  }, []);

  return {
    copy,
    reset,
    tick: state.tick,
    isCopied: (key = 'default') => state.key === key,
  };
}
