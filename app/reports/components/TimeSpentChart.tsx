'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { formatDuration, timeByLesson, type ChartRecord } from '../lib/chart-data';
import { ChartEmpty, RankedBarChart } from './chart-kit';

export function TimeSpentChart({
  records,
  titleOf,
}: {
  records: ChartRecord[];
  titleOf: (lessonId: string) => string;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const chinese = language === 'zh-TW';
  const data = useMemo(() => timeByLesson(records, titleOf), [records, titleOf]);

  if (!data.length) return <ChartEmpty>{t('no_learning_data')}</ChartEmpty>;

  return (
    <RankedBarChart
      data={data}
      // Bar tips stay in the axis unit (minutes) so they're short and
      // comparable; the tooltip has the hours-and-minutes breakdown.
      formatValue={minutes => (minutes < 1
        ? formatDuration(minutes * 60, chinese)
        : chinese ? `${Math.round(minutes)} 分` : `${Math.round(minutes)}m`)}
      axisFormatter={minutes => (chinese ? `${minutes} 分` : `${minutes}m`)}
      tooltipRows={datum => {
        const lesson = data.find(item => item.key === datum.key)!;
        return [
          { label: chinese ? '總學習時間' : 'Total time', value: formatDuration(lesson.seconds, chinese) },
          { label: chinese ? '學習次數' : 'Sessions', value: String(lesson.sessions) },
          { label: chinese ? '平均每次' : 'Per session', value: formatDuration(lesson.seconds / lesson.sessions, chinese) },
        ];
      }}
    />
  );
}
