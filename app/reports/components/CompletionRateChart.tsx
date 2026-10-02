'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { completionByLesson, isCompleted, type ChartRecord } from '../lib/chart-data';
import { CHART, ChartEmpty } from './chart-kit';

// Completed vs not-yet-completed is one ratio, so it's shown as a number and
// a meter rather than a two-slice pie; the per-lesson rows below show where
// the unfinished sessions are.
function Meter({ completed, total, height }: { completed: number; total: number; height: string }) {
  const done = total ? (completed / total) * 100 : 0;
  return (
    <div className={`flex w-full gap-[2px] ${height}`} aria-hidden="true">
      {completed > 0 && (
        <span className={completed === total ? 'flex-1 rounded-r-[4px]' : undefined} style={{ width: `${done}%`, background: CHART.series }} />
      )}
      {completed < total && (
        <span className="flex-1 rounded-r-[4px]" style={{ background: CHART.seriesSoft }} />
      )}
    </div>
  );
}

function LegendKey({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-[2px]" style={{ background: color }} aria-hidden="true" />
      {label}
    </span>
  );
}

export function CompletionRateChart({
  records,
  titleOf,
}: {
  records: ChartRecord[];
  titleOf: (lessonId: string) => string;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const chinese = language === 'zh-TW';
  const lessons = useMemo(() => completionByLesson(records, titleOf), [records, titleOf]);

  if (!records.length) return <ChartEmpty>{t('no_learning_data')}</ChartEmpty>;

  const total = records.length;
  const completed = records.filter(isCompleted).length;
  const rate = Math.round((completed / total) * 100);

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-1">
          <div>
            <p className="text-sm text-muted-foreground">{chinese ? '整體完成率' : 'Overall completion'}</p>
            <p className="text-5xl font-semibold tracking-tight text-foreground">{rate}%</p>
          </div>
          <p className="pb-1 text-sm text-muted-foreground">
            {chinese ? `${total} 次學習中完成 ${completed} 次` : `${completed} of ${total} sessions completed`}
          </p>
        </div>
        <Meter completed={completed} total={total} height="h-3" />
        <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted-foreground">
          <LegendKey color={CHART.series} label={chinese ? `已完成 ${completed} 次` : `Completed ${completed}`} />
          <LegendKey color={CHART.seriesSoft} label={chinese ? `未完成 ${total - completed} 次` : `Not completed ${total - completed}`} />
        </div>
      </div>

      <div>
        <h4 className="app-kicker mb-3">{chinese ? '各課程完成狀況' : 'By lesson'}</h4>
        <ul className="space-y-3">
          {lessons.map(lesson => (
            <li key={lesson.key} className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_minmax(0,1fr)_auto]">
              <span className="truncate text-foreground/85" title={lesson.label}>{lesson.label}</span>
              <Meter completed={lesson.completed} total={lesson.total} height="h-2.5" />
              <span className="text-right text-xs tabular-nums text-muted-foreground">
                {chinese ? `${lesson.completed}/${lesson.total} 次` : `${lesson.completed}/${lesson.total}`}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
