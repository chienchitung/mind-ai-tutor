'use client';

import { useEffect, useRef, useState } from 'react';
import { Shuffle, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { MAX_GROUPS, MIN_GROUPS, clampGroupCount, shuffle } from '@/lib/classroom-tools';

const SHUFFLE_STEPS = 14;
const SHUFFLE_STEP_MS = 80;

// Draws a random presentation order for the class's groups. The count and
// every group's name are editable; changing them clears the last draw.
export function GroupDraw({
  zh, groupNames, large, onGroupCountChange, onGroupNameChange, onOrderChange,
}: {
  zh: boolean;
  groupNames: string[];
  large: boolean;
  onGroupCountChange: (count: number) => void;
  onGroupNameChange: (index: number, name: string) => void;
  /** Mirrors the draw to the projector window. */
  onOrderChange?: (order: string[], drawing: boolean) => void;
}) {
  const [order, setOrder] = useState<string[]>([]);
  const [drawing, setDrawing] = useState(false);
  const [countDraft, setCountDraft] = useState(String(groupNames.length));
  const timerRef = useRef<number | null>(null);

  useEffect(() => { setCountDraft(String(groupNames.length)); }, [groupNames.length]);
  useEffect(() => { onOrderChange?.(order, drawing); }, [order, drawing, onOrderChange]);
  useEffect(() => () => { if (timerRef.current !== null) window.clearInterval(timerRef.current); }, []);

  const names = groupNames.map((name, index) => name.trim() || (zh ? `第 ${index + 1} 組` : `Group ${index + 1}`));
  const draw = () => {
    if (drawing) return;
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) { setOrder(shuffle(names)); return; }
    setDrawing(true);
    let step = 0;
    timerRef.current = window.setInterval(() => {
      step += 1;
      setOrder(shuffle(names));
      if (step >= SHUFFLE_STEPS) {
        if (timerRef.current !== null) window.clearInterval(timerRef.current);
        timerRef.current = null;
        setDrawing(false);
      }
    }, SHUFFLE_STEP_MS);
  };

  const commitCount = (value: string) => {
    const count = clampGroupCount(Number(value));
    setCountDraft(String(count));
    if (count !== groupNames.length) { setOrder([]); onGroupCountChange(count); }
  };

  return (
    <section aria-label={zh ? '隨機抽籤報告順序' : 'Random presentation order'} className="flex flex-col rounded-3xl border bg-card p-6 shadow-sm sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
          <Users className="h-4 w-4" />{zh ? '隨機抽籤報告順序' : 'Random presentation order'}
        </h2>
        <label className="flex items-center gap-2 text-sm">
          {zh ? '組數' : 'Groups'}
          <Input
            type="number"
            min={MIN_GROUPS}
            max={MAX_GROUPS}
            value={countDraft}
            disabled={drawing}
            onChange={(event) => setCountDraft(event.target.value)}
            onBlur={(event) => commitCount(event.target.value)}
            onKeyDown={(event) => { if (event.key === 'Enter') commitCount((event.target as HTMLInputElement).value); }}
            className="h-9 w-20"
          />
        </label>
      </div>

      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {groupNames.map((name, index) => (
          <li key={index} className="flex items-center gap-2">
            <span className="w-6 shrink-0 text-right font-mono text-xs text-muted-foreground">{index + 1}</span>
            <Input
              value={name}
              maxLength={40}
              disabled={drawing}
              onChange={(event) => { setOrder([]); onGroupNameChange(index, event.target.value); }}
              aria-label={zh ? `第 ${index + 1} 組名稱` : `Name of group ${index + 1}`}
              className="h-9"
            />
          </li>
        ))}
      </ol>

      <Button size="lg" className="mt-5 h-12 text-base" disabled={drawing} onClick={draw}>
        <Shuffle className="mr-2 h-5 w-5" />
        {drawing ? (zh ? '抽籤中…' : 'Drawing…') : order.length ? (zh ? '重新抽籤' : 'Draw again') : (zh ? '抽出報告順序' : 'Draw the order')}
      </Button>

      {order.length > 0 && (
        <div className="mt-5 rounded-2xl bg-primary p-4 text-primary-foreground sm:p-5">
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest opacity-80" role="status">
            {drawing ? (zh ? '抽籤中…' : 'Drawing…') : (zh ? '報告順序' : 'Presentation order')}
          </p>
          <ol aria-label={zh ? '報告順序' : 'Presentation order'} className={cn('grid gap-2', large && 'sm:grid-cols-2')}>
            {order.map((name, index) => (
              <li key={`${index}-${name}`} className={cn('flex items-center gap-3 rounded-xl bg-white/10 px-3 py-2', drawing && 'opacity-70')}>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white font-black text-primary">{index + 1}</span>
                <span className={cn('min-w-0 break-words font-bold', large ? 'text-3xl' : 'text-lg')}>{name}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </section>
  );
}
