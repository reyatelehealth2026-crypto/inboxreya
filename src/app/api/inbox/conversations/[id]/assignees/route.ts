import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'

/**
 * GET /api/inbox/conversations/[id]/assignees
 * Get all assignees for a conversation
 */
export const GET = withAuth(async (request: NextRequest, { params, user }) => {
  try {
    const userId = Number(params.id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Get all active assignees
    const assignees = await prisma.conversationAssignee.findMany({
      where: {
        userId,
        status: 'active',
      },
      include: {
        admin: {
          select: {
            id: true,
            username: true,
            displayName: true,
            avatarUrl: true,
            role: true,
          },
        },
        assigner: {
          select: {
            id: true,
            username: true,
            displayName: true,
          },
        },
      },
      orderBy: {
        assignedAt: 'asc',
      },
    })

    return NextResponse.json({
      data: assignees.map((a) => ({
        id: a.id.toString(),
        userId: a.userId?.toString() ?? '',
        admin: {
          id: a.admin.id.toString(),
          username: a.admin.username,
          displayName: a.admin.displayName,
          avatarUrl: a.admin.avatarUrl,
          role: a.admin.role,
        },
        assignedBy: a.assigner
          ? {
              id: a.assigner.id.toString(),
              username: a.assigner.username,
              displayName: a.assigner.displayName,
            }
          : null,
        assignedAt: a.assignedAt?.toISOString() || null,
        status: a.status,
      })),
    })
  } catch (error) {
    console.error('Error fetching assignees:', error)
    return NextResponse.json(
      { error: 'Failed to fetch assignees', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
})

/**
 * POST /api/inbox/conversations/[id]/assignees
 * Add one or more assignees to a conversation
 */
export const POST = withAuth(async (request: NextRequest, { params, user }) => {
  try {
    const userId = Number(params.id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { adminIds } = body

    if (!Array.isArray(adminIds) || adminIds.length === 0) {
      return NextResponse.json(
        { error: 'adminIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate all admin IDs are numbers
    const parsedAdminIds = adminIds.map((id) => Number(id))
    if (parsedAdminIds.some((id) => !Number.isFinite(id))) {
      return NextResponse.json(
        { error: 'All adminIds must be valid numbers' },
        { status: 400 }
      )
    }

    // Get current admin ID
    const sessionAdminId = Number(user.id)

    // Verify user exists
    const lineUser = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: { id: true, displayName: true },
    })

    if (!lineUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Verify all admins exist
    const admins = await prisma.adminUser.findMany({
      where: {
        id: { in: parsedAdminIds },
        isActive: true,
      },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    })

    if (admins.length !== parsedAdminIds.length) {
      return NextResponse.json(
        { error: 'One or more admin IDs are invalid' },
        { status: 400 }
      )
    }

    // Create assignees (using upsert to handle duplicates)
    const createdAssignees = []
    for (const adminId of parsedAdminIds) {
      const assignee = await prisma.conversationAssignee.upsert({
        where: {
          userId_adminId: {
            userId,
            adminId,
          },
        },
        update: {
          status: 'active',
          assignedBy: sessionAdminId,
          assignedAt: new Date(),
        },
        create: {
          userId,
          adminId,
          assignedBy: sessionAdminId,
          status: 'active',
        },
        include: {
          admin: {
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true,
            },
          },
        },
      })

      createdAssignees.push(assignee)
    }

    // Broadcast real-time event
    broadcastRealtimeEvent({
      type: 'assignees_updated',
      data: {
        conversationId: userId.toString(),
        action: 'add',
        assignees: createdAssignees.map((a) => ({
          id: a.admin.id.toString(),
          username: a.admin.username,
          displayName: a.admin.displayName,
          avatarUrl: a.admin.avatarUrl,
          role: a.admin.role,
        })),
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      data: createdAssignees.map((a) => ({
        id: a.id.toString(),
        userId: a.userId?.toString() ?? '',
        admin: {
          id: a.admin.id.toString(),
          username: a.admin.username,
          displayName: a.admin.displayName,
          avatarUrl: a.admin.avatarUrl,
          role: a.admin.role,
        },
        assignedAt: a.assignedAt?.toISOString() || null,
        status: a.status,
      })),
    })
  } catch (error) {
    console.error('Error adding assignees:', error)
    return NextResponse.json(
      { error: 'Failed to add assignees', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
})

/**
 * DELETE /api/inbox/conversations/[id]/assignees
 * Remove one or more assignees from a conversation
 */
export const DELETE = withAuth(async (request: NextRequest, { params, user }) => {
  try {
    const userId = Number(params.id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { adminIds } = body

    if (!Array.isArray(adminIds) || adminIds.length === 0) {
      return NextResponse.json(
        { error: 'adminIds must be a non-empty array' },
        { status: 400 }
      )
    }

    // Validate all admin IDs are numbers
    const parsedAdminIds = adminIds.map((id) => Number(id))
    if (parsedAdminIds.some((id) => !Number.isFinite(id))) {
      return NextResponse.json(
        { error: 'All adminIds must be valid numbers' },
        { status: 400 }
      )
    }

    // Update assignees to resolved status
    await prisma.conversationAssignee.updateMany({
      where: {
        userId,
        adminId: { in: parsedAdminIds },
        status: 'active',
      },
      data: {
        status: 'resolved',
        resolvedAt: new Date(),
      },
    })

    // Broadcast real-time event
    broadcastRealtimeEvent({
      type: 'assignees_updated',
      data: {
        conversationId: userId.toString(),
        action: 'remove',
        adminIds: parsedAdminIds.map((id) => id.toString()),
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error removing assignees:', error)
    return NextResponse.json(
      { error: 'Failed to remove assignees', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
})
