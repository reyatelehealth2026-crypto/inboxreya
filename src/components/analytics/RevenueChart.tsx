'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesTrendPoint } from '@/lib/analytics/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import {
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

interface RevenueChartProps {
  data: SalesTrendPoint[];
}

interface ChartData {
  date: string;
  revenue: number;
  orders: number;
  displayDate: string;
}

export function RevenueChart({ data }: RevenueChartProps) {
  // Transform data for the chart
  const chartData: ChartData[] = data.map(point => ({
    ...point,
    displayDate: new Date(point.date).toLocaleDateString('th-TH', {
      month: 'short',
      day: 'numeric'
    })
  }));

  return (
    <Card className="col-span-2 border-blue-100">
      <CardHeader>
        <CardTitle className="text-[#1E3A8A]">แนวโน้มรายได้และออเดอร์</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis 
              dataKey="displayDate" 
              stroke="#64748B"
              fontSize={12}
              tickLine={false}
            />
            <YAxis 
              yAxisId="revenue"
              orientation="left"
              stroke="#3B82F6"
              fontSize={12}
              tickLine={false}
              tickFormatter={(value) => `฿${(value / 1000).toFixed(0)}K`}
            />
            
            <YAxis 
              yAxisId="orders"
              orientation="right"
              stroke="#F59E0B"
              fontSize={12}
              tickLine={false}
            />
            
            <Tooltip 
              contentStyle={{
                backgroundColor: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px'
              }}
              formatter={(value: number, name: string) => {
                if (name === 'รายได้') return [formatCurrency(value), name];
                return [formatNumber(value), name];
              }}
            />
            
            <Legend />
            
            <Bar 
              yAxisId="revenue"
              dataKey="revenue" 
              name="รายได้"
              fill="#3B82F6" 
              fillOpacity={0.6}
              radius={[4, 4, 0, 0]}
            />
            
            <Line 
              yAxisId="orders"
              type="monotone" 
              dataKey="orders" 
              name="ออเดอร์"
              stroke="#F59E0B" 
              strokeWidth={2}
              dot={{ fill: '#F59E0B', r: 4 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
