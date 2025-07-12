import { useEffect, useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';
import { useLanguage } from '@/app/contexts/LanguageContext';
import { useTranslation } from '@/utils/translations';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

interface AIInteractionChartProps {
  records: Array<{
    lesson_id: string;
    question_count: number;
  }>;
  lessons: Array<{
    id: string;
    title: string;
  }>;
  courseOrder: string[];
}

export function AIInteractionChart({ records, lessons, courseOrder }: AIInteractionChartProps) {
  const { language } = useLanguage();
  const { t } = useTranslation(language);

  const chartData = useMemo(() => {
    // Group question counts by lesson
    const lessonCounts = records.reduce((acc, record) => {
      const lessonId = record.lesson_id;
      if (!acc[lessonId]) {
        acc[lessonId] = 0;
      }
      acc[lessonId] += record.question_count;
      return acc;
    }, {} as Record<string, number>);

    // Map lesson IDs to titles and get counts in course order
    const orderedData = courseOrder.map(title => {
      const lesson = lessons.find(l => l.title === title);
      return lesson ? (lessonCounts[lesson.id] || 0) : 0;
    });

    return {
      labels: courseOrder,
      datasets: [
        {
          label: t('ai_interaction_count'),
          data: orderedData,
          backgroundColor: 'rgba(147, 51, 234, 0.5)',
          borderColor: 'rgb(147, 51, 234)',
          borderWidth: 1,
        },
      ],
    };
  }, [records, lessons, courseOrder, t]);

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        beginAtZero: true,
        ticks: {
          stepSize: 1,
        },
      },
    },
    plugins: {
      legend: {
        position: 'top' as const,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            return `${t('ai_interaction_count')}: ${context.raw}`;
          }
        }
      }
    },
  };

  return <Bar data={chartData} options={options} />;
} 