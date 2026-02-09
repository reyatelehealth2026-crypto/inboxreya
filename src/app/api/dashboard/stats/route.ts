import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get total messages count
    const totalMessages = await prisma.message.count()

    // Get total customers count
    const totalCustomers = await prisma.lineUser.count()

    // Calculate response rate (messages sent by admins vs received)
    const sentMessages = await prisma.message.count({
      where: { direction: 'outgoing' }
    })
    const receivedMessages = await prisma.message.count({
      where: { direction: 'incoming' }
    })
    const responseRate = receivedMessages > 0
      ? Math.round((sentMessages / receivedMessages) * 100)
      : 0

    /*
      Logic: Average time between a customer's message (incoming) and the *next* admin response (outgoing).
      We join messages on user_id, looking for the first outgoing message that appears AFTER an incoming message.
      We limit the search window to 24 hours to avoid skewing data with long-unanswered threads that were later revived.
    */
    const avgResponseTime = await getAverageResponseTime()

    return NextResponse.json({
      success: true,
      data: {
        totalMessages,
        totalCustomers,
        responseRate,
        avgResponseTime
      }
    })
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
