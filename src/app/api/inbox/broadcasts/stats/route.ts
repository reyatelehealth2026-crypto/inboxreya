import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

// GET /api/inbox/broadcasts/stats - Get broadcast statistics
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user: sessionUser } = authResult
    const session = { user: sessionUser }

    const lineAccountId = session.user.lineAccountId
    if (!lineAccountId) {
      return NextResponse.json(
        { success: false, error: 'LINE account ID required' },
        { status: 400 }
      )
    }

    const stats = await cacheQuery(
      `broadcasts:stats:${lineAccountId}`,
      async () => {
        const [total, sent, draft, scheduled, totalRecipients] = await Promise.all([
          prisma.broadcastMessageV2.count({
            where: { lineAccountId },
          }),
          prisma.broadcastMessageV2.count({
            where: { 
              lineAccountId,
              status: 'sent',
            },
          }),
          prisma.broadcastMessageV2.count({
            where: { 
              lineAccountId,
              status: 'draft',
            },
          }),
          prisma.broadcastMessageV2.count({
            where: { 
              lineAccountId,
              status: 'scheduled',
            },
          }),
          prisma.broadcastMessageV2.aggregate({
            where: { 
              lineAccountId,
              status: 'sent',
            },
            _sum: {
              totalRecipients: true,
            },
          }),
        ])

        return {
          total,
          sent,
          draft,
          scheduled,
          totalRecipients: (totalRecipients._sum?.totalRecipients || 0) as number,
        }
      },
      CACHE_TTL.BROADCASTS
    )

    return NextResponse.json({ success: true, data: stats })
  } catch (error: any) {
    console.error('Error fetching broadcast stats:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch broadcast stats' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
