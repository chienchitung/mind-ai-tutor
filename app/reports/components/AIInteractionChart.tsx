'use client';

import { useMemo } from 'react';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import { questionsByLesson, type QuestionCountRow } from '../lib/chart-data';
import { ChartEmpty, RankedBarChart } from './chart-kit';

export function AIInteractionChart({
  records,
  titleOf,
}: {
  records: QuestionCountRow[];
  titleOf: (lessonId: string) => string;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const chinese = language === 'zh-TW';
  const data = useMemo(() => questionsByLesson(records, titleOf), [records, titleOf]);
  const total = data.reduce((sum, item) => sum + item.value, 0);

  if (!data.length) {
    return <ChartEmpty>{chinese ? '這段期間沒有和 AI 助教互動的紀錄' : 'No AI tutor interactions in this period'}</ChartEmpty>;
  }

  return (
    <RankedBarChart
      data={data}
      allowDecimals={false}
      formatValue={value => (chinese ? `${value} 次` : String(value))}
      tooltipRows={datum => [
        { label: t('ai_interaction_count'), value: String(datum.value) },
        { label: chinese ? '佔全部互動' : 'Share of all', value: `${Math.round((datum.value / total) * 100)}%` },
      ]}
    />
  );
}
