import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { cacheQuery, CACHE_TTL } from '@/lib/redis';

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

    const endDate = endDateParam ? new Date(endDateParam) : new Date();
    const startDate = startDateParam
      ? new Date(startDateParam)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const lineAccountIdNum = parseInt(lineAccountId);

    const cacheKey = `analytics:overview:${lineAccountIdNum}:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`;
    const data = await cacheQuery(cacheKey, async () => {
      type StatusRow = { chat_status: string | null; cnt: bigint };
      type MsgRow = { total: bigint; incoming: bigint; outgoing: bigint };
      type SlaRow = { avg_response_minutes: number | null; within_sla: bigint; total_checked: bigint };

      const [statusRows, msgRows, slaRows] = await Promise.all([
        // Conversation counts grouped by status
        prisma.$queryRaw<StatusRow[]>`
          SELECT chat_status, COUNT(*) AS cnt
          FROM users
          WHERE line_account_id = ${lineAccountIdNum}
            AND last_interaction >= ${startDate}
            AND last_interaction <= ${endDate}
          GROUP BY chat_status
        `,
        // Message volume totals
        prisma.$queryRaw<MsgRow[]>`
          SELECT
            COUNT(*) AS total,
            SUM(IF(direction = 'incoming', 1, 0)) AS incoming,
            SUM(IF(direction = 'outgoing', 1, 0)) AS outgoing
          FROM messages
          WHERE line_account_id = ${lineAccountIdNum}
            AND created_at >= ${startDate}
            AND created_at <= ${endDate}
        `,
        // Response time & SLA — aggregate first-response-per-user in a subquery to avoid self-join
        prisma.$queryRaw<SlaRow[]>`
          SELECT
            AVG(response_minutes) AS avg_response_minutes,
            SUM(IF(response_minutes <= 30, 1, 0)) AS within_sla,
            COUNT(*) AS total_checked
          FROM (
            SELECT
              user_id,
              TIMESTAMPDIFF(MINUTE,
                MIN(CASE WHEN direction = 'incoming' THEN created_at END),
                MIN(CASE WHEN direction = 'outgoing' THEN created_at END)
              ) AS response_minutes
            FROM messages
            WHERE line_account_id = ${lineAccountIdNum}
              AND created_at >= ${startDate}
              AND created_at <= ${endDate}
            GROUP BY user_id
            HAVING
              MIN(CASE WHEN direction = 'incoming' THEN created_at END) IS NOT NULL
              AND MIN(CASE WHEN direction = 'outgoing' THEN created_at END) IS NOT NULL
              AND MIN(CASE WHEN direction = 'outgoing' THEN created_at END) >
                  MIN(CASE WHEN direction = 'incoming' THEN created_at END)
          ) AS first_responses
        `,
      ]);

      // Build status breakdown
      const conversationsByStatus = { new: 0, in_progress: 0, waiting: 0, resolved: 0 };
      let totalConversations = 0;
      for (const row of statusRows) {
        const cnt = Number(row.cnt);
        totalConversations += cnt;
        const status = row.chat_status || 'new';
        if (status in conversationsByStatus) {
          conversationsByStatus[status as keyof typeof conversationsByStatus] += cnt;
        }
      }

      const msg = msgRows[0] ?? { total: BigInt(0), incoming: BigInt(0), outgoing: BigInt(0) };
      const sla = slaRows[0] ?? { avg_response_minutes: null, within_sla: BigInt(0), total_checked: BigInt(0) };
      const totalChecked = Number(sla.total_checked);
      const slaComplianceRate = totalChecked > 0
        ? Math.round((Number(sla.within_sla) / totalChecked) * 100)
        : 100;

      return {
        totalConversations,
        averageResponseTimeMinutes: Math.round(Number(sla.avg_response_minutes ?? 0)),
        slaComplianceRate,
        conversationsByStatus,
        messageVolume: {
          total: Number(msg.total),
          incoming: Number(msg.incoming),
          outgoing: Number(msg.outgoing),
        },
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
    }, CACHE_TTL.HEALTH);

    return NextResponse.json({ success: true, data });
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
