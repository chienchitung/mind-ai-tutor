'use client';

import { useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  ChartData,
  ChartOptions,
} from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

interface Progress {
  created_at: string;
  subject: string;
  score: number;
}

interface StudentProgressChartProps {
  progress: Progress[];
  subject?: string;
}

export function StudentProgressChart({
  progress,
  subject,
}: StudentProgressChartProps) {
  const chartRef = useRef<ChartJS>(null);

  const filteredProgress = subject
    ? progress.filter((p) => p.subject === subject)
    : progress;

  const groupedBySubject = filteredProgress.reduce((acc, entry) => {
    if (!acc[entry.subject]) {
      acc[entry.subject] = [];
    }
    acc[entry.subject].push({
      date: new Date(entry.created_at).toLocaleDateString(),
      score: entry.score,
    });
    return acc;
  }, {} as Record<string, { date: string; score: number }[]>);

  const datasets = Object.entries(groupedBySubject).map(([subject, data]) => ({
    label: subject,
    data: data.map((d) => d.score),
    borderColor: getRandomColor(),
    backgroundColor: 'transparent',
    tension: 0.4,
  }));

  const chartData: ChartData<'line'> = {
    labels: Object.values(groupedBySubject)[0]?.map((d) => d.date) || [],
    datasets,
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: subject
          ? `Progress in ${subject}`
          : 'Progress Across All Subjects',
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 100,
        title: {
          display: true,
          text: 'Score',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date',
        },
      },
    },
  };

  return (
    <div className="w-full rounded-lg border bg-card p-6">
      <Line ref={chartRef} data={chartData} options={options} />
    </div>
  );
}

function getRandomColor() {
  const colors = [
    '#FF6384',
    '#36A2EB',
    '#FFCE56',
    '#4BC0C0',
    '#9966FF',
    '#FF9F40',
  ];
  return colors[Math.floor(Math.random() * colors.length)];
} 