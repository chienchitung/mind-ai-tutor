'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Maximize, Minimize, Pencil, Timer as TimerIcon, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  loadSettings, resizeGroups, saveSettings, type ClassroomToolSettings,
} from '@/lib/classroom-tools';
import { ClassroomTimer } from './ClassroomTimer';
import { GroupDraw } from './GroupDraw';

const CONFETTI_COLORS = ['#2563eb', '#f59e0b', '#10b981', '#ef4444', '#a855f7', '#ffffff'];

function Confetti({ burst }: { burst: number }) {
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

// The course timer and the random presentation order on one screen, which
// can go full screen for the projector. The course name, timer length, group
// count and names are saved in this browser for next time.
export function ClassroomToolsView() {
  const { language } = useLanguage();
  const zh = language === 'zh-TW';
  const [settings, setSettings] = useState<ClassroomToolSettings | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [confetti, setConfetti] = useState(0);
  const [timerRunning, setTimerRunning] = useState(false);
  const stageRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setSettings(loadSettings(zh)); }, []);
  useEffect(() => { if (settings) saveSettings(settings); }, [settings]);
  useEffect(() => {
    const sync = () => setFullscreen(document.fullscreenElement === stageRef.current);
    document.addEventListener('fullscreenchange', sync);
    return () => document.removeEventListener('fullscreenchange', sync);
  }, []);
  useEffect(() => {
    if (!confetti) return;
    const timer = window.setTimeout(() => setConfetti(0), 4500);
    return () => window.clearTimeout(timer);
  }, [confetti]);

  const update = useCallback((patch: Partial<ClassroomToolSettings>) => {
    setSettings((current) => (current ? { ...current, ...patch } : current));
  }, []);

  if (!settings) return null;

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen?.();
    else void stageRef.current?.requestFullscreen?.().catch(() => undefined);
  };

  return (
    <div ref={stageRef} className={cn('relative', fullscreen && 'overflow-y-auto bg-background p-6 sm:p-10')}>
      <Confetti burst={confetti} />
      <div className="mb-6 flex items-start gap-3">
        <label className="group relative min-w-0 flex-1">
          <span className="sr-only">{zh ? '課程名稱' : 'Course name'}</span>
          <input
            value={settings.courseName}
            maxLength={80}
            onChange={(event) => update({ courseName: event.target.value })}
            placeholder={zh ? '輸入課程名稱' : 'Course name'}
            className={cn(
              'w-full rounded-2xl border border-transparent bg-transparent px-3 py-2 font-black tracking-tight outline-none transition-colors placeholder:text-muted-foreground/50 hover:border-border focus:border-ring',
              fullscreen ? 'text-5xl sm:text-6xl' : 'text-3xl sm:text-4xl',
            )}
          />
          <Pencil aria-hidden="true" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </label>
        <Button variant="outline" className="h-11 shrink-0" onClick={toggleFullscreen}>
          {fullscreen ? <Minimize className="h-4 w-4 sm:mr-2" /> : <Maximize className="h-4 w-4 sm:mr-2" />}
          <span className="sr-only sm:not-sr-only">{fullscreen ? (zh ? '離開全螢幕' : 'Exit full screen') : (zh ? '全螢幕投影' : 'Full screen')}</span>
        </Button>
      </div>

      <div role="tablist" aria-label={zh ? '課堂工具' : 'Classroom tools'} className="mb-6 inline-flex rounded-xl border bg-muted/40 p-1">
        {([
          ['timer', zh ? '課程計時器' : 'Course timer', TimerIcon],
          ['groups', zh ? '抽籤報告順序' : 'Presentation order', Users],
        ] as const).map(([value, label, Icon]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`classroom-tab-${value}`}
            aria-selected={settings.tab === value}
            aria-controls={`classroom-panel-${value}`}
            onClick={() => update({ tab: value })}
            className={cn(
              'flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
              settings.tab === value ? 'bg-background text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground',
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            {value === 'timer' && timerRunning && settings.tab !== 'timer' && (
              <span className="h-2 w-2 rounded-full bg-emerald-500" aria-label={zh ? '倒數中' : 'Running'} />
            )}
          </button>
        ))}
      </div>

      {/* Both stay mounted: switching tabs never stops a running timer. */}
      <div role="tabpanel" id="classroom-panel-timer" aria-labelledby="classroom-tab-timer" hidden={settings.tab !== 'timer'}>
        <ClassroomTimer
          zh={zh}
          large={fullscreen}
          durationSeconds={settings.durationSeconds}
          muted={settings.muted}
          onDurationChange={(durationSeconds) => update({ durationSeconds })}
          onMutedChange={(muted) => update({ muted })}
          onFinish={() => setConfetti(Date.now())}
          onRunningChange={setTimerRunning}
        />
      </div>
      <div role="tabpanel" id="classroom-panel-groups" aria-labelledby="classroom-tab-groups" hidden={settings.tab !== 'groups'}>
        <GroupDraw
          zh={zh}
          large={fullscreen}
          groupNames={settings.groupNames}
          onGroupCountChange={(count) => update({ groupNames: resizeGroups(settings.groupNames, count, zh) })}
          onGroupNameChange={(index, name) => update({ groupNames: settings.groupNames.map((item, itemIndex) => (itemIndex === index ? name : item)) })}
        />
      </div>
    </div>
  );
}
