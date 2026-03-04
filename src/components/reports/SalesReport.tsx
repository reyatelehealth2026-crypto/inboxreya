'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { 
  TrendingUp, 
  TrendingDown, 
  Users, 
  ShoppingCart, 
  Package,
  Calendar,
  Award,
  AlertTriangle,
  CheckCircle2
} from 'lucide-react';

interface SalesReportProps {
  days: number;
}

interface ReportData {
  success: boolean;
  period: {
    days: number;
    startDate: string;
    endDate: string;
  };
  summary: {
    totalOrders: number;
    totalCustomers: number;
    totalRevenue: number;
    avgOrderValue: number;
    changes: {
      orders: string;
      revenue: string;
      customers: string;
    };
  };
  orderStatus: Array<{
    status: string;
    count: number;
    total_amount: number;
    percentage: number;
  }>;
  topCustomers: Array<{
    rank: number;
    customerCode: string;
    customerName: string;
    orderCount: number;
    totalSpent: number;
    avgOrderValue: number;
  }>;
  topSales: Array<{
    rank: number;
    salesName: string;
    orderCount: number;
    totalSales: number;
    avgOrderValue: number;
  }>;
  dailyStats: Array<{
    date: string;
    orders: number;
    revenue: number;
    customers: number;
  }>;
  insights: {
    positive: string[];
    warnings: string[];
  };
}

const statusIcons: Record<string, string> = {
  'delivered': '✅',
  'to delivery': '🚚',
  'packing': '📦',
  'packed': '📋',
  'picker assign': '👤',
};

const statusColors: Record<string, string> = {
  'delivered': 'text-emerald-600 bg-emerald-50',
  'to delivery': 'text-blue-600 bg-blue-50',
  'packing': 'text-amber-600 bg-amber-50',
  'packed': 'text-purple-600 bg-purple-50',
  'picker assign': 'text-gray-600 bg-gray-50',
};

