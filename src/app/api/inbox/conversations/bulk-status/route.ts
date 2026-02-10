
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastConversationUpdate } from '@/lib/pusher'

const VALID_STATUSES = ['new', 'in_progress', 'waiting', 'resolved'] as const
type ConversationStatus = typeof VALID_STATUSES[number]

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { conversationIds, status } = body

    if (!Array.isArray(conversationIds) || conversationIds.length === 0) {
      return NextResponse.json(
        { error: 'conversationIds must be a non-empty array' },
        { status: 400 }
      )
    }

    if (!status || !VALID_STATUSES.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${VALID_STATUSES.join(', ')}` },
        { status: 400 }
      )
    }

    const ids = conversationIds.map((id: any) => parseInt(id)).filter(Number.isFinite)
    if (ids.length === 0) {
      return NextResponse.json(
        { error: 'No valid conversation IDs provided' },
        { status: 400 }
      )
    }

    // Check authorization - get conversations to verify access
    const conversations = await prisma.lineUser.findMany({
      where: { id: { in: ids } },
      select: {
        id: true,
        chatStatus: true,
        lineAccountId: true,
      },
    })

    if (conversations.length === 0) {
      return NextResponse.json({ error: 'No conversations found' }, { status: 404 })
    }

    // Check authorization
    const normalizedRole = (session.user.role || '')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
    const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'superadmin'

    if (!isSuperAdmin) {
      const unauthorizedConv = conversations.find(
        (c) => c.lineAccountId !== session.user.lineAccountId
      )
      if (unauthorizedConv) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Update all conversations
    const updateResult = await prisma.lineUser.updateMany({
      where: { id: { in: ids } },
      data: {
        chatStatus: status,
        lastInteraction: new Date(),
      },
    })

    // Log bulk status change
    await prisma.activity_logs.create({
      data: {
        log_type: 'conversation',
        action: 'bulk_status_change',
        description: `Bulk status change to ${status} for ${updateResult.count} conversations`,
        admin_id: parseInt(session.user.id),
        admin_name: session.user.name || 'Unknown',
        entity_type: 'conversation',
        new_value: JSON.stringify({ status, conversationIds: ids }),
        line_account_id: session.user.lineAccountId,
        ip_address: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        user_agent: request.headers.get('user-agent') || 'unknown',
      },
    })

    // Broadcast updates for each conversation
    const broadcastPromises = ids.map((id) =>
      broadcastConversationUpdate({
        conversationId: id.toString(),
        updates: { status },
      })
    )
    await Promise.allSettled(broadcastPromises)

    return NextResponse.json({
      success: true,
      data: {
        updatedCount: updateResult.count,
        status,
      },
    })
  } catch (error) {
    console.error('Error bulk updating conversation status:', error)
    return NextResponse.json(
      { error: 'Failed to bulk update conversation status' },
      { status: 500 }
    )
  }
}

