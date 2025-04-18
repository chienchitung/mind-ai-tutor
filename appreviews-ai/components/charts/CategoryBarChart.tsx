'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import type { AnalysisResult } from '@/types/feedback';
import { useLanguage } from '@/contexts/LanguageContext';

interface CategoryBarChartProps {
  data: AnalysisResult['feedbacks'];
}

export const CategoryBarChart = ({ data }: CategoryBarChartProps) => {
  const { t } = useLanguage();

  // 統計各分類的出現次數
  const categoryCount = data.reduce((acc, feedback) => {
    const categories = feedback.category.split(/[,，]/).map(c => c.trim());
    categories.forEach(category => {
      acc[category] = (acc[category] || 0) + 1;
    });
    return acc;
  }, {} as Record<string, number>);

  // 計算總數用於百分比計算
  const total = Object.values(categoryCount).reduce((sum, count) => sum + count, 0);

  // 轉換為圖表數據格式並排序
  const chartData = Object.entries(categoryCount)
    .map(([category, count]) => ({
      category,
      count,
      percentage: ((count / total) * 100).toFixed(1)
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10); // 只顯示前10個分類

  // 自定義提示框內容
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-white px-4 py-2 shadow-lg rounded-lg border border-gray-100">
          <p className="text-sm font-medium text-gray-900">
            {data.category}：{data.count} {t('analysis.reviews')} ({data.percentage}%)
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart
        data={chartData}
        layout="vertical"
        margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
      >
        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
        <XAxis type="number" stroke="#1f2937" />
        <YAxis 
          dataKey="category" 
          type="category" 
          width={80}
          style={{
            fontSize: '0.75rem',
            fill: '#1f2937'
          }}
        />
        <Tooltip content={<CustomTooltip />} />
        <Bar 
          dataKey="count" 
          fill="#9333EA"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}; 