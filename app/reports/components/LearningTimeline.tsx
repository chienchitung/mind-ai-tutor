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

// Add interface for Lesson
interface Lesson {
  id: string;
  title: string;
}

export function LearningTimeline({ 
  records, 
  lessons = [],
  courseOrder = []
}: { 
  records: LearningRecord[],
  lessons?: Lesson[],
  courseOrder?: string[]
}) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);
  
  // Function to get lesson title by ID
  const getLessonTitle = (lessonId: number | string) => {
    const lesson = lessons.find(l => l.id === lessonId);
    return lesson ? lesson.title : lessonId;
  };

  // Get the course order based on the courseOrder prop
  const getCourseSortOrder = (title: string | number): number => {
    if (courseOrder.length === 0) {
      // Fallback to default order if courseOrder is not provided
      return 999;
    }
    
    const titleStr = String(title);
    const index = courseOrder.indexOf(titleStr);
    return index >= 0 ? index : 999; // If found in the order array, use that index, otherwise put at the end
  };
  
  // Store original dates for sorting
  const dateMap = new Map();

  // Format dates for the timeline (M/D format)
  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  // Find and sort all dates chronologically
  const dateObjects = records
    .filter(record => record.started_at || record.start_time || record.started_at_taipei)
    .map(record => {
      const startDate = record.started_at_taipei || record.started_at || record.start_time;
      return startDate ? new Date(startDate) : null;
    })
    .filter(Boolean as any)
    .sort((a, b) => a!.getTime() - b!.getTime()); // Sort chronologically, earliest first

  // Create map of formatted date strings to their original Date objects for sorting
  dateObjects.forEach(dateObj => {
    const formattedDate = formatDate(dateObj!.toISOString());
    if (!dateMap.has(formattedDate)) {
      dateMap.set(formattedDate, dateObj);
    }
  });

  // Get unique formatted dates
  const uniqueDateStrings = Array.from(dateMap.keys());
  
  // Create properly sorted date entries
  const sortedDates = uniqueDateStrings
    .map(dateStr => ({ 
      dateStr, 
      dateObj: dateMap.get(dateStr) 
    }))
    .sort((a, b) => a.dateObj!.getTime() - b.dateObj!.getTime())
    .map(item => item.dateStr);

  // Process data for the chart - group by lesson
  const lessonIdsSet = new Set(records.map(record => record.lesson_id));
  const lessonIds = Array.from(lessonIdsSet);
  
  // Sort lessons according to the provided order
  const sortedLessonIds = [...lessonIds].sort((a, b) => {
    const titleA = getLessonTitle(a);
    const titleB = getLessonTitle(b);
    return getCourseSortOrder(titleA) - getCourseSortOrder(titleB);
  });
  
  // Create chart data structure
  const chartData = sortedDates.map((dateString, index) => {
    const dataPoint: any = { 
      date: dateString,
      sortIndex: index // Add index for preserving the sort order
    };
    
    sortedLessonIds.forEach(lessonId => {
      const lessonsOnDate = records.filter(record => {
        const recordDate = record.started_at_taipei || record.started_at || record.start_time;
        return record.lesson_id === lessonId && recordDate && formatDate(recordDate) === dateString;
      });
      
      // Sum up time spent for this lesson on this date
      const timeSpent = lessonsOnDate.reduce((total, record) => {
        let timeValue = 0;
        
        if (record.time_spent_seconds) {
          timeValue = record.time_spent_seconds / 60; // Convert to minutes
        } else if (record.duration) {
          timeValue = record.duration / 60; // Convert to minutes
        } else if ((record.completed_at_taipei || record.completed_at || record.end_time) && 
                  (record.started_at_taipei || record.started_at || record.start_time)) {
          const start = new Date(record.started_at_taipei || record.started_at || record.start_time!).getTime();
          const end = new Date(record.completed_at_taipei || record.completed_at || record.end_time!).getTime();
          timeValue = (end - start) / (1000 * 60); // Convert ms to minutes
        }
        
        return total + timeValue;
      }, 0);
      
      const lessonKey = `lesson_${lessonId}`;
      dataPoint[lessonKey] = Math.round(timeSpent);
      dataPoint[`${lessonKey}_name`] = getLessonTitle(lessonId);
    });
    
    return dataPoint;
  });

  // If no data, show empty state
  if (!chartData.length || !sortedLessonIds.length) {
    return <div className="flex items-center justify-center h-full">{t('no_learning_data')}</div>;
  }

  // Generate lines for each lesson with consistent colors
  const colors = ['#8884d8', '#82ca9d', '#ffc658', '#ff8042', '#0088fe', '#00C49F', '#FFBB28', '#FF8042'];
  
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={chartData}
        margin={{
          top: 20,
          right: 30,
          left: 20,
          bottom: 20,
        }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis 
          dataKey="date"
          type="category"
          // Sort explicitly to ensure chronological order
          ticks={sortedDates}
          // Avoid automatic reversal of ticks
          reversed={false}
        />
        <YAxis label={{ value: `${t('time')} (${t('minutes_text')})`, angle: -90, position: 'left' }} />
        <Tooltip 
          formatter={(value, name, props) => {
            // Check if name is a string before using split
            if (typeof name === 'string') {
              const lessonId = name.split('_')[1];
              const lessonName = props.payload[`lesson_${lessonId}_name`];
              return [`${value} ${t('minutes_text')}`, lessonName];
            }
            return [`${value} ${t('minutes_text')}`, name];
          }}
        />
        {sortedLessonIds.map((lessonId, index) => (
          <Line
            key={`line-${lessonId}`}
            type="monotone"
            dataKey={`lesson_${lessonId}`}
            stroke={colors[index % colors.length]}
            name={`lesson_${lessonId}`}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
} 