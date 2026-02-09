import { useQuery } from '@tanstack/react-query';

interface DateRange {
  startDate: string;
  endDate: string;
}

interface AnalyticsOverview {
  totalConversations: number;
  averageResponseTimeMinutes: number;
  slaComplianceRate: number;
  conversationsByStatus: {
    new: number;
    in_progress: number;
    waiting: number;
    resolved: number;
  };
  messageVolume: {
    total: number;
    incoming: number;
    outgoing: number;
  };
  dateRange: DateRange;
}

interface AdminMetric {
  adminId: number;
  adminName: string;
  avatarUrl: string | null;
  email: string;
  conversationsHandled: number;
  messagesHandled: number;
  averageResponseTimeMinutes: number;
  responseCount: number;
}

interface ConversationTrend {
  period: string;
  conversationCount: number;
  incomingMessages: number;
  outgoingMessages: number;
  totalMessages: number;
}

interface BusiestHour {
  hour: number;
  messageCount: number;
}

interface SLAMetrics {
  slaComplianceRate: number;
  averageFirstResponseTimeMinutes: number;
  slaThresholdMinutes: number;
  totalConversationsChecked: number;
  conversationsWithinSLA: number;
  conversationsExceedingSLA: number;
  breachSeverity: {
    minor: number;
    moderate: number;
    severe: number;
  };
  exceedingSLADetails: Array<{
    userId: number;
    userName: string;
    firstResponseTime: number | null;
    withinSLA: boolean;
    responseTimeMinutes: number | null;
  }>;
  dateRange: DateRange;
}

export function useAnalyticsOverview(
  lineAccountId: number,
  startDate?: string,
  endDate?: string
) {
  return useQuery<AnalyticsOverview>({
    queryKey: ['analytics', 'overview', lineAccountId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        lineAccountId: lineAccountId.toString(),
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/inbox/analytics/overview?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch analytics overview');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: !!lineAccountId,
  });
}

export function useAdminPerformance(
  lineAccountId: number,
  startDate?: string,
  endDate?: string
) {
  return useQuery<{ admins: AdminMetric[]; dateRange: DateRange }>({
    queryKey: ['analytics', 'admins', lineAccountId, startDate, endDate],
    queryFn: async () => {
      const params = new URLSearchParams({
        lineAccountId: lineAccountId.toString(),
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/inbox/analytics/admins?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch admin performance');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: !!lineAccountId,
  });
}

export function useConversationTrends(
  lineAccountId: number,
  startDate?: string,
  endDate?: string,
  groupBy: 'hour' | 'day' | 'week' | 'month' = 'day'
) {
  return useQuery<{
    trends: ConversationTrend[];
    busiestHours: BusiestHour[];
    peakHours: number[];
    groupBy: string;
    dateRange: DateRange;
  }>({
    queryKey: ['analytics', 'conversations', lineAccountId, startDate, endDate, groupBy],
    queryFn: async () => {
      const params = new URLSearchParams({
        lineAccountId: lineAccountId.toString(),
        groupBy,
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/inbox/analytics/conversations?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch conversation trends');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: !!lineAccountId,
  });
}

export function useSLAMetrics(
  lineAccountId: number,
  startDate?: string,
  endDate?: string,
  slaThresholdMinutes: number = 30
) {
  return useQuery<SLAMetrics>({
    queryKey: ['analytics', 'sla', lineAccountId, startDate, endDate, slaThresholdMinutes],
    queryFn: async () => {
      const params = new URLSearchParams({
        lineAccountId: lineAccountId.toString(),
        slaThresholdMinutes: slaThresholdMinutes.toString(),
      });
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      const response = await fetch(`/api/inbox/analytics/sla?${params}`);
      if (!response.ok) {
        throw new Error('Failed to fetch SLA metrics');
      }
      const data = await response.json();
      return data.data;
    },
    enabled: !!lineAccountId,
  });
}

export function exportAnalytics(
  lineAccountId: number,
  type: 'overview' | 'admins' | 'conversations' | 'sla',
  startDate?: string,
  endDate?: string
) {
  const params = new URLSearchParams({
    lineAccountId: lineAccountId.toString(),
    type,
  });
  if (startDate) params.append('startDate', startDate);
  if (endDate) params.append('endDate', endDate);

  const url = `/api/inbox/analytics/export?${params}`;
  
  // Trigger download
  const link = document.createElement('a');
  link.href = url;
  link.download = `analytics-${type}-${Date.now()}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
