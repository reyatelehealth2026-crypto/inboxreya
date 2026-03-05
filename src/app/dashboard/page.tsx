'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { WorkSummary } from '@/components/work/WorkSummary';
import { CustomerWorkCard } from '@/components/work/CustomerWorkCard';
import { StatsCards } from '@/components/analytics/StatsCards';
import { QuickActionsPanel } from '@/components/dashboard/QuickActionsPanel';
import { AgentPerformanceTable } from '@/components/dashboard/AgentPerformanceTable';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { ArrowRight, Briefcase, CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import {
  getAllWork,
  getWorkSummary,
  CustomerWork,
  WorkSummaryData,
} from '@/lib/work/queries';

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-28 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[360px] lg:col-span-2 rounded-xl" />
        <Skeleton className="h-[360px] rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [daysFilter] = useState<number>(1);
  const [workItems, setWorkItems] = useState<CustomerWork[]>([]);
  const [workSummary, setWorkSummary] = useState<WorkSummaryData | null>(null);
  const [isWorkLoading, setIsWorkLoading] = useState(true);

  const { data: analyticsData, isLoading: isAnalyticsLoading } = useQuery<UnifiedAnalyticsData>({
    queryKey: ['unified-analytics', daysFilter],
    queryFn: async () => {
      const response = await fetch(`/api/analytics?days=${daysFilter}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  const loadWorkData = useCallback(async () => {
    setIsWorkLoading(true);
    try {
      const [items, summary] = await Promise.all([
        getAllWork(true),
        getWorkSummary(true),
      ]);
      setWorkItems(items.filter((i) => i.status !== 'completed').slice(0, 6));
      setWorkSummary(summary);
    } catch (error) {
      console.error('Failed to load work data:', error);
    } finally {
      setIsWorkLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkData();
  }, [loadWorkData]);

  const handleCardClick = useCallback(
    (work: CustomerWork) => {
      router.push(`/inbox?userId=${work.customerId}`);
    },
    [router]
  );

  if (isAnalyticsLoading || isWorkLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-700">
      <div className="rounded-3xl border border-blue-100/60 bg-gradient-to-br from-blue-50/60 via-white to-white p-6 shadow-[0_8px_24px_rgba(30,58,138,0.08)]">
      <header className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-[#1E3A8A]">Operational Dashboard</h1>
          <p className="text-sm text-gray-500">ภาพรวมการทำงานวันนี้สำหรับทีม Admin/Sales</p>
        </div>
        <Link href="/dashboard/executive" className="text-sm font-medium text-blue-600 hover:text-blue-700">
          ดู Executive Summary →
        </Link>
      </header>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Key Metrics</h2>
          <span className="text-xs text-gray-400">Updated: วันนี้</span>
        </div>
        {analyticsData?.stats && <StatsCards stats={analyticsData.stats} />}
      </section>

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">Daily Workload</h2>
          <Link href="/dashboard/my-work">
            <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1">
              จัดการงานทั้งหมด
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
        {workSummary && <WorkSummary data={workSummary} isLoading={isWorkLoading} />}
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-semibold uppercase tracking-[0.3em] text-gray-400 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-blue-600" />
              Priority Queue
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {workItems.length > 0 ? (
              workItems.map((work) => (
                <CustomerWorkCard key={work.id} work={work} onClick={handleCardClick} />
              ))
            ) : (
              <div className="col-span-2 flex flex-col items-center justify-center py-12 bg-white rounded-2xl border border-dashed border-gray-300">
                <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mb-3">
                  <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                </div>
                <p className="text-gray-900 font-medium">ไม่มีงานค้างแล้ว!</p>
                <p className="text-gray-500 text-sm">ยินดีด้วย คุณจัดการงานวันนี้ครบถ้วนแล้ว</p>
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <QuickActionsPanel />
          <AgentPerformanceTable />
        </div>
      </section>

      </div>
    </div>
  );
}
