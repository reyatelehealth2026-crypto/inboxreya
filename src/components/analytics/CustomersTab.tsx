import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { SegmentChart } from './SegmentChart';
import { TopCustomersTable } from './TopCustomersTable';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, RepeatUser, ShoppingBag, UserPlus } from 'lucide-react';
import { formatNumber } from '@/lib/utils';

interface CustomersTabProps {
  data: UnifiedAnalyticsData;
}

export function CustomersTab({ data }: CustomersTabProps) {
  // Calculate behavior metrics
  const totalCustomers = data.stats.totalCustomers;
  const frequentBuyers = data.behaviorPatterns.find(p => p.name === 'Frequent Buyers');
  const regularBuyers = data.behaviorPatterns.find(p => p.name === 'Regular Buyers');
  const occasionalBuyers = data.behaviorPatterns.find(p => p.name === 'Occasional Buyers');

  return (
    <div className="space-y-6">
      {/* Behavior Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ลูกค้าทั้งหมด</CardTitle>
            <Users className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">{formatNumber(totalCustomers)}</div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ซื้อบ่อย (6+ ครั้ง)</CardTitle>
            <RepeatUser className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">
              {formatNumber(frequentBuyers?.count || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {frequentBuyers?.percentage || 0}% ของลูกค้าทั้งหมด
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ซื้อปกติ (3-5 ครั้ง)</CardTitle>
            <ShoppingBag className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">
              {formatNumber(regularBuyers?.count || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {regularBuyers?.percentage || 0}% ของลูกค้าทั้งหมด
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-100">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">ซื้อนานๆ (1-2 ครั้ง)</CardTitle>
            <UserPlus className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-[#1E3A8A]">
              {formatNumber(occasionalBuyers?.count || 0)}
            </div>
            <div className="text-sm text-gray-500 mt-1">
              {occasionalBuyers?.percentage || 0}% ของลูกค้าทั้งหมด
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SegmentChart segments={data.segments} />
        <div className="lg:col-span-2">
          <TopCustomersTable customers={data.topCustomers} />
        </div>
      </div>

      {/* Segments Detail Table */}
      <Card className="border-blue-100">
        <CardHeader>
          <CardTitle className="text-[#1E3A8A]">รายละเอียดกลุ่มลูกค้า</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">กลุ่ม</th>
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-600">ระดับ</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">จำนวน</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">สัดส่วน</th>
                  <th className="text-right py-3 px-4 text-sm font-medium text-gray-600">ยอดซื้อขั้นต่ำ</th>
                </tr>
              </thead>
              <tbody>
                {data.segments.map((segment) => (
                  <tr key={segment.tier} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-3 px-4 text-sm font-medium">{segment.name}</td>
                    <td className="py-3 px-4 text-sm">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        segment.tier === 'vip' ? 'bg-amber-100 text-amber-800' :
                        segment.tier === 'gold' ? 'bg-blue-100 text-blue-800' :
                        segment.tier === 'silver' ? 'bg-slate-100 text-slate-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {segment.tier.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-right">{formatNumber(segment.count)}</td>
                    <td className="py-3 px-4 text-sm text-right">{segment.percentage}%</td>
                    <td className="py-3 px-4 text-sm text-right">
                      {segment.minSpent.toLocaleString('th-TH')} ฿
                      {segment.maxSpent && ` - ${segment.maxSpent.toLocaleString('th-TH')} ฿`}
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

// Lucide doesn't have RepeatUser, so let's create a simple version
function RepeatUser(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M2 12c0 5.523 4.477 10 10 10s10-4.477 10-10S17.523 2 12 2" />
      <path d="M12 2a10 10 0 0 1 10 10" />
      <path d="M12 12 8 8" />
      <path d="M12 16V12" />
    </svg>
  );
}
