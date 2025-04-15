'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';

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
  if (!stats) {
    return <div className="flex items-center justify-center h-full">No completion data available</div>;
  }

  const { completedLessons, totalRecords } = stats;
  const inProgressLessons = totalRecords - completedLessons;

  const data = [
    { name: 'Completed', value: completedLessons, color: '#4ADE80' },
    { name: 'In Progress', value: inProgressLessons, color: '#FB923C' },
  ];

  // If no lessons, show empty state
  if (totalRecords === 0) {
    return <div className="flex items-center justify-center h-full">No completion data available</div>;
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
        <Tooltip formatter={(value) => [`${value} lessons`, '']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
} 