export function SalesReport({ days }: SalesReportProps) {
  const [data, setData] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch data
  useState(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/reports/sales-summary?days=${days}`);
        if (!response.ok) throw new Error('Failed to fetch report');
        const result = await response.json();
        setData(result);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  });

  if (loading) return <ReportSkeleton />;
  if (error) return <div className="text-red-500">Error: {error}</div>;
  if (!data?.success) return <div className="text-red-500">Failed to load report</div>;

  const { summary, orderStatus, topCustomers, topSales, insights } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold text-gray-900">📊 รายงานสรุปยอดขาย</h2>
        <p className="text-gray-500">
          ช่วงวันที่ {formatThaiDate(data.period.startDate)} - {formatThaiDate(data.period.endDate)}
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SummaryCard
          title="ออเดอร์"
          value={summary.totalOrders.toLocaleString()}
          change={summary.changes.orders}
          icon={<ShoppingCart className="h-5 w-5" />}
          color="blue"
        />
        <SummaryCard
          title="ลูกค้า"
          value={summary.totalCustomers.toLocaleString()}
          change={summary.changes.customers}
          icon={<Users className="h-5 w-5" />}
          color="green"
        />
        <SummaryCard
          title="ยอดขายรวม"
          value={`${(summary.totalRevenue / 1000000).toFixed(2)}M`}
          change={summary.changes.revenue}
          icon={<TrendingUp className="h-5 w-5" />}
          color="purple"
          suffix="บาท"
        />
        <SummaryCard
          title="เฉลี่ย/ออเดอร์"
          value={Math.round(summary.avgOrderValue).toLocaleString()}
          change={null}
          icon={<Package className="h-5 w-5" />}
          color="amber"
          suffix="บาท"
        />
      </div>

      {/* Order Status */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Package className="h-5 w-5" />
            สถานะออเดอร์
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {orderStatus.map((status) => (
              <div key={status.status} className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-xl">{statusIcons[status.status.toLowerCase()] || '📦'}</span>
                  <span className="font-medium">{status.status}</span>
                </div>
                <div className="flex items-center gap-4 text-right">
                  <span className="font-bold">{status.count} ราย</span>
                  <span className="text-gray-500 w-24">{status.total_amount.toLocaleString()} บาท</span>
                  <span className={cn(
                    "px-2 py-1 rounded-full text-xs font-medium",
                    statusColors[status.status.toLowerCase()] || 'text-gray-600 bg-gray-100'
                  )}>
                    {status.percentage}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Customers */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5" />
              Top 5 ลูกค้า
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topCustomers.map((customer) => (
                <div key={customer.customerCode} className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    customer.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                    customer.rank === 2 ? "bg-gray-100 text-gray-700" :
                    customer.rank === 3 ? "bg-orange-100 text-orange-700" :
                    "bg-blue-50 text-blue-600"
                  )}>
                    {customer.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{customer.customerName}</p>
                    <p className="text-sm text-gray-500">{customer.customerCode} • {customer.orderCount} ออเดอร์</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{(customer.totalSpent / 1000).toFixed(0)}K</p>
                    <p className="text-xs text-gray-500">เฉลี่ย {Math.round(customer.avgOrderValue).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Sales */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5" />
              Top 3 เซลล์
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {topSales.map((sales) => (
                <div key={sales.salesName} className="flex items-center gap-4">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold",
                    sales.rank === 1 ? "bg-yellow-100 text-yellow-700" :
                    sales.rank === 2 ? "bg-gray-100 text-gray-700" :
                    "bg-orange-100 text-orange-700"
                  )}>
                    {sales.rank}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium">{sales.salesName}</p>
                    <p className="text-sm text-gray-500">{sales.orderCount} ออเดอร์</p>
                  </div>
                  <div className="text-right">
                    <p className="font-bold">{(sales.totalSales / 1000).toFixed(0)}K</p>
                    <p className="text-xs text-gray-500">เฉลี่ย {Math.round(sales.avgOrderValue).toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Insights */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Positive Insights */}
        <Card className="border-emerald-200 bg-emerald-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-emerald-700">
              <CheckCircle2 className="h-5 w-5" />
              ข้อดี
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.positive.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-emerald-700">
                  <span className="mt-1">✅</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* Warnings */}
        <Card className="border-amber-200 bg-amber-50/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
              <AlertTriangle className="h-5 w-5" />
              ข้อควรระวัง
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {insights.warnings.map((item, i) => (
                <li key={i} className="flex items-start gap-2 text-amber-700">
                  <span className="mt-1">⚠️</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SummaryCard({ 
  title, 
  value, 
  change, 
  icon, 
  color,
  suffix = ''
}: { 
  title: string; 
  value: string; 
  change: string | null;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'amber';
  suffix?: string;
}) {
  const colorClasses = {
    blue: 'text-blue-600 bg-blue-50',
    green: 'text-emerald-600 bg-emerald-50',
    purple: 'text-purple-600 bg-purple-50',
    amber: 'text-amber-600 bg-amber-50',
  };

  const isPositive = change && parseFloat(change) >= 0;
  const changeValue = change ? Math.abs(parseFloat(change)) : 0;

  return (
    <Card className="relative overflow-hidden">
      <CardContent className="p-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm font-medium text-gray-500">{title}</p>
            <p className="text-2xl font-bold mt-2">{value} <span className="text-sm font-normal">{suffix}</span></p>
            {change !== null && (
              <div className={cn(
                "flex items-center gap-1 mt-1 text-sm font-medium",
                isPositive ? "text-emerald-600" : "text-red-600"
              )}>
                {isPositive ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                <span>{changeValue.toFixed(1)}%</span>
              </div>
            )}
          </div>
          <div className={cn("p-3 rounded-xl", colorClasses[color])}>
            {icon}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ReportSkeleton() {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Skeleton className="h-8 w-64 mx-auto" />
        <Skeleton className="h-4 w-48 mx-auto" />
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Skeleton className="h-80 rounded-xl" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function formatThaiDate(dateStr: string): string {
  const date = new Date(dateStr);
  const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
}
