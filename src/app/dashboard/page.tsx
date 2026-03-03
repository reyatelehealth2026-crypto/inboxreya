'use client';

import { useRouter } from 'next/navigation';
import { useState, useEffect, useCallback } from 'react';
import { useSession } from 'next-auth/react';
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
import { Button } from '@/components/ui/button';
import { 
  Briefcase, 
  ArrowRight, 
  Clock, 
  Calendar,
  Sparkles,
  Zap,
  CheckCircle2,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { WorkSummary } from '@/components/work/WorkSummary';
import { CustomerWorkCard } from '@/components/work/CustomerWorkCard';
import { 
  getAllWork, 
  getWorkSummary, 
  CustomerWork, 
  WorkSummaryData 
} from '@/lib/work/queries';
import { cn } from '@/lib/utils';

function LoadingSkeleton() {
  return (
    <div className="space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-5 w-96" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-32 rounded-xl" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[400px] lg:col-span-2 rounded-xl" />
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const [activeTab, setActiveTab] = useState<AnalyticsTab | 'command-center'>('command-center');
  const [workItems, setWorkItems] = useState<CustomerWork[]>([]);
  const [workSummary, setWorkSummary] = useState<WorkSummaryData | null>(null);
  const [isWorkLoading, setIsWorkLoading] = useState(true);

  // Fetch Analytics Data
  const { data: analyticsData, isLoading: isAnalyticsLoading, error: analyticsError } = useQuery<UnifiedAnalyticsData>({
    queryKey: ['unified-analytics'],
    queryFn: async () => {
      const response = await fetch('/api/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    refetchInterval: 5 * 60 * 1000,
  });

  // Fetch Daily Work Data
  const loadWorkData = useCallback(async () => {
    setIsWorkLoading(true);
    try {
      const [items, summary] = await Promise.all([
        getAllWork(true), // Filter only assigned to me
        getWorkSummary(true), // Filter only assigned to me
      ]);
      // Show only top 4 urgent/pending items in the Command Center
      setWorkItems(items.filter(i => i.status !== 'completed').slice(0, 4));
      setWorkSummary(summary);
    } catch (error) {
      console.error("Failed to load work data:", error);
    } finally {
      setIsWorkLoading(false);
    }
  }, []);

  useEffect(() => {
    loadWorkData();
  }, [loadWorkData]);

  // Handle card click
  const handleCardClick = useCallback((work: CustomerWork) => {
    // Navigate to Inbox and open this specific conversation
    router.push(`/inbox?userId=${work.customerId}`);
  }, [router]);

  // Handle notification click
  const handleNotificationClick = useCallback((work: CustomerWork) => {
    // Scroll to the work item or highlight it
    handleCardClick(work);
  }, [handleCardClick]);

  const renderCommandCenter = () => {
    if (isAnalyticsLoading || isWorkLoading) return <LoadingSkeleton />;

    return (
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
        {/* Daily Progress Section */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Zap className="h-5 w-5 text-amber-500 fill-amber-500" />
              สรุปงานวันนี้
            </h2>
            <Link href="/dashboard/my-work">
              <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-700 hover:bg-blue-50 gap-1">
                จัดการงานทั้งหมด
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
          
          {workSummary && <WorkSummary data={workSummary} isLoading={isWorkLoading} />}
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Active Work (Left Col - 2/3) */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Briefcase className="h-5 w-5 text-blue-600" />
                งานที่ต้องทำเร่งด่วน
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

          {/* AI Insights & Quick Links (Right Col - 1/3) */}
          <div className="space-y-6">
            <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white overflow-hidden relative group">
              <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-100/50 rounded-full blur-2xl group-hover:bg-blue-200/50 transition-all duration-500" />
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-blue-700 font-semibold mb-3">
                  <Sparkles className="h-5 w-5 fill-blue-600" />
                  AI Insights
                </div>
                <div className="space-y-3">
                  <p className="text-sm text-gray-700 leading-relaxed">
                    วันนี้ลูกค้าส่วนใหญ่มี <span className="text-emerald-600 font-bold">Sentiment: Positive (82%)</span>
                  </p>
                  <div className="p-3 bg-white/80 backdrop-blur-sm rounded-xl border border-blue-100 text-xs text-gray-600 leading-relaxed italic">
                    "ลูกค้าเริ่มสอบถามโปรโมชั่นช่วงหน้าร้อน แนะนำให้ทีมเตรียม Quick Reply เรื่องยาคลายร้อนและครีมกันแดดไว้ครับ"
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-3">
              <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider px-2">เมนูอื่นๆ</h3>
              <div className="grid grid-cols-1 gap-2">
                <Button variant="ghost" className="justify-start gap-3 text-gray-700 hover:bg-white hover:shadow-sm" onClick={() => setActiveTab('overview')}>
                  <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                  </div>
                  วิเคราะห์ยอดขาย
                </Button>
                <Button variant="ghost" className="justify-start gap-3 text-gray-700 hover:bg-white hover:shadow-sm" onClick={() => setActiveTab('customers')}>
                  <div className="w-8 h-8 rounded-lg bg-pink-50 flex items-center justify-center">
                    <Users className="h-4 w-4 text-pink-600" />
                  </div>
                  ฐานข้อมูลลูกค้า
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTabContent = () => {
    if (activeTab === 'command-center') return renderCommandCenter();

    if (isAnalyticsLoading) return <LoadingSkeleton />;

    if (analyticsError || !analyticsData) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <p className="text-red-700">ไม่สามารถโหลดข้อมูลวิเคราะห์ได้ กรุณาลองใหม่อีกครั้ง</p>
          </CardContent>
        </Card>
      );
    }

    switch (activeTab) {
      case 'overview': return <OverviewTab data={analyticsData} />;
      case 'sales': return <SalesTab data={analyticsData} />;
      case 'customers': return <CustomersTab data={analyticsData} />;
      case 'ai-insights': return <AIInsightsTab data={analyticsData} />;
      default: return renderCommandCenter();
    }
  };

  return (
    <InboxLayout>
      <div className="p-6 lg:p-10 w-full min-h-screen">
        {/* Welcome Header - UX/UI Pro Max */}
        <header className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-1 animate-in slide-in-from-left-4 duration-500">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 mb-1">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
            </div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">
              ยินดีต้อนรับกลับมา, <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">คุณ{session?.user?.name || 'สมชาย'}</span> 👋
            </h1>
            <p className="text-lg text-gray-500">วันนี้มีแชทที่รอดำเนินการ {workSummary?.totalPending || 0} รายการ มาจัดการให้จบกันเถอะ!</p>
          </div>
          
          <div className="flex items-center gap-3">
             <div className="flex items-center bg-gray-100 rounded-xl p-1.5 shadow-inner">
                <button
                  onClick={() => setActiveTab('command-center')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300",
                    activeTab === 'command-center' 
                      ? "bg-white text-blue-600 shadow-md transform scale-105" 
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  หน้าหลัก
                </button>
                <button
                  onClick={() => setActiveTab('overview')}
                  className={cn(
                    "px-4 py-2 rounded-lg text-sm font-bold transition-all duration-300",
                    activeTab !== 'command-center' 
                      ? "bg-white text-blue-600 shadow-md transform scale-105" 
                      : "text-gray-500 hover:text-gray-700"
                  )}
                >
                  รายงานวิเคราะห์
                </button>
             </div>
          </div>
        </header>

        {renderTabContent()}
      </div>
    </InboxLayout>
  );
}
