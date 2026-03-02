import { Suspense } from 'react';
import { Metadata } from 'next';
import { InboxLayout } from '@/components/layout/InboxLayout';
import { StatsCards } from '@/components/analytics/StatsCards';
import { SegmentChart } from '@/components/analytics/SegmentChart';
import { TopCustomersTable } from '@/components/analytics/TopCustomersTable';
import { getAllAnalyticsData } from '@/lib/analytics/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Analytics Dashboard | LINE OA Manager',
  description: 'Customer analytics and insights dashboard'
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px] lg:col-span-2" />
      </div>
    </div>
  );
}

async function AnalyticsContent() {
  const data = await getAllAnalyticsData();

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsCards stats={data.stats} />

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SegmentChart segments={data.segments} />
        <TopCustomersTable customers={data.topCustomers} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <InboxLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">ข้อมูลวิเคราะห์ลูกค้าและสถิติการขาย</p>
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <AnalyticsContent />
        </Suspense>
      </div>
    </InboxLayout>
  );
}
