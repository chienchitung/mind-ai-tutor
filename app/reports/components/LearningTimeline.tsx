'use client';

import { useMemo } from 'react';
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/lib/translations';
import {
  activityOverTime, bucketLabel, bucketRangeLabel, formatDuration, type ActivityBucket, type ChartRecord,
} from '../lib/chart-data';
import { AXIS_TICK, CHART, ChartEmpty, ChartTooltipCard, MAX_BAR_SIZE, truncateLabel } from './chart-kit';

const GRANULARITY_LABEL = {
  day: { zh: '每日', en: 'Daily' },
  week: { zh: '每週', en: 'Weekly' },
  month: { zh: '每月', en: 'Monthly' },
} as const;

export function LearningTimeline({
  records,
  titleOf,
}: {
  records: ChartRecord[];
  titleOf: (lessonId: string) => string;
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  const chinese = language === 'zh-TW';
  const { granularity, buckets } = useMemo(() => activityOverTime(records, titleOf), [records, titleOf]);

  if (!buckets.length) return <ChartEmpty>{t('no_learning_data')}</ChartEmpty>;

  const data = buckets.map(bucket => ({ ...bucket, label: bucketLabel(bucket, granularity) }));
  const unit = GRANULARITY_LABEL[granularity][chinese ? 'zh' : 'en'];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        {chinese ? `${unit}學習時間（分鐘），沒有學習的期間顯示為空白` : `${unit} learning minutes; periods without activity stay empty`}
      </p>
      <div className="h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke={CHART.grid} />
            <XAxis
              dataKey="label"
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={{ stroke: CHART.axis }}
              interval="preserveStartEnd"
              minTickGap={16}
            />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} width={40} allowDecimals={false} />
            <Tooltip
              cursor={{ fill: 'hsl(var(--muted))', opacity: 0.6 }}
              content={({ active, payload }) => {
                const bucket = payload?.[0]?.payload as ActivityBucket | undefined;
                if (!active || !bucket) return null;
                return (
                  <ChartTooltipCard
                    title={bucketRangeLabel(bucket, granularity, chinese)}
                    rows={bucket.sessions === 0
                      ? [{ label: chinese ? '沒有學習紀錄' : 'No activity', value: '' }]
                      : [
                          { label: chinese ? '學習時間' : 'Learning time', value: formatDuration(bucket.minutes * 60, chinese) },
                          ...bucket.lessons.slice(0, 4).map(lesson => ({
                            label: truncateLabel(lesson.label, 14),
                            value: formatDuration(lesson.minutes * 60, chinese),
                          })),
                        ]}
                  />
                );
              }}
            />
            <Bar dataKey="minutes" fill={CHART.series} radius={[4, 4, 0, 0]} maxBarSize={MAX_BAR_SIZE} isAnimationActive={false} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
