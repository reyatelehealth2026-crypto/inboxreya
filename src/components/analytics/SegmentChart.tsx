'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerSegment } from '@/lib/analytics/types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface SegmentChartProps {
  segments: CustomerSegment[];
}

// Fintech color palette from ui-ux-pro-max
const COLORS = {
  vip: '#F59E0B',    // Amber for VIP
  gold: '#3B82F6',   // Blue for Gold
  silver: '#64748B', // Slate for Silver
  bronze: '#A16207'  // Dark amber for Bronze
};

export function SegmentChart({ segments }: SegmentChartProps) {
  const data = segments.map(s => ({
    name: s.name,
    value: s.count,
    percentage: s.percentage,
    tier: s.tier
  }));

  return (
    <Card className="col-span-1 border-blue-100">
      <CardHeader>
        <CardTitle className="text-[#1E3A8A]">กลุ่มลูกค้า</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name} (${percentage}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.tier as keyof typeof COLORS] || '#3B82F6'} 
                />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px'
              }}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
