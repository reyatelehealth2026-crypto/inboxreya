'use client';

import { useState } from 'react';
import { InboxLayout } from '@/components/layout/InboxLayout';
import { TabNavigation, AnalyticsTab } from '@/components/analytics/TabNavigation';
import { OverviewTab } from '@/components/analytics/OverviewTab';
import { SalesTab } from '@/components/analytics/SalesTab';
import { CustomersTab } from '@/components/analytics/CustomersTab';
import { AIInsightsTab } from '@/components/analytics/AIInsightsTab';
import { useQuery } from '@tanstack/react-query';
import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardContent className="pt-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-[300px]" />
        <Skeleton className="h-[300px]" />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  const { data, isLoading, error } = useQuery<UnifiedAnalyticsData>({
    queryKey: ['unified-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
    staleTime: 60 * 1000 // Consider stale after 1 minute
  });

  const renderTabContent = () => {
    if (isLoading) {
      return <LoadingSkeleton />;
    }

    if (error || !data) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">
              ไม่สามารถโหลดข้อมูลได้ กรุณาลองใหม่อีกครั้ง
            </p>
          </CardContent>
        </Card>
      );
    }

    switch (activeTab) {
      case 'overview':
        return <OverviewTab data={data} />;
      case 'sales':
        return <SalesTab data={data} />;
      case 'customers':
        return <CustomersTab data={data} />;
      case 'ai-insights':
        return <AIInsightsTab data={data} />;
      default:
        return <OverviewTab data={data} />;
    }
  };

  return (
    <InboxLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Unified Analytics Dashboard</h1>
          <p className="text-gray-600">ข้อมูลวิเคราะห์ลูกค้า ยอดขาย และ AI Insights แบบครบถ้วน</p>
        </div>

        <TabNavigation activeTab={activeTab} onTabChange={setActiveTab} />

        {renderTabContent()}
      </div>
    </InboxLayout>
  );
}
