import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'

export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
    }

    const unreadMessages = await prisma.message.findMany({
      where: {
        userId: parsedUserId,
        direction: 'incoming',
        isRead: false,
      },
      select: { id: true },
    })

    if (unreadMessages.length === 0) {
      return NextResponse.json({ success: true, updated: 0, messageIds: [] })
    }

    await prisma.message.updateMany({
      where: {
        userId: parsedUserId,
        direction: 'incoming',
        isRead: false,
      },
      data: { isRead: true },
    })

    const messageIds = unreadMessages.map((msg) => msg.id.toString())

    broadcastRealtimeEvent({
      type: 'read_receipt',
      data: {
        conversationId: parsedUserId.toString(),
        messageIds,
        readBy: session.user.id,
        readAt: new Date().toISOString(),
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true, updated: messageIds.length, messageIds })
  } catch (error) {
    console.error('Error marking messages as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    )
  }
}
