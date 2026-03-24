import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { cacheQuery, CACHE_TTL } from '@/lib/redis';

/**
 * GET /api/inbox/analytics/admins
 * 
 * Returns admin performance metrics:
 * - Top performing admins by response count
 * - Average response time per admin
 * - Conversations handled per admin
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

    const cacheKey = `analytics:admins:${lineAccountIdNum}:${startDate.toISOString().slice(0,10)}:${endDate.toISOString().slice(0,10)}`;
    const data = await cacheQuery(cacheKey, async () => {

    // Get all admins for this account
    const admins = await prisma.adminUser.findMany({
      where: {
        lineAccountId: lineAccountIdNum,
        isActive: true,
      },
      select: {
        id: true,
        displayName: true,
        username: true,
        avatarUrl: true,
        email: true,
      },
    });

    // Get conversation assignments in date range
    const assignments = await prisma.conversationAssignment.findMany({
      where: {
        assignedAt: {
          gte: startDate,
          lte: endDate,
        },
        user: {
          lineAccountId: lineAccountIdNum,
        },
      },
      include: {
        user: {
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
        },
        admin: true,
      },
    });

    // Calculate metrics per admin
    const adminMetrics = admins.map(admin => {
      const adminAssignments = assignments.filter(a => a.adminId === admin.id);

      let totalResponseTime = 0;
      let responseCount = 0;
      let messagesHandled = 0;
      let conversationsHandled = adminAssignments.length;

      adminAssignments.forEach(assignment => {
        const messages = assignment.user.messages;

        // Count outgoing messages (admin responses)
        messagesHandled += messages.filter(m => m.direction === 'outgoing').length;

        // Calculate response times
        for (let i = 0; i < messages.length - 1; i++) {
          const currentMsg = messages[i];
          const nextMsg = messages[i + 1];

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

      return {
        adminId: admin.id,
        adminName: admin.displayName || admin.username,
        avatarUrl: admin.avatarUrl,
        email: admin.email,
        conversationsHandled,
        messagesHandled,
        averageResponseTimeMinutes,
        responseCount,
      };
    });

    // Sort by conversations handled (descending)
    adminMetrics.sort((a, b) => b.conversationsHandled - a.conversationsHandled);

    return {
        admins: adminMetrics,
        dateRange: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
        },
      };
    }, CACHE_TTL.HEALTH);  // 60s

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Admin analytics error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch admin analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
