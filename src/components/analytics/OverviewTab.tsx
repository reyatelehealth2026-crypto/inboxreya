import { UnifiedAnalyticsData } from '@/lib/analytics/types';
import { StatsCards } from './StatsCards';
import { RevenueChart } from './RevenueChart';
import { SegmentChart } from './SegmentChart';
import { SentimentChart } from './SentimentChart';
import { RecentIssuesList } from './RecentIssuesList';
import { TopCustomersTable } from './TopCustomersTable';

interface OverviewTabProps {
  data: UnifiedAnalyticsData;
}

export function OverviewTab({ data }: OverviewTabProps) {
  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsCards stats={data.stats} />

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <RevenueChart data={data.salesTrend} />
        <SegmentChart segments={data.segments} />
      </div>

      {/* AI Insights Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SentimentChart distribution={data.sentimentDistribution} />
        <RecentIssuesList issues={data.recentIssues.slice(0, 5)} />
      </div>

      {/* Top Customers Preview */}
      <TopCustomersTable customers={data.topCustomers.slice(0, 5)} />
    </div>
  );
}
