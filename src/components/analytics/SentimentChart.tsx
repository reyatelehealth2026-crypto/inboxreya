'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SentimentDistribution } from '@/lib/analytics/types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface SentimentChartProps {
  distribution: SentimentDistribution;
}

const COLORS = {
  positive: '#22C55E', // Green
  neutral: '#64748B',  // Slate
  negative: '#EF4444'  // Red
};

const LABELS = {
  positive: 'เชิงบวก',
  neutral: 'กลางๆ',
  negative: 'เชิงลบ'
};

export function SentimentChart({ distribution }: SentimentChartProps) {
  const data = [
    { name: LABELS.positive, value: distribution.positive, key: 'positive' },
    { name: LABELS.neutral, value: distribution.neutral, key: 'neutral' },
    { name: LABELS.negative, value: distribution.negative, key: 'negative' }
  ].filter(d => d.value > 0);

  const total = distribution.positive + distribution.neutral + distribution.negative;

  return (
    <Card className="border-blue-100">
      <CardHeader>
        <CardTitle className="text-[#1E3A8A]">การวิเคราะห์ความรู้สึก (AI)</CardTitle>
      </CardHeader>
      <CardContent>
        {total > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={60}
                outerRadius={80}
                paddingAngle={5}
                dataKey="value"
                label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
              >
                {data.map((entry) => (
                  <Cell 
                    key={entry.key} 
                    fill={COLORS[entry.key as keyof typeof COLORS]} 
                  />
                ))}
              </Pie>
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px'
                }}
                formatter={(value: number) => [`${value} ข้อความ`, 'จำนวน']}
              />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-gray-500">
            ยังไม่มีข้อมูลการวิเคราะห์
          </div>
        )}
      </CardContent>
    </Card>
  );
}
