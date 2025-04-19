'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

interface LearningRecord {
  id: number;
  student_id: string;
  student_name: string;
  lesson_id: number;
  started_at?: string;
  completed_at?: string | null;
  time_spent_seconds?: number;
  category?: string | null;
  // Add taipei fields
  started_at_taipei?: string;
  completed_at_taipei?: string;
  // Other alternative fields
  start_time?: string;
  end_time?: string;
  duration?: number;
}

export function TimeSpentChart({ records }: { records: LearningRecord[] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Format time in minutes for better readability
  const formatTimeSpent = (seconds: number) => {
    return Math.round(seconds / 60);
  };

  // Calculate time spent for each record
  const calculateTimeSpent = (record: LearningRecord): number => {
    // If time_spent_seconds is available, use it
    if (record.time_spent_seconds) return record.time_spent_seconds;
    
    // If duration is available, use it
    if (record.duration) return record.duration;
    
    // Try to calculate from start and end times
    const startTime = record.started_at_taipei || record.started_at || record.start_time;
    const endTime = record.completed_at_taipei || record.completed_at || record.end_time;
    
    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      return (end - start) / 1000; // Convert milliseconds to seconds
    }
    
    return 0; // Default if no data available
  };

  // Process data for the chart
  const chartData = records
    .filter(record => calculateTimeSpent(record) > 0) // Filter out records without time data
    .sort((a, b) => calculateTimeSpent(a) - calculateTimeSpent(b))
    .map(record => ({
      id: record.lesson_id,
      minutes: formatTimeSpent(calculateTimeSpent(record)),
      category: record.category || t('uncategorized')
    }));

  // If no data, show empty state
  if (!chartData.length) {
    return <div className="flex items-center justify-center h-full">{t('no_learning_data')}</div>;
  }

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 60,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis dataKey="id" label={{ value: t('lesson_id'), position: 'bottom', offset: 0 }} />
        <YAxis label={{ value: `${t('time')} (${t('minutes_text')})`, angle: -90, position: 'left' }} />
        <Tooltip 
          formatter={(value) => [`${value} ${t('minutes_text')}`, t('time_spent_tooltip')]}
          labelFormatter={(id) => `${t('lesson_text')} ${id}`}
        />
        <Bar dataKey="minutes" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
} 