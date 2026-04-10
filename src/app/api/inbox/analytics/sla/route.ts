import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { cacheQuery, CACHE_TTL } from '@/lib/redis';

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

    const cacheKey = `analytics:sla:${lineAccountIdNum}:${slaThresholdMinutes}:${startDate.toISOString().slice(0, 10)}:${endDate.toISOString().slice(0, 10)}`;
    const data = await cacheQuery(cacheKey, async () => {
      type ResponseRow = {
        user_id: number;
        display_name: string | null;
        response_minutes: number;
      };
      type SummaryRow = {
        avg_response_minutes: number | null;
        within_sla: bigint;
        total_checked: bigint;
      };

      // Single query: first-response per user grouped in DB
      const [responseRows, summaryRows] = await Promise.all([
        prisma.$queryRaw<ResponseRow[]>`
          SELECT
            m.user_id,
            u.display_name,
            TIMESTAMPDIFF(MINUTE,
              MIN(CASE WHEN m.direction = 'incoming' THEN m.created_at END),
              MIN(CASE WHEN m.direction = 'outgoing' THEN m.created_at END)
            ) AS response_minutes
          FROM messages m
          INNER JOIN users u ON m.user_id = u.id
          WHERE m.line_account_id = ${lineAccountIdNum}
            AND m.created_at >= ${startDate}
            AND m.created_at <= ${endDate}
          GROUP BY m.user_id, u.display_name
          HAVING
            MIN(CASE WHEN m.direction = 'incoming' THEN m.created_at END) IS NOT NULL
            AND MIN(CASE WHEN m.direction = 'outgoing' THEN m.created_at END) IS NOT NULL
            AND MIN(CASE WHEN m.direction = 'outgoing' THEN m.created_at END) >
                MIN(CASE WHEN m.direction = 'incoming' THEN m.created_at END)
          ORDER BY response_minutes DESC
          LIMIT 500
        `,
        prisma.$queryRaw<SummaryRow[]>`
          SELECT
            AVG(response_minutes) AS avg_response_minutes,
            SUM(IF(response_minutes <= ${slaThresholdMinutes}, 1, 0)) AS within_sla,
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

      const summary = summaryRows[0] ?? { avg_response_minutes: null, within_sla: BigInt(0), total_checked: BigInt(0) };
      const totalChecked = Number(summary.total_checked);
      const slaComplianceRate = totalChecked > 0
        ? Math.round((Number(summary.within_sla) / totalChecked) * 100)
        : 100;
      const averageFirstResponseTimeMinutes = Math.round(Number(summary.avg_response_minutes ?? 0));

      // Build breach details from the per-user response rows
      const exceedingSLA = responseRows
        .filter(r => r.response_minutes > slaThresholdMinutes)
        .map(r => ({
          userId: r.user_id,
          userName: r.display_name || 'Unknown',
          firstResponseTime: r.response_minutes * 60 * 1000, // ms for backward compat
          withinSLA: false,
          responseTimeMinutes: r.response_minutes,
        }));

      const breachSeverity = { minor: 0, moderate: 0, severe: 0 };
      for (const r of exceedingSLA) {
        const multiplier = r.responseTimeMinutes / slaThresholdMinutes;
        if (multiplier < 2) breachSeverity.minor++;
        else if (multiplier < 3) breachSeverity.moderate++;
        else breachSeverity.severe++;
      }

      return {
        slaComplianceRate,
        averageFirstResponseTimeMinutes,
        slaThresholdMinutes,
        totalConversationsChecked: totalChecked,
        conversationsWithinSLA: Number(summary.within_sla),
        conversationsExceedingSLA: exceedingSLA.length,
        breachSeverity,
        exceedingSLADetails: exceedingSLA.slice(0, 10),
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
    }, CACHE_TTL.HEALTH);

    return NextResponse.json({ success: true, data });
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
