import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * GET /api/inbox/analytics/conversations
 * 
 * Returns conversation trends over time:
 * - Daily/weekly/monthly conversation counts
 * - Busiest hours heatmap
 * - Message volume trends
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - lineAccountId: number (required)
 * - groupBy: 'hour' | 'day' | 'week' | 'month' (default: 'day')
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
    const groupBy = searchParams.get('groupBy') || 'day';

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

    // Get all messages in date range
    const messages = await prisma.message.findMany({
      where: {
        lineAccountId: lineAccountIdNum,
        createdAt: {
          gte: startDate,
          lte: endDate,
        },
      },
      select: {
        id: true,
        userId: true,
        direction: true,
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    // Group messages by time period
    const trendData: Record<string, {
      conversations: Set<number>,
      incoming: number,
      outgoing: number
    }> = {};

    const hourlyData: Record<number, number> = {};
    for (let i = 0; i < 24; i++) {
      hourlyData[i] = 0;
    }

    messages.forEach(message => {
      const date = new Date(message.createdAt);
      let key: string;

      // Group by specified period
      if (groupBy === 'hour') {
        key = date.toISOString().slice(0, 13); // YYYY-MM-DDTHH
      } else if (groupBy === 'day') {
        key = date.toISOString().slice(0, 10); // YYYY-MM-DD
      } else if (groupBy === 'week') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().slice(0, 10);
      } else if (groupBy === 'month') {
        key = date.toISOString().slice(0, 7); // YYYY-MM
      } else {
        key = date.toISOString().slice(0, 10);
      }

      if (!trendData[key]) {
        trendData[key] = {
          conversations: new Set(),
          incoming: 0,
          outgoing: 0,
        };
      }

      if (message.userId) {
        trendData[key].conversations.add(message.userId);
      }
      if (message.direction === 'incoming') {
        trendData[key].incoming++;
      } else if (message.direction === 'outgoing') {
        trendData[key].outgoing++;
      }

      // Track hourly distribution
      const hour = date.getHours();
      hourlyData[hour]++;
    });

    // Convert to array format
    const trends = Object.entries(trendData).map(([period, data]) => ({
      period,
      conversationCount: data.conversations.size,
      incomingMessages: data.incoming,
      outgoingMessages: data.outgoing,
      totalMessages: data.incoming + data.outgoing,
    }));

    // Convert hourly data to array
    const busiestHours = Object.entries(hourlyData).map(([hour, count]) => ({
      hour: parseInt(hour),
      messageCount: count,
    }));

    // Calculate peak hours
    const sortedHours = [...busiestHours].sort((a, b) => b.messageCount - a.messageCount);
    const peakHours = sortedHours.slice(0, 3).map(h => h.hour);

    return NextResponse.json({
      success: true,
      data: {
        trends,
        busiestHours,
        peakHours,
        groupBy,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      },
    });
  } catch (error) {
    console.error('Conversation trends error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch conversation trends',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
