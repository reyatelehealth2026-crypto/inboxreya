import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { callPhpApi } from '@/lib/php-bridge'

function isPrivileged(role?: string | null) {
  return role === 'super_admin' || role === 'admin'
}

async function assignViaPrisma(
  parsedUserId: number,
  targetAdminId: number,
  sessionAdminId: number
): Promise<{ success: boolean; error?: string }> {
  try {
    // Check if user exists
    const user = await prisma.lineUser.findUnique({
      where: { id: parsedUserId },
      select: { id: true },
    })

    if (!user) {
      return { success: false, error: 'User not found' }
    }

    // Check if admin exists
    const admin = await prisma.adminUser.findUnique({
      where: { id: targetAdminId },
      select: { id: true },
    })

    if (!admin) {
      return { success: false, error: 'Admin not found' }
    }

    // Upsert the assignment (create if not exists, update if exists)
    await prisma.conversationAssignee.upsert({
      where: {
        userId_adminId: {
          userId: parsedUserId,
          adminId: targetAdminId,
        },
      },
      create: {
        userId: parsedUserId,
        adminId: targetAdminId,
        assignedBy: sessionAdminId,
        status: 'active',
        assignedAt: new Date(),
      },
      update: {
        status: 'active',
        assignedBy: sessionAdminId,
        assignedAt: new Date(),
        resolvedAt: null,
      },
    })

    return { success: true }
  } catch (error) {
    console.error('Prisma assign error:', error)
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' }
  }
}

export async function POST(
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

    const body = await request.json()
    const { adminId } = body

    const parsedUserId = Number(id)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'Conversation id must be a number' }, { status: 400 })
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

    // Try PHP API first
    let result = await callPhpApi('/api/inbox-v2.php?action=assign_conversation', {
      method: 'POST',
      body: JSON.stringify({
        user_id: parsedUserId,
        assign_to: targetAdminId,
        admin_id: sessionAdminId,
      }),
    })

    // Fall back to Prisma if PHP API fails
    if (!result.success) {
      console.log('PHP assign failed, falling back to Prisma:', result.error)
      result = await assignViaPrisma(parsedUserId, targetAdminId, sessionAdminId)
    }

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to assign conversation' },
        { status: 500 }
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
