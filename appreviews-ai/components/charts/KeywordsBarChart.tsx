'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { Keyword } from '@/types/feedback';
import { useLanguage } from '@/contexts/LanguageContext';

interface KeywordsBarChartProps {
  keywords: Keyword[];
}

export const KeywordsBarChart = ({ keywords }: KeywordsBarChartProps) => {
  const { t } = useLanguage();
  
  const total = keywords.reduce((sum, keyword) => sum + keyword.count, 0);

  const sortedData = [...keywords]
    .sort((a, b) => b.count - a.count)
    .slice(0, 20)
    .map(item => ({
      ...item,
      percentage: ((item.count / total) * 100).toFixed(1)
    }));

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-2 shadow-lg rounded-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900">
            {data.word}：{data.count} {t('analysis.times')} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={sortedData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
      >
        <XAxis type="number" stroke="#1f2937" />
        <YAxis 
          dataKey="word" 
          type="category" 
          width={80}
          style={{
            fontSize: '0.75rem',
            fill: '#1f2937'
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <Bar 
          dataKey="count"
          fill="#60a5fa"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}; 