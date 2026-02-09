import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { callPhpApi } from '@/lib/php-bridge'

function isPrivileged(role?: string | null) {
  return role === 'super_admin' || role === 'admin'
}

async function unassignViaPrisma(
  parsedUserId: number,
  parsedAdminId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if the assignment exists
    const assignment = await prisma.conversationAssignee.findUnique({
      where: {
        userId_adminId: {
          userId: parsedUserId,
          adminId: parsedAdminId,
        },
      },
    })

    if (!assignment) {
      // Assignment doesn't exist, consider it already unassigned (success)
      return { success: true }
    }

    // Update status to resolved instead of deleting (soft delete pattern)
    await prisma.conversationAssignee.update({
      where: {
        userId_adminId: {
          userId: parsedUserId,
          adminId: parsedAdminId,
        },
      },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Prisma unassign error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPrivileged(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    if (!id) {
      return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const adminId = searchParams.get('adminId')

    if (!adminId) {
      return NextResponse.json(
        { error: 'adminId is required' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(id)
    const parsedAdminId = Number(adminId)
    if (!Number.isFinite(parsedUserId) || !Number.isFinite(parsedAdminId)) {
      return NextResponse.json(
        { error: 'userId and adminId must be numbers' },
        { status: 400 }
      )
    }

    // Try PHP API first
    let result = await callPhpApi('/api/inbox-v2.php?action=unassign_conversation', {
      method: 'POST',
      body: JSON.stringify({
        user_id: parsedUserId,
        admin_id: parsedAdminId,
      }),
    })

    // Fall back to Prisma if PHP API fails
    if (!result.success) {
      console.log('PHP unassign failed, falling back to Prisma:', result.error)
      result = await unassignViaPrisma(parsedUserId, parsedAdminId)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unassign conversation' },
        { status: 500 }
      )
    }

    broadcastRealtimeEvent({
      type: 'assignment_change',
      data: {
        conversationId: parsedUserId.toString(),
        action: 'unassign',
        adminId: parsedAdminId.toString(),
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error unassigning conversation:', error)
    return NextResponse.json(
      { error: 'Failed to unassign conversation' },
      { status: 500 }
    )
  }
}
