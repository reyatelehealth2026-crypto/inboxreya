import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { RevenueChart } from './RevenueChart';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, ShoppingCart, Calendar } from 'lucide-react';

interface SalesTabProps {
  data: UnifiedAnalyticsData;
}

export function SalesTab({ data }: SalesTabProps) {
  // Calculate some additional metrics
  const totalRevenue = data.stats.totalRevenue;
  const totalOrders = data.stats.totalOrders;
  const avgOrderValue = totalOrders > 0 ? totalRevenue / totalOrders : 0;
  
  // Calculate trend (compare last 7 days with previous 7 days)
  const last7Days = data.salesTrend.slice(-7);
  const prev7Days = data.salesTrend.slice(-14, -7);
  
  const last7Revenue = last7Days.reduce((sum, d) => sum + d.revenue, 0);
  const prev7Revenue = prev7Days.reduce((sum, d) => sum + d.revenue, 0);
  
  const revenueChange = prev7Revenue > 0 
    ? ((last7Revenue - prev7Revenue) / prev7Revenue) * 100 
    : 0;

  return (
    <div className="space-y-6">
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">รายได้ 7 วันล่าสุด</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{formatCurrency(last7Revenue)}</div>
            <div className={`text-sm mt-1 ${revenueChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {revenueChange >= 0 ? '+' : ''}{revenueChange.toFixed(1)}% จาก 7 วันก่อน
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ออเดอร์ 7 วันล่าสุด</CardTitle>
            <ShoppingCart className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">
              {formatNumber(last7Days.reduce((sum, d) => sum + d.orders, 0))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">มูลค่าออเดอร์เฉลี่ย</CardTitle>
            <Calendar className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{formatCurrency(avgOrderValue)}</div>
          </CardContent>
        </Card>
      </div>

      {/* Revenue Chart */}
      <RevenueChart data={data.salesTrend} />

      {/* Sales Table */}
      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A]">รายละเอียดรายวัน</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">วันที่</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">รายได้</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">ออเดอร์</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">เฉลี่ย/ออเดอร์</th>
                </tr>
              </thead>
              <tbody>
                {[...data.salesTrend].reverse().map((day) => (
                  <tr key={day.date} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm">
                      {new Date(day.date).toLocaleDateString('th-TH', {
                        weekday: 'short',
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric'
                      })}
                    </td>
                    <td className="py-3 px-4 text-sm text-right font-medium">
                      {formatCurrency(day.revenue)}
                    </td>
                    <td className="py-3 px-4 text-sm text-right">{formatNumber(day.orders)}</td>
                    <td className="py-3 px-4 text-sm text-right">
                      {formatCurrency(day.orders > 0 ? day.revenue / day.orders : 0)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
