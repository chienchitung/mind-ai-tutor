'use client';

import { useMemo } from 'react';

const CONFETTI_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#ffffff'];

export function Confetti({ burst }: { burst: number }) {
  const pieces = useMemo(() => Array.from({ length: 60 }, (_, index) => ({
    left: Math.random() * 100,
    drift: `${(Math.random() - 0.5) * 30}vw`,
    delay: `${Math.random() * 0.5}s`,
    fall: `${2.2 + Math.random() * 1.4}s`,
    color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
    size: 6 + Math.random() * 8,
  // A new burst re-rolls the pieces.
  })), [burst]);
  if (!burst) return null;
  return (
    <div key={burst} aria-hidden="true" className="pointer-events-none fixed inset-0 z-[80] overflow-hidden">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="classroom-confetti absolute top-0 rounded-sm"
          style={{
            left: `${piece.left}%`, width: piece.size, height: piece.size * 0.6, background: piece.color,
            ['--drift' as string]: piece.drift, ['--delay' as string]: piece.delay, ['--fall' as string]: piece.fall,
          }}
        />
      ))}
    </div>
  );
}
