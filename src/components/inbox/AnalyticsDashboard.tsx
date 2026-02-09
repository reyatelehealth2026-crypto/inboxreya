'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { 
  useAnalyticsOverview, 
  useAdminPerformance, 
  useConversationTrends,
  useSLAMetrics,
  exportAnalytics 
} from '@/hooks/use-analytics';
import { 
  CalendarIcon, 
  Download, 
  TrendingUp, 
  Users, 
  MessageSquare, 
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface AnalyticsDashboardProps {
  lineAccountId: number;
}

export function AnalyticsDashboard({ lineAccountId }: AnalyticsDashboardProps) {
  const [dateRange, setDateRange] = useState<{
    from: Date;
    to: Date;
  }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000), // 30 days ago
    to: new Date(),
  });

  const startDate = dateRange.from.toISOString();
  const endDate = dateRange.to.toISOString();

  const { data: overview, isLoading: overviewLoading } = useAnalyticsOverview(
    lineAccountId,
    startDate,
    endDate
  );

  const { data: adminData, isLoading: adminLoading } = useAdminPerformance(
    lineAccountId,
    startDate,
    endDate
  );

  const { data: trendsData, isLoading: trendsLoading } = useConversationTrends(
    lineAccountId,
    startDate,
    endDate,
    'day'
  );

  const { data: slaData, isLoading: slaLoading } = useSLAMetrics(
    lineAccountId,
    startDate,
    endDate,
    30
  );

  const handleExport = (type: 'overview' | 'admins' | 'conversations' | 'sla') => {
    exportAnalytics(lineAccountId, type, startDate, endDate);
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header with Date Range Picker */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Analytics Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor inbox performance and team metrics
          </p>
        </div>
        
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" className={cn("justify-start text-left font-normal")}>
                <CalendarIcon className="mr-2 h-4 w-4" />
                {format(dateRange.from, 'MMM dd, yyyy')} - {format(dateRange.to, 'MMM dd, yyyy')}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="end">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(range: { from?: Date; to?: Date } | undefined) => {
                  if (range?.from && range?.to) {
                    setDateRange({ from: range.from, to: range.to });
                  }
                }}
                numberOfMonths={2}
              />
            </PopoverContent>
          </Popover>

          <Button
            variant="outline"
            size="icon"
            onClick={() => handleExport('overview')}
            title="Export Analytics"
          >
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Overview Metrics */}
      {overviewLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Loading...</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted animate-pulse rounded" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : overview ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversations</CardTitle>
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.totalConversations}</div>
              <p className="text-xs text-muted-foreground">
                {overview.messageVolume.total} total messages
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg Response Time</CardTitle>
              <Clock className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.averageResponseTimeMinutes} min</div>
              <p className="text-xs text-muted-foreground">
                Time to first response
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{overview.slaComplianceRate}%</div>
              <p className="text-xs text-muted-foreground">
                Within 30 minute threshold
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Conversations</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {overview.conversationsByStatus.in_progress + overview.conversationsByStatus.new}
              </div>
              <p className="text-xs text-muted-foreground">
                {overview.conversationsByStatus.resolved} resolved
              </p>
            </CardContent>
          </Card>
        </div>
      ) : null}

      {/* Conversations by Status */}
      {overview && (
        <Card>
          <CardHeader>
            <CardTitle>Conversations by Status</CardTitle>
            <CardDescription>Distribution of conversation states</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-4 gap-4">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">New</div>
                <div className="text-2xl font-bold">{overview.conversationsByStatus.new}</div>
                <div className="h-2 bg-blue-500 rounded" style={{ 
                  width: `${(overview.conversationsByStatus.new / overview.totalConversations) * 100}%` 
                }} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">In Progress</div>
                <div className="text-2xl font-bold">{overview.conversationsByStatus.in_progress}</div>
                <div className="h-2 bg-yellow-500 rounded" style={{ 
                  width: `${(overview.conversationsByStatus.in_progress / overview.totalConversations) * 100}%` 
                }} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Waiting</div>
                <div className="text-2xl font-bold">{overview.conversationsByStatus.waiting}</div>
                <div className="h-2 bg-orange-500 rounded" style={{ 
                  width: `${(overview.conversationsByStatus.waiting / overview.totalConversations) * 100}%` 
                }} />
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Resolved</div>
                <div className="text-2xl font-bold">{overview.conversationsByStatus.resolved}</div>
                <div className="h-2 bg-green-500 rounded" style={{ 
                  width: `${(overview.conversationsByStatus.resolved / overview.totalConversations) * 100}%` 
                }} />
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Admin Performance */}
      {adminLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Admin Performance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ) : adminData ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Admin Performance</CardTitle>
              <CardDescription>Top performing team members</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('admins')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {adminData.admins.slice(0, 5).map((admin) => (
                <div key={admin.adminId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      {admin.avatarUrl ? (
                        <img src={admin.avatarUrl} alt={admin.adminName} className="h-10 w-10 rounded-full" />
                      ) : (
                        <Users className="h-5 w-5" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium">{admin.adminName}</div>
                      <div className="text-sm text-muted-foreground">{admin.email}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-medium">{admin.conversationsHandled} conversations</div>
                    <div className="text-sm text-muted-foreground">
                      {admin.averageResponseTimeMinutes} min avg response
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* SLA Monitoring */}
      {slaLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>SLA Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-48 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ) : slaData ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>SLA Monitoring</CardTitle>
              <CardDescription>Service level agreement compliance</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('sla')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-3">
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Compliance Rate</div>
                <div className="text-3xl font-bold">{slaData.slaComplianceRate}%</div>
                <div className="text-sm text-muted-foreground">
                  {slaData.conversationsWithinSLA} of {slaData.totalConversationsChecked} within SLA
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">Avg First Response</div>
                <div className="text-3xl font-bold">{slaData.averageFirstResponseTimeMinutes} min</div>
                <div className="text-sm text-muted-foreground">
                  Target: {slaData.slaThresholdMinutes} min
                </div>
              </div>
              <div className="space-y-2">
                <div className="text-sm font-medium text-muted-foreground">SLA Breaches</div>
                <div className="text-3xl font-bold">{slaData.conversationsExceedingSLA}</div>
                <div className="flex gap-2 text-sm">
                  <span className="text-yellow-600">{slaData.breachSeverity.minor} minor</span>
                  <span className="text-orange-600">{slaData.breachSeverity.moderate} moderate</span>
                  <span className="text-red-600">{slaData.breachSeverity.severe} severe</span>
                </div>
              </div>
            </div>

            {slaData.exceedingSLADetails.length > 0 && (
              <div className="mt-6">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-orange-500" />
                  Conversations Exceeding SLA
                </h4>
                <div className="space-y-2">
                  {slaData.exceedingSLADetails.slice(0, 5).map((detail) => (
                    <div key={detail.userId} className="flex items-center justify-between text-sm border-l-2 border-orange-500 pl-3 py-1">
                      <span>{detail.userName}</span>
                      <span className="text-muted-foreground">
                        {detail.responseTimeMinutes} min response time
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {/* Conversation Trends */}
      {trendsLoading ? (
        <Card>
          <CardHeader>
            <CardTitle>Conversation Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64 bg-muted animate-pulse rounded" />
          </CardContent>
        </Card>
      ) : trendsData ? (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Conversation Trends</CardTitle>
              <CardDescription>Message volume over time</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleExport('conversations')}
            >
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-sm text-muted-foreground">
                Peak hours: {trendsData.peakHours.map(h => `${h}:00`).join(', ')}
              </div>
              
              {/* Simple bar chart visualization */}
              <div className="space-y-2">
                {trendsData.trends.slice(-7).map((trend) => (
                  <div key={trend.period} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span>{trend.period}</span>
                      <span className="text-muted-foreground">{trend.totalMessages} messages</span>
                    </div>
                    <div className="flex gap-1 h-8">
                      <div 
                        className="bg-blue-500 rounded" 
                        style={{ width: `${(trend.incomingMessages / trend.totalMessages) * 100}%` }}
                        title={`${trend.incomingMessages} incoming`}
                      />
                      <div 
                        className="bg-green-500 rounded" 
                        style={{ width: `${(trend.outgoingMessages / trend.totalMessages) * 100}%` }}
                        title={`${trend.outgoingMessages} outgoing`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
