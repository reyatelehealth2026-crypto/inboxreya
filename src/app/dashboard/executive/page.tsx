'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { StatsCards } from '@/components/analytics/StatsCards';
import { RevenueChart } from '@/components/analytics/RevenueChart';
import { SegmentChart } from '@/components/analytics/SegmentChart';
import { ExecutiveInsightsCard } from '@/components/dashboard/ExecutiveInsightsCard';
import { RiskAlertsList } from '@/components/dashboard/RiskAlertsList';
import { Skeleton } from '@/components/ui/skeleton';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[360px] lg:col-span-2 rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
}

export default function ExecutiveDashboardPage() {
  const [daysFilter] = useState<number>(7);

  const { data: analyticsData, isLoading } = useQuery<UnifiedAnalyticsData>({
    queryKey: ['unified-analytics', daysFilter],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?days=${daysFilter}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    refetchInterval: 10 * 60 * 1000,
  });

  const insights: string[] = [];
  const alerts: { label: string; level: 'high' | 'medium' | 'low' }[] = [];

  // Thresholds (ปรับตาม business ได้)
  const NEGATIVE_HIGH = 20; // % negative sentiment
  const NEGATIVE_MEDIUM = 12;
  const RECENT_ISSUE_ALERT = 3;

  if (analyticsData) {
    const { complaintCategories, sentimentDistribution, recentIssues, topComplainers, stats } = analyticsData;

    if (stats?.totalRevenue) {
      insights.push(`ยอดขายรวมช่วง ${daysFilter} วัน: ฿${stats.totalRevenue.toLocaleString()}`);
    }

    if (complaintCategories?.length) {
      const top = complaintCategories[0];
      insights.push(`หมวดร้องเรียนสูงสุด: ${top.category} (${top.percentage}%)`);
    }

    if (sentimentDistribution) {
      insights.push(`สัดส่วน sentiment เชิงบวก: ${sentimentDistribution.positive}%`);
      if (sentimentDistribution.negative >= NEGATIVE_HIGH) {
        alerts.push({ label: `Sentiment เชิงลบ ${sentimentDistribution.negative}% (เกิน ${NEGATIVE_HIGH}%)`, level: 'high' });
      } else if (sentimentDistribution.negative >= NEGATIVE_MEDIUM) {
        alerts.push({ label: `Sentiment เชิงลบ ${sentimentDistribution.negative}%`, level: 'medium' });
      }
    }

    if (recentIssues?.length) {
      const urgent = recentIssues.find((issue) => issue.urgency === 'high');
      if (urgent) {
        alerts.push({ label: `Issue ด่วน: ${urgent.category} (${urgent.userName ?? 'ไม่ทราบชื่อ'})`, level: 'high' });
      } else {
        insights.push(`ล่าสุดมีข้อร้องเรียน ${recentIssues[0].category}`);
      }

      if (recentIssues.length >= RECENT_ISSUE_ALERT) {
        alerts.push({ label: `มีข้อร้องเรียนใหม่ ${recentIssues.length} รายการ`, level: 'medium' });
      }
    }

    if (topComplainers?.length) {
      const top = topComplainers[0];
      insights.push(`ลูกค้าร้องเรียนสูงสุด: ${top.userName ?? 'ไม่ทราบชื่อ'} (${top.complaintCount} ครั้ง)`);
    }
  }

  if (isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-3xl border border-blue-100/60 bg-gradient-to-br from-blue-50/60 via-white to-white p-6 shadow-[0_8px_24px_rgba(30,58,138,0.08)]">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#1E3A8A]">Executive Summary</h1>
          <p className="text-sm text-gray-500">ภาพรวมเชิงกลยุทธ์สำหรับผู้บริหาร</p>
        </div>
        <span className="text-xs text-gray-400">Updated: ทุก 10 นาที</span>
      </header>

      {analyticsData?.stats && <StatsCards stats={analyticsData.stats} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {analyticsData?.salesTrend && <RevenueChart data={analyticsData.salesTrend} />}
        {analyticsData?.segments && <SegmentChart segments={analyticsData.segments} />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ExecutiveInsightsCard insights={insights} />
        <RiskAlertsList alerts={alerts} />
      </div>
      </div>
    </div>
  );
}
