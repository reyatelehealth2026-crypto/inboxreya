import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

export async function GET(
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
      return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'Conversation id must be a number' }, { status: 400 })
    }

    const where: { id: number; lineAccountId?: number } = { id: parsedId }
    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const user = await cacheQuery(
      `conv:detail:${parsedId}`,
      () => prisma.lineUser.findFirst({
        where,
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
          tagAssignments: {
            include: { tag: true },
          },
          conversationAssignments: {
            where: { status: 'active' },
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
          },
          _count: {
            select: {
              messages: {
                where: {
                  direction: 'incoming',
                  isRead: false,
                },
              },
            },
          },
        },
      }),
      CACHE_TTL.MESSAGES  // 15s — เปลี่ยนบ่อย
    )

    if (!user) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
    }

    const conversation = {
      id: user.id.toString(),
      user: {
        id: user.id.toString(),
        lineUserId: user.lineUserId,
        displayName: user.displayName,
        pictureUrl: user.pictureUrl,
        statusMessage: user.statusMessage,
        firstName: (user as any).firstName || null,
        lastName: (user as any).lastName || null,
        phone: (user as any).phone || null,
        email: (user as any).email || null,
        birthDate: null,
        gender: null,
        address: null,
        province: null,
        membershipLevel: null,
        tier: null,
        points: 0,
        totalSpent: 0,
        orderCount: 0,
        lastInteraction: user.lastInteraction ? new Date(user.lastInteraction).toISOString() : null,
        chatStatus: user.chatStatus,
        isBlocked: user.isBlocked,
        isRegistered: user.isRegistered,
        createdAt: user.createdAt.toISOString(),
      },
      lastMessage: (() => {
        const msg = user.messages[0]
        if (!msg) return null
        return {
          id: msg.id.toString(),
          userId: msg.userId?.toString() ?? '',
          direction: msg.direction,
          messageType: msg.messageType,
          content: msg.content,
          mediaUrl: msg.mediaUrl,
          metadata: msg.metadata ? JSON.parse(msg.metadata) : null,
          isRead: msg.isRead,
          sentBy: msg.sentBy,
          replyToId: msg.replyToId ? msg.replyToId.toString() : null,
          createdAt: msg.createdAt.toISOString(),
          updatedAt: msg.updatedAt.toISOString(),
        }
      })(),
      unreadCount: user._count.messages,
      status: (user.chatStatus as any) || 'active',
      assignees: user.conversationAssignments.map((a) => ({
        id: a.admin.id.toString(),
        username: a.admin.username,
        displayName: a.admin.displayName,
        avatarUrl: a.admin.avatarUrl,
        role: a.admin.role,
      })),
      tags: user.tagAssignments.map((ta) => ({
        id: ta.tag.id.toString(),
        name: ta.tag.name,
        color: ta.tag.color,
        description: ta.tag.description,
        isAuto: ta.tag.tagType !== 'manual',
        sortOrder: ta.tag.priority ?? 0,
      })),
      updatedAt: user.lastInteraction ? new Date(user.lastInteraction).toISOString() : user.updatedAt.toISOString(),
    }

    return NextResponse.json({ data: conversation })
  } catch (error) {
    console.error('Error fetching conversation:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversation' },
      { status: 500 }
    )
  }
}

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
      return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'Conversation id must be a number' }, { status: 400 })
    }

    const body = await request.json()
    const chatStatus = body.chatStatus ?? body.status
    const { isBlocked } = body

    if (chatStatus === undefined && isBlocked === undefined) {
      return NextResponse.json(
        { error: 'No updatable fields provided' },
        { status: 400 }
      )
    }

    const updated = await prisma.lineUser.update({
      where: { id: parsedId },
      data: {
        ...(chatStatus !== undefined && { chatStatus }),
        ...(isBlocked !== undefined && { isBlocked }),
      },
    })

    // Invalidate caches
    cacheInvalidate(`conv:detail:${parsedId}`).catch(() => null)
    cacheInvalidate(`conv:account:*`).catch(() => null)

    broadcastRealtimeEvent({
      type: 'conversation_update',
      data: {
        conversationId: updated.id.toString(),
        changes: {
          status: (updated.chatStatus as any) || 'active',
          isBlocked: updated.isBlocked,
        },
      },
      timestamp: Date.now(),
    })

    return NextResponse.json({
      data: {
        id: updated.id.toString(),
        chatStatus: updated.chatStatus,
        isBlocked: updated.isBlocked,
        updatedAt: updated.updatedAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error updating conversation:', error)
    return NextResponse.json(
      { error: 'Failed to update conversation' },
      { status: 500 }
    )
  }
}
