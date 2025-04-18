'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import type { AnalysisResult } from '@/types/feedback';
import { useLanguage } from '@/contexts/LanguageContext';

interface SentimentPieChartProps {
  data: AnalysisResult['feedbacks'];
}

type SentimentType = '正面' | '中性' | '負面';

interface ChartDataType {
  name: string;
  value: number;
  percentage: string;
}

const COLORS = {
  positive: '#4ade80',
  neutral: '#93c5fd',
  negative: '#f87171'
} as const;

export function SentimentPieChart({ data }: SentimentPieChartProps) {
  const { t } = useLanguage();

  const sentimentLabels = {
    '正面': t('analysis.sentiment.positive'),
    '中性': t('analysis.sentiment.neutral'),
    '負面': t('analysis.sentiment.negative')
  } as const;

  // 計算情感分布
  const sentiments = data.reduce<Record<string, number>>((acc, curr) => {
    const sentiment = curr.sentiment as SentimentType;
    if (sentiment in sentimentLabels) {
      const translatedSentiment = sentimentLabels[sentiment];
      if (typeof translatedSentiment === 'string') {
        acc[translatedSentiment] = (acc[translatedSentiment] || 0) + 1;
      }
    }
    return acc;
  }, {});

  const total = Object.values(sentiments).reduce((sum, count) => sum + count, 0);

  const chartData: ChartDataType[] = Object.entries(sentiments).map(([name, value]) => ({
    name,
    value,
    percentage: ((value / total) * 100).toFixed(1)
  }));

  const getColor = (name: string): string => {
    if (name === t('analysis.sentiment.positive')) return COLORS.positive;
    if (name === t('analysis.sentiment.neutral')) return COLORS.neutral;
    if (name === t('analysis.sentiment.negative')) return COLORS.negative;
    return '#000000';
  };

  interface CustomTooltipProps {
    active?: boolean;
    payload?: Array<{
      payload: ChartDataType;
    }>;
  }

  const CustomTooltip = ({ active, payload }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-2 shadow-lg rounded-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900">
            {data.name}：{data.value} {t('analysis.reviews')} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={chartData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={undefined}
          outerRadius={120}
          innerRadius={60}
          fill="#8884d8"
          dataKey="value"
          paddingAngle={2}
        >
          {chartData.map((entry, index) => (
            <Cell 
              key={`cell-${index}`} 
              fill={getColor(entry.name)} 
            />
          ))}
        </Pie>
        <Tooltip content={<CustomTooltip />} />
        <Legend 
          verticalAlign="bottom" 
          height={36}
          wrapperStyle={{ color: '#1f2937' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}