import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastConversationUpdate } from '@/lib/pusher'
import { toUtcIsoString } from '@/lib/datetime-api'

const VALID_STATUSES = ['new', 'in_progress', 'waiting', 'resolved'] as const
type ConversationStatus = typeof VALID_STATUSES[number]

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const conversationId = parseInt(id)
    if (!Number.isFinite(conversationId)) {
      return NextResponse.json({ error: 'Invalid conversation ID' }, { status: 400 })
    }

    const body = await request.json()
    const { status } = body

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    // Check if conversation exists
    const conversation = await prisma.lineUser.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        chatStatus: true,
        lineAccountId: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check authorization - user must have access to this line account
    const normalizedRole = (session.user.role || '')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
    const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'superadmin'

    if (!isSuperAdmin && session.user.lineAccountId !== conversation.lineAccountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const oldStatus = conversation.chatStatus || 'new'

    // Update conversation status
    const updatedConversation = await prisma.lineUser.update({
      where: { id: conversationId },
      data: {
        chatStatus: status,
        lastInteraction: new Date(),
      },
      select: {
        id: true,
        chatStatus: true,
        lastInteraction: true,
      },
    })

    // Log status change in activity logs
    await prisma.activity_logs.create({
      data: {
        log_type: 'conversation',
        action: 'status_change',
        description: `Status changed from ${oldStatus} to ${status}`,
        admin_id: parseInt(session.user.id),
        admin_name: session.user.name || 'Unknown',
        entity_type: 'conversation',
        entity_id: conversationId,
        old_value: oldStatus,
        new_value: status,
        line_account_id: conversation.lineAccountId,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      },
    })

    // Broadcast status change via Pusher
    await broadcastConversationUpdate({
      conversationId: conversationId.toString(),
      updates: {
        status,
        // lastInteraction removed as it's not supported by broadcastConversationUpdate type
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: updatedConversation.id.toString(),
        status: updatedConversation.chatStatus,
        lastInteraction: toUtcIsoString(updatedConversation.lastInteraction),
      },
    })
  } catch (error) {
    console.error('Error updating conversation status:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation status' },
      { status: 500 }
    )
  }
}
