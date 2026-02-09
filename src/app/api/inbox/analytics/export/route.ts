import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';

/**
 * GET /api/inbox/analytics/export
 * 
 * Exports analytics data in CSV format
 * 
 * Query params:
 * - startDate: ISO date string (default: 30 days ago)
 * - endDate: ISO date string (default: now)
 * - lineAccountId: number (required)
 * - type: 'overview' | 'admins' | 'conversations' | 'sla' (default: 'overview')
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
    const exportType = searchParams.get('type') || 'overview';

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

    let csvContent = '';
    let filename = '';

    if (exportType === 'overview') {
      // Export overview metrics
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
          },
        },
      });

      csvContent = 'Metric,Value\n';
      csvContent += `Total Conversations,${users.length}\n`;
      csvContent += `Date Range,"${startDate.toISOString()} to ${endDate.toISOString()}"\n`;

      const totalMessages = users.reduce((sum, u) => sum + u.messages.length, 0);
      csvContent += `Total Messages,${totalMessages}\n`;

      filename = `inbox-analytics-overview-${Date.now()}.csv`;

    } else if (exportType === 'admins') {
      // Export admin performance
      const admins = await prisma.adminUser.findMany({
        where: {
          lineAccountId: lineAccountIdNum,
          isActive: true,
        },
      });

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
              },
            },
          },
        },
      });

      csvContent = 'Admin Name,Email,Conversations Handled,Messages Sent,Avg Response Time (min)\n';

      admins.forEach(admin => {
        const adminAssignments = assignments.filter(a => a.adminId === admin.id);
        const conversationsHandled = adminAssignments.length;
        const messagesSent = adminAssignments.reduce(
          (sum, a) => sum + a.user.messages.filter(m => m.direction === 'outgoing').length,
          0
        );

        csvContent += `"${admin.displayName || admin.username}","${admin.email}",${conversationsHandled},${messagesSent},0\n`;
      });

      filename = `inbox-analytics-admins-${Date.now()}.csv`;

    } else if (exportType === 'conversations') {
      // Export conversation trends
      const messages = await prisma.message.findMany({
        where: {
          lineAccountId: lineAccountIdNum,
          createdAt: {
            gte: startDate,
            lte: endDate,
          },
        },
        include: {
          user: true,
        },
      });

      csvContent = 'Date,User Name,Direction,Message Type,Content Preview\n';

      messages.forEach(msg => {
        const date = msg.createdAt.toISOString().slice(0, 10);
        const userName = msg.user?.displayName || 'Unknown';
        const contentPreview = (msg.content || '').slice(0, 50).replace(/"/g, '""');
        csvContent += `"${date}","${userName}","${msg.direction}","${msg.messageType}","${contentPreview}"\n`;
      });

      filename = `inbox-analytics-conversations-${Date.now()}.csv`;

    } else if (exportType === 'sla') {
      // Export SLA metrics
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

      csvContent = 'User Name,First Message Time,First Response Time,Response Time (min),Within SLA\n';

      const slaThresholdMs = 30 * 60 * 1000; // 30 minutes

      users.forEach(user => {
        const firstIncoming = user.messages.find(m => m.direction === 'incoming');
        if (!firstIncoming) return;

        const firstOutgoing = user.messages.find(
          m => m.direction === 'outgoing' && m.createdAt > firstIncoming.createdAt
        );

        if (firstOutgoing) {
          const responseTime = firstOutgoing.createdAt.getTime() - firstIncoming.createdAt.getTime();
          const responseTimeMinutes = Math.round(responseTime / 1000 / 60);
          const withinSLA = responseTime <= slaThresholdMs ? 'Yes' : 'No';

          csvContent += `"${user.displayName || 'Unknown'}","${firstIncoming.createdAt.toISOString()}","${firstOutgoing.createdAt.toISOString()}",${responseTimeMinutes},${withinSLA}\n`;
        }
      });

      filename = `inbox-analytics-sla-${Date.now()}.csv`;
    }

    // Return CSV file
    return new NextResponse(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    });

  } catch (error) {
    console.error('Analytics export error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to export analytics',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
