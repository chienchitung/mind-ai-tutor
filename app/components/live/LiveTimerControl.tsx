'use client';

import { useState } from 'react';
import { EyeOff, Minus, Pause, Play, Plus, RotateCcw, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { MAX_TIMER_MINUTES, TIMER_PRESETS_MINUTES } from '@/lib/classroom-tools';
import type { LiveTimer, TimerAction } from '@/lib/live-timer';
import { LiveTimerBadge } from './LiveTimerBadge';

// The teacher's controls for the class timer, which the projector and the
// students' pages show while it is set.
export function LiveTimerControl({
  zh, timer, remaining, running, finished, available, onCommand,
}: {
  zh: boolean;
  timer: LiveTimer | null;
  remaining: number;
  running: boolean;
  finished: boolean;
  available: boolean;
  onCommand: (action: TimerAction) => Promise<boolean>;
}) {
  const [busy, setBusy] = useState(false);
  const [customMinutes, setCustomMinutes] = useState('');
  const send = async (action: TimerAction) => {
    if (busy) return;
    setBusy(true);
    await onCommand(action);
    setBusy(false);
  };
  const setLength = async (seconds: number) => {
    await send({ action: 'set', seconds });
  };

  return (
    <Card>
      <CardContent className="p-4 md:p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <Timer className="h-4 w-4 text-muted-foreground" />
            {zh ? '課堂計時器' : 'Class timer'}
          </h2>
          {timer && (
            <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-muted-foreground" disabled={busy} onClick={() => void send({ action: 'clear' })}>
              <EyeOff className="mr-1.5 h-3.5 w-3.5" />
              {zh ? '隱藏' : 'Hide'}
            </Button>
          )}
        </div>
        {!available ? (
          <p className="text-xs leading-5 text-muted-foreground">
            {zh ? '計時器需要先完成資料庫更新（migration）才能使用。' : 'The class timer needs its database update (migration) first.'}
          </p>
        ) : (
          <>
            {timer ? (
              <div className="flex flex-col items-center gap-3">
                <LiveTimerBadge zh={zh} size="lg" remaining={remaining} running={running} finished={finished} />
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={busy} aria-label={zh ? '減少 1 分鐘' : 'Minus 1 minute'} onClick={() => void send({ action: 'adjust', seconds: -60 })}>
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="icon"
                    className="h-11 w-11 rounded-full"
                    disabled={busy}
                    aria-label={running ? (zh ? '暫停計時' : 'Pause timer') : (zh ? '開始計時' : 'Start timer')}
                    onClick={() => void send({ action: running ? 'pause' : 'start' })}
                  >
                    {running ? <Pause className="h-5 w-5" /> : <Play className="ml-0.5 h-5 w-5" />}
                  </Button>
                  <Button variant="outline" size="icon" className="h-9 w-9" disabled={busy} aria-label={zh ? '增加 1 分鐘' : 'Plus 1 minute'} onClick={() => void send({ action: 'adjust', seconds: 60 })}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-9 w-9" disabled={busy} aria-label={zh ? '重設計時' : 'Reset timer'} onClick={() => void send({ action: 'reset' })}>
                    <RotateCcw className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ) : (
              <p className="mb-1 text-xs leading-5 text-muted-foreground">
                {zh ? '選一個時長，投影畫面和學生手機都會顯示倒數。' : 'Pick a length: the projector and students’ phones show the countdown.'}
              </p>
            )}
            <div className="mt-3 flex flex-wrap items-center justify-center gap-1.5">
              {TIMER_PRESETS_MINUTES.map((minutes) => (
                <Button
                  key={minutes}
                  size="sm"
                  variant={timer?.durationSeconds === minutes * 60 ? 'secondary' : 'outline'}
                  disabled={busy || running}
                  onClick={() => void setLength(minutes * 60)}
                >
                  {zh ? `${minutes} 分` : `${minutes}m`}
                </Button>
              ))}
              <form
                className="flex items-center gap-1"
                onSubmit={(event) => {
                  event.preventDefault();
                  const minutes = Number(customMinutes);
                  if (minutes > 0 && minutes <= MAX_TIMER_MINUTES) { void setLength(Math.round(minutes * 60)); setCustomMinutes(''); }
                }}
              >
                <Input
                  type="number"
                  inputMode="decimal"
                  min={0.5}
                  max={MAX_TIMER_MINUTES}
                  step={0.5}
                  value={customMinutes}
                  disabled={busy || running}
                  onChange={(event) => setCustomMinutes(event.target.value)}
                  className="h-8 w-16"
                  aria-label={zh ? '自訂分鐘數' : 'Custom minutes'}
                  placeholder={zh ? '分' : 'min'}
                />
                <Button type="submit" size="sm" variant="outline" disabled={busy || running || !(Number(customMinutes) > 0)}>
                  {zh ? '設定' : 'Set'}
                </Button>
              </form>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
