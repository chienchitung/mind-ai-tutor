'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import type { AnalysisResult } from '@/types/feedback';
import { useLanguage } from '@/contexts/LanguageContext'; // 新增引入

interface TrendChartProps {
  data: AnalysisResult['feedbacks'];
}

// 定義裝置顏色映射
const DEVICE_COLORS: Record<string, string> = {
  'iOS': '#147EFB',     // Apple 深藍色
  'Android': '#78C257', // Android 清新綠色
  '未知': '#A3A3A3'     // 中性灰色
};

// 修改圖表配置
const chartConfig = {
  background: '#ffffff',
  xaxis: {
    labels: {
      style: { colors: '#1f2937' }
    }
  },
  yaxis: {
    labels: {
      style: { colors: '#1f2937' }
    }
  },
  tooltip: {
    theme: 'light',
    style: {
      backgroundColor: 'white',
      borderColor: '#e5e7eb'
    }
  }
};

// 每月評論數趨勢圖（按裝置區分）
export const MonthlyTrendChart = ({ data }: TrendChartProps) => {
  const { t } = useLanguage(); // 新增使用 useLanguage hook
  const monthlyData = data.reduce((acc, feedback) => {
    const date = new Date(feedback.date);
    const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    
    if (!acc[monthKey]) {
      acc[monthKey] = {
        month: monthKey,
        total: 0,
        devices: {}
      };
    }
    
    acc[monthKey].total += 1;
    acc[monthKey].devices[feedback.device] = (acc[monthKey].devices[feedback.device] || 0) + 1;
    
    return acc;
  }, {} as Record<string, any>);

  const chartData = Object.entries(monthlyData)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, value]) => ({
      month,
      total: value.total,
      ...value.devices
    }));

  // 獲取所有不同的裝置類型
  const devices = Array.from(new Set(data.map(item => item.device)));

  return (
    <div className="w-full h-full">
      <h3 className="text-center text-sm font-medium mb-4">
        {t('analysis.charts.monthlyTrend')} {/* 修改標題文字 */}
      </h3>
      <div className="w-full h-[calc(100%-2rem)]">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" />
            <YAxis />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border border-gray-200 shadow-md">
                      <p className="font-medium">{label}</p>
                      <p className="text-gray-600">
                        {t('analysis.charts.totalReviews')}: {payload[0]?.payload.total} {/* 修改提示文字 */}
                      </p>
                      {payload.map((entry) => (
                        entry.dataKey !== 'total' && (
                          <p key={entry.dataKey} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}
                          </p>
                        )
                      ))}
                    </div>
                  );
                }
                return null;
              }}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb' 
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={36}
            />
            {devices.map((device) => (
              <Bar 
                key={device} 
                dataKey={device} 
                stackId="a"
                fill={DEVICE_COLORS[device] || '#94A3B8'}
                name={device}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// 評分分布圖（按裝置區分）
export const RatingDistributionChart = ({ data }: TrendChartProps) => {
  const { t } = useLanguage(); // 新增使用 useLanguage hook
  const ratingDistribution = data.reduce((acc, item) => {
    const rating = Math.floor(item.rating);
    if (!acc[rating]) {
      acc[rating] = {
        total: 0,
        devices: {}
      };
    }
    acc[rating].total += 1;
    acc[rating].devices[item.device] = (acc[rating].devices[item.device] || 0) + 1;
    return acc;
  }, {} as Record<number, { total: number; devices: Record<string, number> }>);

  const chartData = Array.from({ length: 5 }, (_, i) => i + 1).map(rating => ({
    rating: `${rating}`,
    total: ratingDistribution[rating]?.total || 0,
    ...Object.fromEntries(
      Object.entries(ratingDistribution[rating]?.devices || {}).map(([device, count]) => [
        device,
        count
      ])
    )
  }));

  const devices = Array.from(new Set(data.map(item => item.device)));

  return (
    <div className="w-full h-full">
      <h3 className="text-center text-sm font-medium mb-4">
        {t('analysis.charts.ratingDistribution')} {/* 修改標題文字 */}
      </h3>
      <div className="w-full h-[calc(100%-2rem)]">
        <ResponsiveContainer>
          <BarChart
            data={chartData}
            margin={{ top: 30, right: 30, left: 20, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="rating" />
            <YAxis />
            <Tooltip 
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-white p-2 border border-gray-200 shadow-md">
                      <p className="font-medium">{label}</p>
                      <p className="text-gray-600">
                        {t('analysis.charts.totalReviews')}: {payload[0]?.payload.total} {/* 修改提示文字 */}
                      </p>
                      {payload.map((entry) => (
                        entry.dataKey !== 'total' && (
                          <p key={entry.dataKey} style={{ color: entry.color }}>
                            {entry.name}: {entry.value}
                          </p>
                        )
                      ))}
                    </div>
                  );
                }
                return null;
              }}
              contentStyle={{ 
                backgroundColor: 'white', 
                border: '1px solid #e5e7eb' 
              }}
            />
            <Legend 
              verticalAlign="top" 
              height={36}
            />
            {devices.map((device) => (
              <Bar 
                key={device} 
                dataKey={device}
                stackId="a"
                fill={DEVICE_COLORS[device] || '#94A3B8'}
                name={device}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};