import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { broadcastMessageRead } from '@/lib/pusher'

export async function PUT(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const { user: sessionUser } = authResult
    const session = { user: sessionUser }

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
      const readPayload = {
        conversationId: conversationId.toString(),
        messageIds: [],
        readBy: session.user.id ?? null,
        readAt,
        scope: 'account' as const,
      }

      broadcastRealtimeEvent({
        type: 'read_receipt',
        data: readPayload,
        timestamp: Date.now(),
      })

      void broadcastMessageRead(readPayload)
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
