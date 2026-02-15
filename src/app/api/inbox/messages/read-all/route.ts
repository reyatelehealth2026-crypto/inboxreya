import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'

export async function PUT() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const lineAccountId = session.user.lineAccountId
    if (!lineAccountId) {
      return NextResponse.json({ error: 'LINE account not found for user' }, { status: 400 })
    }

    const unreadConversations = await prisma.message.findMany({
      where: {
        lineAccountId,
        direction: 'incoming',
        isRead: false,
        userId: { not: null },
      },
      distinct: ['userId'],
      orderBy: { userId: 'asc' },
      select: { userId: true },
    })

    if (unreadConversations.length === 0) {
      return NextResponse.json({ success: true, updated: 0, conversations: 0 })
    }

    const updateResult = await prisma.message.updateMany({
      where: {
        lineAccountId,
        direction: 'incoming',
        isRead: false,
      },
      data: { isRead: true },
    })

    const readAt = new Date().toISOString()
    const conversationIds = unreadConversations
      .map((c) => c.userId)
      .filter((id): id is number => typeof id === 'number')

    conversationIds.forEach((conversationId) => {
      broadcastRealtimeEvent({
        type: 'read_receipt',
        data: {
          conversationId: conversationId.toString(),
          messageIds: [],
          readBy: session.user.id,
          readAt,
          scope: 'account',
        },
        timestamp: Date.now(),
      })
    })

    return NextResponse.json({
      success: true,
      updated: updateResult.count,
      conversations: conversationIds.length,
    })
  } catch (error) {
    console.error('Error marking all messages as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark all messages as read' },
      { status: 500 }
    )
  }
}
