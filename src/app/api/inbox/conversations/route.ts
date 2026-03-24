import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

// TTL สั้นมาก เพราะ conversation เปลี่ยนบ่อย (ข้อความใหม่เข้าตลอด)
const CONV_TTL = 20   // วินาที
const ADMIN_TTL = CACHE_TTL.TAGS  // 5 นาที — admin list เปลี่ยนนาน

const isInternalRequest = (request: NextRequest) =>
  request.headers.get('x-internal-request') === 'true'

const normalizePictureUrl = (value: string | null) => {
  if (!value) return null
  const trimmed = value.trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
  if (trimmed.startsWith('//')) return `https:${trimmed}`
  return `https://${trimmed}`
}

const toBangkokWallTime = (date: Date | string | null | undefined) => {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (isNaN(d.getTime())) return null
  const pad = (value: number, size = 2) => String(value).padStart(size, '0')
  const year = d.getUTCFullYear()
  const month = pad(d.getUTCMonth() + 1)
  const day = pad(d.getUTCDate())
  const hours = pad(d.getUTCHours())
  const minutes = pad(d.getUTCMinutes())
  const seconds = pad(d.getUTCSeconds())
  const millis = pad(d.getUTCMilliseconds(), 3)
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${millis}+07:00`
}

export async function GET(request: NextRequest) {
  try {
    const internalRequest = isInternalRequest(request)
    const session = internalRequest ? null : await auth()
    if (!internalRequest && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(2000, Math.max(1, parseInt(searchParams.get('limit') || '100')))
    const status = searchParams.get('status')
    const tagId = searchParams.get('tagId')
    const tagIdsParam = searchParams.get('tagIds')
    const search = searchParams.get('search')
    const assignedTo = searchParams.get('assignedTo')
    const assignedToParam = searchParams.get('assignedToIds')
    const unreadOnly = searchParams.get('unreadOnly')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const cursor = searchParams.get('cursor')

    const platform = searchParams.get('platform') // 'line' | 'facebook' | 'tiktok' | null

    const cursorId = cursor ? Number(cursor) : null
    if (cursor && !Number.isFinite(cursorId)) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }

    const skip = cursorId ? 1 : (page - 1) * limit

    // Build where clause
    const where: any = {}

    // Platform filter
    if (platform && ['line', 'facebook', 'tiktok'].includes(platform)) {
      where.platform = platform
    }

    // Only restrict by lineAccountId for non-super_admin users
    if (!internalRequest && session?.user) {
      const normalizedRole = (session.user.role || '')
        .toLowerCase()
        .replace(/[-\s]+/g, '_')
      const isSuperAdmin = normalizedRole === 'super_admin' || normalizedRole === 'superadmin'
      if (!isSuperAdmin && session.user.lineAccountId) {
        where.lineAccountId = session.user.lineAccountId
      }
    }

    if (status && status !== 'all') {
      where.chatStatus = status
    }

    // Search by customer name, contact info, message content, and tags
    // Note: Case-insensitive search relies on MySQL's default collation (utf8mb4_general_ci)
    const trimmedSearch = search?.trim()
    if (trimmedSearch) {
      where.OR = [
        { displayName: { contains: trimmedSearch } },
        { firstName: { contains: trimmedSearch } },
        { lastName: { contains: trimmedSearch } },
        { phone: { contains: trimmedSearch } },
        { email: { contains: trimmedSearch } },
        {
          messages: {
            some: {
              content: { contains: trimmedSearch },
            },
          },
        },
        {
          tagAssignments: {
            some: {
              tag: {
                name: { contains: trimmedSearch },
              },
            },
          },
        },
      ]
    }

    const tagIds = tagIdsParam
      ? tagIdsParam
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isFinite(id))
      : []

    if (tagIds.length > 0) {
      where.tagAssignments = {
        some: { tagId: { in: tagIds } },
      }
    } else if (tagId) {
      const parsedTagId = Number(tagId)
      if (!Number.isFinite(parsedTagId)) {
        return NextResponse.json({ error: 'tagId must be a number' }, { status: 400 })
      }
      where.tagAssignments = {
        some: { tagId: parsedTagId },
      }
    }

    const assignedToIds = assignedToParam
      ? assignedToParam
        .split(',')
        .map((id) => Number(id.trim()))
        .filter((id) => Number.isFinite(id))
      : []

    if (assignedToIds.length > 0) {
      where.conversationAssignees = {
        some: { adminId: { in: assignedToIds }, status: 'active' },
      }
    } else if (assignedTo === 'unassigned') {
      // Filter for conversations with no active assignees
      where.conversationAssignees = {
        none: { status: 'active' },
      }
    } else if (assignedTo === 'me' && !internalRequest && session?.user) {
      // Filter for conversations assigned to the current user
      where.conversationAssignees = {
        some: { adminId: parseInt(session.user.id), status: 'active' },
      }
    } else if (assignedTo && assignedTo !== 'me') {
      const parsedAssignedTo = Number(assignedTo)
      if (!Number.isFinite(parsedAssignedTo)) {
        return NextResponse.json({ error: 'assignedTo must be a number' }, { status: 400 })
      }
      where.conversationAssignees = {
        some: { adminId: parsedAssignedTo, status: 'active' },
      }
    }

    if (unreadOnly === 'true' || unreadOnly === '1') {
      where.messages = {
        some: {
          direction: 'incoming',
          isRead: false,
        },
      }
    }

    if (startDate || endDate) {
      const fromDate = startDate ? new Date(startDate) : null
      const toDate = endDate ? new Date(endDate) : null
      if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
        return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
      }
      where.lastInteraction = {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
      }
    }

    // Determine if this is a cacheable request (default list, no dynamic filters)
    const isDefaultList =
      !trimmedSearch && !tagId && !tagIdsParam && !assignedTo && !assignedToParam &&
      !unreadOnly && !startDate && !endDate && !cursorId && page === 1

    const accountId = (!internalRequest && session?.user) ? (session.user.lineAccountId ?? 'all') : 'all'
    const statusKey = status && status !== 'all' ? status : 'all'
    const convCacheKey = `conv:account:${accountId}:status:${statusKey}:p1:l${limit}`

    // Get users with their latest messages
    const [users, total] = await cacheQuery(
      isDefaultList ? convCacheKey : `nocache:${Date.now()}`,
      async () => {
        const [rows, cnt] = await Promise.all([
          prisma.lineUser.findMany({
            where,
            select: {
              id: true,
              lineUserId: true,
              displayName: true,
              pictureUrl: true,
              statusMessage: true,
              firstName: true,
              lastName: true,
              phone: true,
              email: true,
              gender: true,
              address: true,
              province: true,
              membershipLevel: true,
              tier: true,
              points: true,
              totalSpent: true,
              orderCount: true,
              lastInteraction: true,
              chatStatus: true,
              isBlocked: true,
              isRegistered: true,
              platform: true,
              platformUserId: true,
              createdAt: true,
              updatedAt: true,
              messages: {
                orderBy: { createdAt: 'desc' },
                take: 1,
                select: {
                  id: true,
                  userId: true,
                  direction: true,
                  messageType: true,
                  content: true,
                  mediaUrl: true,
                  metadata: true,
                  isRead: true,
                  sentBy: true,
                  replyToId: true,
                  platform: true,
                  createdAt: true,
                  updatedAt: true,
                },
              },
              tagAssignments: {
                select: {
                  tag: {
                    select: {
                      id: true,
                      name: true,
                      color: true,
                      description: true,
                      tagType: true,
                      priority: true,
                    },
                  },
                },
              },
              conversationAssignees: {
                where: { status: 'active' },
                select: { adminId: true },
              },
              _count: {
                select: {
                  messages: {
                    where: { direction: 'incoming', isRead: false },
                  },
                },
              },
            },
            orderBy: [
              { lastInteraction: 'desc' },
              { updatedAt: 'desc' },
              { id: 'desc' },
            ],
            take: limit,
            skip,
            ...(cursorId && { cursor: { id: cursorId } }),
          }),
          prisma.lineUser.count({ where }),
        ])
        return [rows, cnt] as const
      },
      isDefaultList ? CONV_TTL : 0
    )

    // Ensure ordering is based on latest message timestamp
    const sortedUsers = [...users].sort((a, b) => {
      const aRaw =
        a.messages[0]?.createdAt ||
        a.lastInteraction ||
        a.updatedAt ||
        a.createdAt
      const bRaw =
        b.messages[0]?.createdAt ||
        b.lastInteraction ||
        b.updatedAt ||
        b.createdAt
      const aTime = aRaw instanceof Date ? aRaw : new Date(aRaw)
      const bTime = bRaw instanceof Date ? bRaw : new Date(bRaw)
      const diff = bTime.getTime() - aTime.getTime()
      if (diff !== 0) return diff
      return b.id - a.id
    })

    // Collect all admin IDs and fetch them separately
    const allAdminIds = new Set<number>()
    for (const user of sortedUsers) {
      for (const assignee of user.conversationAssignees) {
        allAdminIds.add(assignee.adminId)
      }
    }

    // Fetch admins separately — cached 5 นาที เพราะเปลี่ยนน้อย
    const admins = allAdminIds.size > 0
      ? await cacheQuery(
          `admins:ids:${Array.from(allAdminIds).sort().join(',')}`,
          () => prisma.adminUser.findMany({
            where: { id: { in: Array.from(allAdminIds) } },
            select: {
              id: true,
              username: true,
              displayName: true,
              avatarUrl: true,
              role: true,
            },
          }),
          ADMIN_TTL
        )
      : []

    // Create admin lookup map
    const adminMap = new Map(admins.map((a) => [a.id, a]))

    // Transform to conversation format
    const conversations = sortedUsers.map((user) => ({
      id: user.id.toString(),
      platform: (user.platform ?? 'line') as 'line' | 'facebook' | 'tiktok',
      user: {
        id: user.id.toString(),
        lineUserId: user.lineUserId,
        displayName: user.displayName,
        pictureUrl: normalizePictureUrl(user.pictureUrl),
        statusMessage: user.statusMessage,
        firstName: user.firstName,
        lastName: user.lastName,
        phone: user.phone,
        email: user.email,
        birthDate: null,
        gender: user.gender,
        address: user.address,
        province: user.province,
        membershipLevel: user.membershipLevel,
        tier: user.tier,
        points: user.points,
        totalSpent: user.totalSpent,
        orderCount: user.orderCount,
        lastInteraction: toBangkokWallTime(user.lastInteraction),
        chatStatus: user.chatStatus,
        isBlocked: user.isBlocked,
        isRegistered: user.isRegistered,
        platform: (user.platform ?? 'line') as 'line' | 'facebook' | 'tiktok',
        platformUserId: user.platformUserId ?? null,
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
          platform: (msg.platform ?? 'line') as 'line' | 'facebook' | 'tiktok',
          createdAt: toBangkokWallTime(msg.createdAt),
          updatedAt: toBangkokWallTime(msg.updatedAt),
        }
      })(),
      unreadCount: user._count.messages,
      status: (user.chatStatus as any) || 'active',
      // Filter out orphaned admin records
      assignees: user.conversationAssignees
        .map((a) => adminMap.get(a.adminId))
        .filter((admin): admin is NonNullable<typeof admin> => admin !== undefined)
        .map((admin) => ({
          id: admin.id.toString(),
          username: admin.username,
          displayName: admin.displayName,
          avatarUrl: admin.avatarUrl,
          role: admin.role,
        })),
      tags: user.tagAssignments.map((ta) => ({
        id: ta.tag.id.toString(),
        name: ta.tag.name,
        color: ta.tag.color ?? '#3B82F6',
        description: ta.tag.description,
        isAuto: ta.tag.tagType !== 'manual',
        sortOrder: ta.tag.priority ?? 0,
      })),
      updatedAt: toBangkokWallTime(user.lastInteraction) || toBangkokWallTime(user.updatedAt),
    }))

    const nextCursor =
      sortedUsers.length === limit
        ? sortedUsers[sortedUsers.length - 1].id.toString()
        : null

    return NextResponse.json({
      data: conversations,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + users.length < total,
        cursor: nextCursor,
      },
    })
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2024') {
      return NextResponse.json(
        { error: 'Database is busy, please try again in a moment.' },
        { status: 503 }
      )
    }
    console.error('Error fetching conversations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }
}
