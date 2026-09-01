'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

export const REACTION_EMOJI: Record<string, string> = { applause: '👏', insight: '💡', resonate: '❤️', pause: '✋' };

interface FloatingReaction {
  id: string;
  kind: string;
  left: number;
}

const BURST_LIFETIME_MS = 2600;

// Shared by the presenter and audience pages so a reaction pops up as a
// rising, fading emoji wherever it's rendered - Zoom/Meet-style, visible to
// everyone in the session, not just a running count.
export function useReactionBursts() {
  const [reactions, setReactions] = useState<FloatingReaction[]>([]);

  const seen = useRef(new Map<string, number>());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const activeTimers = timers.current;
    return () => { activeTimers.forEach(clearTimeout); activeTimers.clear(); };
  }, []);

  const push = useCallback((kind: string, reactionId?: string) => {
    const now = Date.now();
    seen.current.forEach((time, key) => { if (now - time > 60000) seen.current.delete(key); });
    const id = reactionId ?? crypto.randomUUID();
    if (seen.current.has(id)) return;
    seen.current.set(id, now);
    if (seen.current.size > 500) seen.current.delete(seen.current.keys().next().value!);
    const left = 8 + Math.random() * 80;
    setReactions((previous) => [...previous.slice(-39), { id, kind, left }]);
    const timer = setTimeout(() => {
      setReactions((previous) => previous.filter((item) => item.id !== id));
      timers.current.delete(timer);
    }, BURST_LIFETIME_MS);
    timers.current.add(timer);
  }, []);

  return { reactions, push };
}

export function ReactionBurstOverlay({ reactions, className = 'absolute inset-0' }: { reactions: FloatingReaction[]; className?: string }) {
  return (
    <div aria-hidden="true" className={`pointer-events-none overflow-hidden ${className}`}>
      {reactions.map((item) => (
        <span key={item.id} className="live-reaction-float absolute bottom-2 text-3xl drop-shadow" style={{ left: `${item.left}%` }}>
          {REACTION_EMOJI[item.kind] ?? '👍'}
        </span>
      ))}
      <style>{`
        .live-reaction-float { animation: live-reaction-rise ${BURST_LIFETIME_MS}ms ease-out forwards; }
        @media (prefers-reduced-motion: reduce) { .live-reaction-float { animation: none; } }
        @keyframes live-reaction-rise {
          0% { transform: translateY(0) scale(0.85); opacity: 1; }
          12% { transform: translateY(-24px) scale(1.15); opacity: 1; }
          100% { transform: translateY(-260px) scale(1); opacity: 0; }
        }
      `}</style>
    </div>
  );
}
