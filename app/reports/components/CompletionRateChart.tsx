'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface LearningStats {
  totalRecords: number;
  totalTimeSpent: number;
  averageTimePerLesson: number;
  completedLessons: number;
  completionRate: number;
  categoryCounts: Record<string, number>;
  lastActive: string | null;
}

export function CompletionRateChart({ stats }: { stats: LearningStats | null }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  if (!stats) {
    return <div className="flex items-center justify-center h-full">{t('no_learning_data')}</div>;
  }

  const { completedLessons, totalRecords } = stats;
  const inProgressLessons = totalRecords - completedLessons;

  const data = [
    { name: t('completed_text'), value: completedLessons, color: '#4ADE80' },
    { name: t('in_progress_text'), value: inProgressLessons, color: '#FB923C' },
  ];

  // If no lessons, show empty state
  if (totalRecords === 0) {
    return <div className="flex items-center justify-center h-full">{t('no_learning_data')}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.color} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} ${t('lessons_count')}`, '']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
} 