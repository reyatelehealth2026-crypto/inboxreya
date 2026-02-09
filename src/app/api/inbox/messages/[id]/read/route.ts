import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Message id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'Message id must be a number' }, { status: 400 })
    }

    const message = await prisma.message.findUnique({
      where: { id: parsedId },
      include: {
        user: { select: { lineAccountId: true } },
      },
    })

    if (!message) {
      return NextResponse.json({ error: 'Message not found' }, { status: 404 })
    }

    if (
      session.user.role !== 'super_admin' &&
      session.user.lineAccountId &&
      (!message.user || message.user.lineAccountId !== session.user.lineAccountId)
    ) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    if (!message.isRead) {
      await prisma.message.update({
        where: { id: parsedId },
        data: { isRead: true },
      })
    }

    broadcastRealtimeEvent({
      type: 'read_receipt',
      data: {
        conversationId: message.userId?.toString() ?? '',
        messageIds: [message.id.toString()],
        readBy: session.user.id,
        readAt: new Date().toISOString(),
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error marking message as read:', error)
    return NextResponse.json(
      { error: 'Failed to mark message as read' },
      { status: 500 }
    )
  }
}
