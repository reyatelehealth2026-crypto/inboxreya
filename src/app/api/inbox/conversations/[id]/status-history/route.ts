import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
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

    // Check if conversation exists and user has access
    const conversation = await prisma.lineUser.findUnique({
      where: { id: conversationId },
      select: {
        id: true,
        lineAccountId: true,
      },
    })

    if (!conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    // Check authorization
    const normalizedRole = (session.user.role || '')
      .toLowerCase()
      .replace(/[-\s]+/g, '_')
    const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'superadmin'

    if (!isSuperAdmin && session.user.lineAccountId !== conversation.lineAccountId) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get status change history from activity logs
    const history = await prisma.activity_logs.findMany({
      where: {
        entity_type: 'conversation',
        entity_id: conversationId,
        action: 'status_change',
      },
      orderBy: {
        created_at: 'desc',
      },
      select: {
        id: true,
        action: true,
        description: true,
        admin_id: true,
        admin_name: true,
        old_value: true,
        new_value: true,
        created_at: true,
      },
    })

    const formattedHistory = history.map((log) => ({
      id: log.id.toString(),
      action: log.action,
      description: log.description,
      adminId: log.admin_id?.toString(),
      adminName: log.admin_name,
      oldStatus: log.old_value,
      newStatus: log.new_value,
      createdAt: log.created_at.toISOString(),
    }))

    return NextResponse.json({
      success: true,
      data: formattedHistory,
    })
  } catch (error) {
    console.error('Error fetching status history:', error)
    return NextResponse.json(
      { error: 'Failed to fetch status history' },
      { status: 500 }
    )
  }
}
