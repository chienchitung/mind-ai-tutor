'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';
import { getLessonNumber } from '@/lib/utils';

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

// Add interface for Lesson
interface Lesson {
  id: string;
  title: string;
}

export function TimeSpentChart({ 
  records, 
  lessons = [],
  courseOrder = [] // Array of course titles in the order they should be displayed
}: { 
  records: LearningRecord[],
  lessons?: Lesson[],
  courseOrder?: string[]
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Format time in minutes for better readability
  const formatTimeSpent = (seconds: number) => {
    return Math.round(seconds / 60);
  };

  // Function to get lesson title by ID
  const getLessonTitle = (lessonId: number | string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    return lesson ? lesson.title : lessonId;
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

  // Get the course order based on the courseOrder prop or create a default order map
  const getCourseSortOrder = (title: string | number): number => {
    if (courseOrder.length === 0) {
      // Fallback to default order if courseOrder is not provided
      return 999;
    }
    
    const titleStr = String(title);
    const index = courseOrder.indexOf(titleStr);
    return index >= 0 ? index : 999; // If found in the order array, use that index, otherwise put at the end
  };

  // Process data for the chart
  const chartData = records
    .filter(record => calculateTimeSpent(record) > 0) // Filter out records without time data
    .map(record => {
      const title = getLessonTitle(record.lesson_id);
      return {
        id: record.lesson_id,
        lessonTitle: title,
        minutes: formatTimeSpent(calculateTimeSpent(record)),
        category: record.category || t('uncategorized'),
        order: getCourseSortOrder(title)
      };
    })
    .sort((a, b) => a.order - b.order); // Sort by order determined from the recent activities

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
        <XAxis 
          dataKey="lessonTitle" 
          tick={{ fontSize: 12 }}
          angle={-45}
          textAnchor="end"
        />
        <YAxis label={{ value: `${t('time')} (${t('minutes_text')})`, angle: -90, position: 'left' }} />
        <Tooltip 
          formatter={(value) => [`${value} ${t('minutes_text')}`, t('time_spent_tooltip')]}
          labelFormatter={(name) => `${t('lesson_text')}: ${name}`}
        />
        <Bar dataKey="minutes" fill="#8884d8" />
      </BarChart>
    </ResponsiveContainer>
  );
} 