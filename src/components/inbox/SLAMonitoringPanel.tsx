'use client';

import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSLAMetrics } from '@/hooks/use-analytics';
import { AlertTriangle, CheckCircle2, Clock, TrendingDown, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SLAMonitoringPanelProps {
  lineAccountId: number;
  slaThresholdMinutes?: number;
}

export function SLAMonitoringPanel({ 
  lineAccountId, 
  slaThresholdMinutes = 30 
}: SLAMonitoringPanelProps) {
  const { data: slaData, isLoading } = useSLAMetrics(
    lineAccountId,
    undefined,
    undefined,
    slaThresholdMinutes
  );

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>SLA Monitoring</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-48 bg-muted animate-pulse rounded" />
        </CardContent>
      </Card>
    );
  }

  if (!slaData) return null;

  const complianceColor = 
    slaData.slaComplianceRate >= 90 ? 'text-green-600' :
    slaData.slaComplianceRate >= 75 ? 'text-yellow-600' :
    'text-red-600';

  return (
    <div className="space-y-4">
      {/* SLA Overview */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Compliance</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className={cn('text-2xl font-bold', complianceColor)}>
              {slaData.slaComplianceRate}%
            </div>
            <p className="text-xs text-muted-foreground">
              {slaData.conversationsWithinSLA} of {slaData.totalConversationsChecked} within SLA
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg First Response</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {slaData.averageFirstResponseTimeMinutes} min
            </div>
            <p className="text-xs text-muted-foreground">
              Target: {slaData.slaThresholdMinutes} min
            </p>
            {slaData.averageFirstResponseTimeMinutes > slaData.slaThresholdMinutes ? (
              <div className="flex items-center gap-1 text-xs text-red-600 mt-1">
                <TrendingUp className="h-3 w-3" />
                Above target
              </div>
            ) : (
              <div className="flex items-center gap-1 text-xs text-green-600 mt-1">
                <TrendingDown className="h-3 w-3" />
                Below target
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SLA Breaches</CardTitle>
            <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {slaData.conversationsExceedingSLA}
            </div>
            <div className="flex gap-2 text-xs mt-2">
              <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                {slaData.breachSeverity.minor} minor
              </Badge>
              <Badge variant="outline" className="text-orange-600 border-orange-600">
                {slaData.breachSeverity.moderate} moderate
              </Badge>
              <Badge variant="outline" className="text-red-600 border-red-600">
                {slaData.breachSeverity.severe} severe
              </Badge>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Conversations Exceeding SLA */}
      {slaData.exceedingSLADetails.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              Conversations Exceeding SLA
            </CardTitle>
            <CardDescription>
              Conversations that need immediate attention
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {slaData.exceedingSLADetails.map((detail) => {
                const severity = 
                  detail.firstResponseTime && detail.firstResponseTime > slaThresholdMinutes * 60 * 1000 * 3 ? 'severe' :
                  detail.firstResponseTime && detail.firstResponseTime > slaThresholdMinutes * 60 * 1000 * 2 ? 'moderate' :
                  'minor';

                const severityColor = 
                  severity === 'severe' ? 'border-red-500 bg-red-50' :
                  severity === 'moderate' ? 'border-orange-500 bg-orange-50' :
                  'border-yellow-500 bg-yellow-50';

                return (
                  <div 
                    key={detail.userId} 
                    className={cn(
                      'flex items-center justify-between p-3 rounded-lg border-l-4',
                      severityColor
                    )}
                  >
                    <div className="flex-1">
                      <div className="font-medium">{detail.userName}</div>
                      <div className="text-sm text-muted-foreground">
                        Response time: {detail.responseTimeMinutes} minutes
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge 
                        variant={severity === 'severe' ? 'destructive' : 'outline'}
                        className={cn(
                          severity === 'moderate' && 'border-orange-600 text-orange-600',
                          severity === 'minor' && 'border-yellow-600 text-yellow-600'
                        )}
                      >
                        {severity}
                      </Badge>
                      <Button size="sm" variant="outline">
                        View
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* SLA Performance Trend */}
      <Card>
        <CardHeader>
          <CardTitle>SLA Performance</CardTitle>
          <CardDescription>
            Response time distribution
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Within SLA</span>
              <span className="text-sm text-muted-foreground">
                {slaData.conversationsWithinSLA} conversations
              </span>
            </div>
            <div className="h-4 bg-muted rounded-full overflow-hidden">
              <div 
                className="h-full bg-green-500"
                style={{ width: `${slaData.slaComplianceRate}%` }}
              />
            </div>

            <div className="grid grid-cols-3 gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {slaData.conversationsWithinSLA}
                </div>
                <div className="text-xs text-muted-foreground">Within SLA</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">
                  {slaData.breachSeverity.minor}
                </div>
                <div className="text-xs text-muted-foreground">Minor Breach</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">
                  {slaData.breachSeverity.moderate + slaData.breachSeverity.severe}
                </div>
                <div className="text-xs text-muted-foreground">Major Breach</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
