import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * GET /api/inbox/analytics/sla
 * 
 * Returns SLA monitoring metrics:
 * - SLA compliance rate
 * - Conversations exceeding SLA
 * - Average time to first response
 * - SLA breach details
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - lineAccountId: number (required)
 * - slaThresholdMinutes: number (default: 30)
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const lineAccountId = searchParams.get('lineAccountId');
    const startDateParam = searchParams.get('startDate');
    const endDateParam = searchParams.get('endDate');
    const slaThresholdMinutes = parseInt(searchParams.get('slaThresholdMinutes') || '30');

    if (!lineAccountId) {
      return NextResponse.json(
        { success: false, error: 'lineAccountId is required' },
        { status: 400 }
      );
    }

    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const lineAccountIdNum = parseInt(lineAccountId);
    const slaThresholdMs = slaThresholdMinutes * 60 * 1000;

    // Get all users with messages in date range
    const users = await prisma.lineUser.findMany({
      where: {
        lineAccountId: lineAccountIdNum,
        lastInteraction: {
          gte: startDate,
          lte: endDate,
        },
      },
      include: {
        messages: {
          where: {
            createdAt: {
              gte: startDate,
              lte: endDate,
            },
          },
          orderBy: {
            createdAt: 'asc',
          },
        },
      },
    });

    // Calculate SLA metrics
    const slaMetrics: {
      userId: number;
      userName: string;
      firstResponseTime: number | null;
      withinSLA: boolean;
      responseTimeMinutes: number | null;
    }[] = [];

    let totalWithinSLA = 0;
    let totalChecked = 0;
    let totalResponseTime = 0;
    let responseCount = 0;

    users.forEach(user => {
      const messages = user.messages;

      // Find first customer message and first admin response
      const firstIncoming = messages.find(m => m.direction === 'incoming');
      if (!firstIncoming) return;

      const firstOutgoing = messages.find(
        m => m.direction === 'outgoing' && m.createdAt > firstIncoming.createdAt
      );

      if (firstOutgoing) {
        const responseTime = firstOutgoing.createdAt.getTime() - firstIncoming.createdAt.getTime();
        const responseTimeMinutes = Math.round(responseTime / 1000 / 60);
        const withinSLA = responseTime <= slaThresholdMs;

        slaMetrics.push({
          userId: user.id,
          userName: user.displayName || 'Unknown',
          firstResponseTime: responseTime,
          withinSLA,
          responseTimeMinutes,
        });

        totalChecked++;
        if (withinSLA) {
          totalWithinSLA++;
        }
        totalResponseTime += responseTime;
        responseCount++;
      }
    });

    const slaComplianceRate = totalChecked > 0
      ? Math.round((totalWithinSLA / totalChecked) * 100)
      : 100;

    const averageFirstResponseTimeMs = responseCount > 0
      ? totalResponseTime / responseCount
      : 0;
    const averageFirstResponseTimeMinutes = Math.round(averageFirstResponseTimeMs / 1000 / 60);

    // Get conversations exceeding SLA
    const exceedingSLA = slaMetrics
      .filter(m => !m.withinSLA)
      .sort((a, b) => (b.firstResponseTime || 0) - (a.firstResponseTime || 0));

    // Calculate SLA breach severity
    const breachSeverity = {
      minor: 0,  // 1-2x threshold
      moderate: 0, // 2-3x threshold
      severe: 0,  // 3x+ threshold
    };

    exceedingSLA.forEach(metric => {
      if (!metric.firstResponseTime) return;
      const multiplier = metric.firstResponseTime / slaThresholdMs;
      if (multiplier < 2) {
        breachSeverity.minor++;
      } else if (multiplier < 3) {
        breachSeverity.moderate++;
      } else {
        breachSeverity.severe++;
      }
    });

    return NextResponse.json({
      success: true,
      data: {
        slaComplianceRate,
        averageFirstResponseTimeMinutes,
        slaThresholdMinutes,
        totalConversationsChecked: totalChecked,
        conversationsWithinSLA: totalWithinSLA,
        conversationsExceedingSLA: exceedingSLA.length,
        breachSeverity,
        exceedingSLADetails: exceedingSLA.slice(0, 10), // Top 10 worst
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('SLA analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch SLA analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
