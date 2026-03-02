'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ComplaintCategory } from '@/lib/analytics/types';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  TooltipProps
} from 'recharts';

interface ComplaintChartProps {
  categories: ComplaintCategory[];
}

const CATEGORY_COLORS: Record<string, string> = {
  delivery: '#EF4444',  // Red - urgent
  product: '#F59E0B',   // Amber
  price: '#3B82F6',     // Blue
  service: '#8B5CF6',   // Purple
  other: '#64748B'      // Slate
};

const CATEGORY_LABELS: Record<string, string> = {
  delivery: 'การจัดส่ง',
  product: 'สินค้า',
  price: 'ราคา',
  service: 'บริการ',
  other: 'อื่นๆ'
};

interface ChartData extends ComplaintCategory {
  label: string;
}

export function ComplaintChart({ categories }: ComplaintChartProps) {
  const data: ChartData[] = categories.map(cat => ({
    ...cat,
    label: CATEGORY_LABELS[cat.category] || cat.category
  }));

  // Custom tooltip formatter
  const customFormatter = (value: number | string | Array<number | string>, name: string | number, props: TooltipProps<number | string, string>['payload']) => {
    if (!props || !props.payload) return ['', ''];
    
    const payload = props.payload as unknown as ChartData;
    const count = payload.count || 0;
    const percentage = payload.percentage || 0;
    return [`${count} (${percentage}%)`, 'จำนวน'];
  };

  return (
    <Card className="border-blue-100">
      <CardHeader>
        <CardTitle className="text-[#1E3A8A]">หมวดหมู่ร้องเรียน</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={data}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 40, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
              <XAxis 
                type="number" 
                stroke="#64748B"
                fontSize={12}
              />
              <YAxis 
                type="category" 
                dataKey="label"
                stroke="#64748B"
                fontSize={12}
                width={80}
              />
              <Tooltip 
                contentStyle={{
                  backgroundColor: '#F8FAFC',
                  border: '1px solid #E2E8F0',
                  borderRadius: '8px'
                }}
                formatter={customFormatter}
              />
              <Bar dataKey="count" radius={[0, 4, 4, 0]}>
                {data.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={CATEGORY_COLORS[entry.category] || CATEGORY_COLORS.other} 
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div className="flex items-center justify-center h-[250px] text-gray-500">
            ยังไม่มีข้อมูลร้องเรียน
          </div>
        )}
      </CardContent>
    </Card>
  );
}
