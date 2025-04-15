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

// Colors for different categories
const COLORS = ['#8884d8', '#83a6ed', '#8dd1e1', '#82ca9d', '#a4de6c', '#d0ed57', '#ffc658'];

export function CategoryDistribution({ stats }: { stats: LearningStats | null }) {
  if (!stats || !stats.categoryCounts || Object.keys(stats.categoryCounts).length === 0) {
    return <div className="flex items-center justify-center h-full">No category data available</div>;
  }

  // Transform category counts to chart data
  const data = Object.entries(stats.categoryCounts).map(([category, count]) => ({
    name: category,
    value: count
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={true}
          outerRadius={120}
          fill="#8884d8"
          dataKey="value"
          label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip formatter={(value) => [`${value} lessons`, '']} />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
} 