import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { callPhpApi } from '@/lib/php-bridge'

function isPrivileged(role?: string | null) {
  return role === 'super_admin' || role === 'admin'
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPrivileged(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { userId, adminId } = body

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
    }

    // session.user.id might be a CUID string or numeric string
    let sessionAdminId = Number(session.user.id)
    
    if (!Number.isFinite(sessionAdminId)) {
      // Look up admin by email if ID is not numeric
      try {
        const admin = await prisma.adminUser.findFirst({
          where: { 
            OR: [
              { email: session.user.email },
              { username: session.user.name || '' }
            ],
            isActive: true
          },
          select: { id: true }
        })
        
        if (!admin) {
          return NextResponse.json({ error: 'Admin user not found' }, { status: 404 })
        }
        
        sessionAdminId = admin.id
      } catch (lookupError) {
        console.error('Failed to lookup admin:', lookupError)
        return NextResponse.json({ error: 'Failed to identify admin user' }, { status: 500 })
      }
    }

    const targetAdminId = adminId !== undefined && adminId !== null ? Number(adminId) : sessionAdminId
    if (!Number.isFinite(targetAdminId)) {
      return NextResponse.json({ error: 'adminId must be a number' }, { status: 400 })
    }

    const result = await callPhpApi('/api/inbox-v2.php?action=assign_conversation', {
      method: 'POST',
      body: JSON.stringify({
        user_id: parsedUserId,
        assign_to: targetAdminId,
        admin_id: sessionAdminId,
      }),
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to assign conversation' },
        { status: 502 }
      )
    }

    const assignedAdmin = await prisma.adminUser.findUnique({
      where: { id: targetAdminId },
      select: {
        id: true,
        username: true,
        displayName: true,
        avatarUrl: true,
        role: true,
      },
    })

    broadcastRealtimeEvent({
      type: 'assignment_change',
      data: {
        conversationId: parsedUserId.toString(),
        action: 'assign',
        admin: assignedAdmin
          ? {
              ...assignedAdmin,
              id: assignedAdmin.id.toString(),
            }
          : {
              id: targetAdminId.toString(),
              username: 'admin',
              displayName: null,
              avatarUrl: null,
              role: 'admin',
            },
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      data: {
        userId: parsedUserId.toString(),
        adminId: targetAdminId.toString(),
        status: 'active',
        admin: assignedAdmin
          ? { ...assignedAdmin, id: assignedAdmin.id.toString() }
          : {
              id: targetAdminId.toString(),
              username: 'admin',
              displayName: null,
              avatarUrl: null,
              role: 'admin',
            },
      },
    })
  } catch (error) {
    console.error('Error assigning conversation:', error)
    return NextResponse.json(
      { error: 'Failed to assign conversation' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!isPrivileged(session.user.role)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json().catch(() => ({}))
    const { searchParams } = new URL(request.url)
    const userId = body.userId || searchParams.get('userId')
    const adminId = body.adminId || searchParams.get('adminId')

    if (!userId || !adminId) {
      return NextResponse.json(
        { error: 'userId and adminId are required' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(userId)
    const parsedAdminId = Number(adminId)
    if (!Number.isFinite(parsedUserId) || !Number.isFinite(parsedAdminId)) {
      return NextResponse.json(
        { error: 'userId and adminId must be numbers' },
        { status: 400 }
      )
    }

    const result = await callPhpApi('/api/inbox-v2.php?action=unassign_conversation', {
      method: 'POST',
      body: JSON.stringify({
        user_id: parsedUserId,
        admin_id: parsedAdminId,
      }),
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to unassign conversation' },
        { status: 502 }
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
