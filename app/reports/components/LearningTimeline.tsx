'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
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

export function LearningTimeline({ records }: { records: LearningRecord[] }) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  if (!records || records.length === 0) {
    return <div className="flex items-center justify-center h-full">{t('no_learning_data')}</div>;
  }

  // Get date field (fallback to alternatives with taipei fields prioritized)
  const getDateField = (record: LearningRecord) => 
    record.started_at_taipei || record.started_at || record.start_time;
  
  // Get completion field (fallback to alternatives with taipei fields prioritized)  
  const getCompletionField = (record: LearningRecord) => 
    record.completed_at_taipei || record.completed_at || record.end_time;
  
  // Calculate time spent for each record
  const calculateTimeSpent = (record: LearningRecord): number => {
    // If time_spent_seconds is available, use it
    if (record.time_spent_seconds) return record.time_spent_seconds;
    
    // If duration is available, use it
    if (record.duration) return record.duration;
    
    // Try to calculate from start and end times
    const startTime = getDateField(record);
    const endTime = getCompletionField(record);
    
    if (startTime && endTime) {
      const start = new Date(startTime).getTime();
      const end = new Date(endTime).getTime();
      return (end - start) / 1000; // Convert milliseconds to seconds
    }
    
    return 0; // Default if no data available
  };
  
  // Filter records that have a date field
  const recordsWithDates = records.filter(record => getDateField(record));
  
  if (recordsWithDates.length === 0) {
    return <div className="flex items-center justify-center h-full">{t('no_learning_data')}</div>;
  }

  // Format date for chart display
  const formatDateForChart = (dateObj: Date) => {
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // Process and sort data by date
  const chartData = recordsWithDates
    .sort((a, b) => {
      const dateA = getDateField(a);
      const dateB = getDateField(b);
      if (!dateA || !dateB) return 0;
      return new Date(dateA).getTime() - new Date(dateB).getTime();
    })
    .map((record, index) => {
      const dateField = getDateField(record);
      if (!dateField) return null;
      
      const date = new Date(dateField);
      return {
        id: record.lesson_id,
        date: formatDateForChart(date),
        minutes: Math.round(calculateTimeSpent(record) / 60),
        completed: getCompletionField(record) ? 1 : 0,
        index: index + 1 // Sequence number
      };
    })
    .filter(Boolean); // Remove null entries

  // Format date for tooltip
  const formatDate = (date: string) => {
    return date;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 60,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis 
          dataKey="date" 
          label={{ value: t('date'), position: 'bottom', offset: 0 }}
          tickFormatter={formatDate}
        />
        <YAxis 
          label={{ value: `${t('time')} (${t('minutes_text')})`, angle: -90, position: 'left' }}
        />
        <Tooltip
          labelFormatter={(label) => `${t('date')}: ${label}`}
          formatter={(value, name) => {
            if (name === 'minutes') return [`${value} ${t('minutes_text')}`, t('time_spent_tooltip')];
            return [value, name];
          }}
        />
        <Line 
          type="monotone" 
          dataKey="minutes" 
          stroke="#8884d8" 
          strokeWidth={2}
          activeDot={{ r: 8 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
} 