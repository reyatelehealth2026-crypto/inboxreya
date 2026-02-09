import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * GET /api/inbox/analytics/overview
 * 
 * Returns analytics dashboard overview metrics:
 * - Total conversations count
 * - Average response time
 * - SLA compliance rate
 * - Conversations by status breakdown
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - lineAccountId: number (required)
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

    if (!lineAccountId) {
      return NextResponse.json(
        { success: false, error: 'lineAccountId is required' },
        { status: 400 }
      );
    }

    // Default to last 30 days
    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const lineAccountIdNum = parseInt(lineAccountId);

    // Get all users (conversations) for this account in date range
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
        conversationAssignments: {
          where: {
            assignedAt: {
              gte: startDate,
              lte: endDate,
            },
          },
        },
      },
    });

    // Calculate total conversations
    const totalConversations = users.length;

    // Calculate conversations by status
    const conversationsByStatus = {
      new: 0,
      in_progress: 0,
      waiting: 0,
      resolved: 0,
    };

    users.forEach(user => {
      const status = user.chatStatus || 'new';
      if (status in conversationsByStatus) {
        conversationsByStatus[status as keyof typeof conversationsByStatus]++;
      }
    });

    // Calculate average response time
    let totalResponseTime = 0;
    let responseCount = 0;

    users.forEach(user => {
      const messages = user.messages;
      for (let i = 0; i < messages.length - 1; i++) {
        const currentMsg = messages[i];
        const nextMsg = messages[i + 1];

        // If customer message followed by admin message
        if (currentMsg.direction === 'incoming' && nextMsg.direction === 'outgoing') {
          const responseTime = nextMsg.createdAt.getTime() - currentMsg.createdAt.getTime();
          totalResponseTime += responseTime;
          responseCount++;
        }
      }
    });

    const averageResponseTimeMs = responseCount > 0
      ? totalResponseTime / responseCount
      : 0;
    const averageResponseTimeMinutes = Math.round(averageResponseTimeMs / 1000 / 60);

    // Calculate SLA compliance (assuming 30 minute SLA threshold)
    const slaThresholdMs = 30 * 60 * 1000; // 30 minutes
    let withinSLA = 0;
    let totalSLAChecks = 0;

    users.forEach(user => {
      const messages = user.messages;
      for (let i = 0; i < messages.length - 1; i++) {
        const currentMsg = messages[i];
        const nextMsg = messages[i + 1];

        if (currentMsg.direction === 'incoming' && nextMsg.direction === 'outgoing') {
          const responseTime = nextMsg.createdAt.getTime() - currentMsg.createdAt.getTime();
          totalSLAChecks++;
          if (responseTime <= slaThresholdMs) {
            withinSLA++;
          }
        }
      }
    });

    const slaComplianceRate = totalSLAChecks > 0
      ? Math.round((withinSLA / totalSLAChecks) * 100)
      : 100;

    // Get message volume
    const totalMessages = users.reduce((sum, user) => sum + user.messages.length, 0);
    const incomingMessages = users.reduce(
      (sum, user) => sum + user.messages.filter(m => m.direction === 'incoming').length,
      0
    );
    const outgoingMessages = users.reduce(
      (sum, user) => sum + user.messages.filter(m => m.direction === 'outgoing').length,
      0
    );

    return NextResponse.json({
      success: true,
      data: {
        totalConversations,
        averageResponseTimeMinutes,
        slaComplianceRate,
        conversationsByStatus,
        messageVolume: {
          total: totalMessages,
          incoming: incomingMessages,
          outgoing: outgoingMessages,
        },
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Analytics overview error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch analytics overview',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
