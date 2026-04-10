import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { cacheQuery, CACHE_TTL } from '@/lib/redis';

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

    const cacheKey = `analytics:conv:${lineAccountIdNum}:${groupBy}:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`;
    const data = await cacheQuery(cacheKey, async () => {
      type TrendRow = { period: string; conversation_count: bigint; incoming: bigint; outgoing: bigint };
      type HourlyRow = { hour: number; message_count: bigint };

      // Use SQL aggregation — avoid loading all messages into memory
      let trendRows: TrendRow[];
      if (groupBy === 'week') {
        trendRows = await prisma.$queryRaw<TrendRow[]>`
          SELECT
            DATE_FORMAT(DATE_SUB(created_at, INTERVAL WEEKDAY(created_at) DAY), '%Y-%m-%d') AS period,
            COUNT(DISTINCT user_id) AS conversation_count,
            SUM(IF(direction = 'incoming', 1, 0)) AS incoming,
            SUM(IF(direction = 'outgoing', 1, 0)) AS outgoing
          FROM messages
          WHERE line_account_id = ${lineAccountIdNum}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY period
          ORDER BY period
        `;
      } else {
        const fmt = groupBy === 'hour' ? '%Y-%m-%dT%H'
          : groupBy === 'month' ? '%Y-%m'
          : '%Y-%m-%d';
        trendRows = await prisma.$queryRaw<TrendRow[]>`
          SELECT
            DATE_FORMAT(created_at, ${fmt}) AS period,
            COUNT(DISTINCT user_id) AS conversation_count,
            SUM(IF(direction = 'incoming', 1, 0)) AS incoming,
            SUM(IF(direction = 'outgoing', 1, 0)) AS outgoing
          FROM messages
          WHERE line_account_id = ${lineAccountIdNum}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
          GROUP BY period
          ORDER BY period
        `;
      }

      const hourlyRows = await prisma.$queryRaw<HourlyRow[]>`
        SELECT
          HOUR(created_at) AS hour,
          COUNT(*) AS message_count
        FROM messages
        WHERE line_account_id = ${lineAccountIdNum}
          AND created_at >= ${startDate}
          AND created_at <= ${endDate}
        GROUP BY HOUR(created_at)
        ORDER BY hour
      `;

      const trends = trendRows.map(row => ({
        period: row.period,
        conversationCount: Number(row.conversation_count),
        incomingMessages: Number(row.incoming),
        outgoingMessages: Number(row.outgoing),
        totalMessages: Number(row.incoming) + Number(row.outgoing),
      }));

      // Build full 0–23 hour distribution
      const busiestHours = Array.from({ length: 24 }, (_, i) => ({ hour: i, messageCount: 0 }));
      for (const row of hourlyRows) {
        busiestHours[Number(row.hour)].messageCount = Number(row.message_count);
      }

      const peakHours = [...busiestHours]
        .sort((a, b) => b.messageCount - a.messageCount)
        .slice(0, 3)
        .map(h => h.hour);

      return {
        trends,
        busiestHours,
        peakHours,
        groupBy,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
    }, CACHE_TTL.HEALTH);

    return NextResponse.json({ success: true, data });
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
