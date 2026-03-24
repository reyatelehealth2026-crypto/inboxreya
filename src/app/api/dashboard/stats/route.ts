import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const data = await cacheQuery(
      'dashboard:stats:global',
      async () => {
        // Get total messages + customers พร้อมกัน
        const [totalMessages, totalCustomers, sentMessages, receivedMessages] =
          await Promise.all([
            prisma.message.count(),
            prisma.lineUser.count(),
            prisma.message.count({ where: { direction: 'outgoing' } }),
            prisma.message.count({ where: { direction: 'incoming' } }),
          ])

        const responseRate = receivedMessages > 0
          ? Math.round((sentMessages / receivedMessages) * 100)
          : 0

        const avgResponseTime = await getAverageResponseTime()

        return { totalMessages, totalCustomers, responseRate, avgResponseTime }
      },
      CACHE_TTL.DASHBOARD_STATS
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Failed to fetch dashboard stats:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dashboard stats' },
      { status: 500 }
    )
  }
}

async function getAverageResponseTime(): Promise<number> {
  try {
    const result = await prisma.$queryRaw<{ avg_diff: number | null }[]>`
        SELECT AVG(TIMESTAMPDIFF(MINUTE, incoming.created_at, outgoing.created_at)) as avg_diff
        FROM messages as incoming
        JOIN messages as outgoing ON incoming.user_id = outgoing.user_id
        WHERE incoming.direction = 'incoming'
        AND outgoing.direction = 'outgoing'
        AND outgoing.created_at > incoming.created_at
        AND outgoing.created_at < DATE_ADD(incoming.created_at, INTERVAL 24 HOUR)
        AND incoming.created_at > DATE_SUB(NOW(), INTERVAL 30 DAY)
     `
    return Math.round(Number(result[0]?.avg_diff || 0))
  } catch (e) {
    console.error('Error calculating response time', e)
    return 0
  }
}
