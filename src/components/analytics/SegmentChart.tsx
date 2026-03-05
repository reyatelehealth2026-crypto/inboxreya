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
const COLORS: Record<string, string> = {
  vip: '#F59E0B',    // Amber for VIP
  gold: '#3B82F6',   // Blue for Gold
  silver: '#64748B', // Slate for Silver
  bronze: '#A16207'  // Dark amber for Bronze
};

interface ChartData {
  name: string;
  value: number;
  percentage: number;
  tier: string;
}

// Custom Legend Component
function CustomLegend({ payload }: { payload?: Array<{ value: string; color: string }> }) {
  if (!payload) return null;
  
  return (
    <ul className="flex flex-wrap justify-center gap-4 mt-4">
      {payload.map((entry, index) => (
        <li key={`legend-${index}`} className="flex items-center gap-2">
          <span 
            className="w-3 h-3 rounded-sm inline-block" 
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-sm text-gray-700 whitespace-nowrap">{entry.value}</span>
        </li>
      ))}
    </ul>
  );
}

export function SegmentChart({ segments }: SegmentChartProps) {
  const data: ChartData[] = segments.map(s => ({
    name: s.name,
    value: s.count,
    percentage: s.percentage,
    tier: s.tier
  }));

  return (
    <Card className="col-span-1 border-blue-100">
      <CardHeader>
        <CardTitle className="text-[#1E3A8A] whitespace-nowrap">กลุ่มลูกค้า</CardTitle>
      </CardHeader>
      <CardContent className="min-w-0">
        <ResponsiveContainer width="100%" height={280}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="45%"
              labelLine={false}
              outerRadius={70}
              fill="#8884d8"
              dataKey="value"
              label={(props) => {
                const payload = props?.payload as ChartData | undefined;
                const percentage = payload?.percentage ?? 0;
                return `${percentage}%`;
              }}
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.tier] || '#3B82F6'} 
                />
              ))}
            </Pie>
            <Tooltip 
              contentStyle={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px'
              }}
              formatter={(value, name, props) => {
                const percentage = (props?.payload as ChartData)?.percentage ?? 0;
                return [`${value} (${percentage}%)`, name];
              }}
            />
          </PieChart>
        </ResponsiveContainer>
        
        {/* Custom Legend */}
        <div className="mt-2">
          {data.map((entry, index) => (
            <div key={index} className="flex items-center justify-between py-1">
              <div className="flex items-center gap-2">
                <span 
                  className="w-3 h-3 rounded-sm inline-block flex-shrink-0" 
                  style={{ backgroundColor: COLORS[entry.tier] || '#3B82F6' }}
                />
                <span className="text-sm text-gray-700 truncate">{entry.name}</span>
              </div>
              <span className="text-sm text-gray-500">{entry.value} ราย ({entry.percentage}%)</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
