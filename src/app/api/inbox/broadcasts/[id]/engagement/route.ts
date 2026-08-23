import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

const ENGAGEMENT_EVENTS = ['impression', 'postback', 'conversion'] as const
const ENGAGEMENT_SOURCES = ['liff', 'postback', 'webhook'] as const

const logEngagementSchema = z.object({
  lineUserId: z.string().min(1).max(50),
  event: z.enum(ENGAGEMENT_EVENTS).default('impression'),
  action: z.string().max(80).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  source: z.enum(ENGAGEMENT_SOURCES).optional(),
})

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  event: z.enum(ENGAGEMENT_EVENTS).optional(),
  action: z.string().max(80).optional(),
})

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST /api/inbox/broadcasts/[id]/engagement
// Public — called from LIFF page on mount. Validated by broadcast existence
// and line user membership in the same line account.
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params
    const broadcastId = Number.parseInt(id, 10)
    if (!Number.isFinite(broadcastId) || broadcastId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid broadcast id' },
        { status: 400 }
      )
    }

    const body = await req.json().catch(() => null)
    if (!body) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 400 }
      )
    }

    const parsed = logEngagementSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: parsed.error.issues },
        { status: 400 }
      )
    }

    const broadcast = await prisma.broadcastMessageV2.findUnique({
      where: { id: broadcastId },
      select: { id: true, lineAccountId: true },
    })
    if (!broadcast) {
      return NextResponse.json(
        { success: false, error: 'Broadcast not found' },
        { status: 404 }
      )
    }

    const lineUser = await prisma.lineUser.findFirst({
      where: {
        lineUserId: parsed.data.lineUserId,
        lineAccountId: broadcast.lineAccountId,
      },
      select: { id: true },
    })

    const userAgent = req.headers.get('user-agent')?.slice(0, 255) ?? null

    const engagement = await prisma.broadcastEngagement.create({
      data: {
        broadcastId,
        lineUserId: parsed.data.lineUserId,
        lineUserPkId: lineUser?.id ?? null,
        eventType: parsed.data.event,
        action: parsed.data.action ?? null,
        ...(parsed.data.payload
          ? { payload: parsed.data.payload as Prisma.InputJsonValue }
          : {}),
        source: parsed.data.source ?? 'liff',
        userAgent,
      },
      select: { id: true, createdAt: true },
    })

    return NextResponse.json({
      success: true,
      data: {
        id: engagement.id,
        createdAt: engagement.createdAt.toISOString(),
        matchedLineUser: Boolean(lineUser?.id),
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[engagement POST] error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}

// GET /api/inbox/broadcasts/[id]/engagement
// Auth required. Returns paginated engagement events for the broadcast
// scoped to the caller's lineAccountId, joined with LineUser profile.
export async function GET(req: NextRequest, { params }: RouteContext) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { user: sessionUser } = authResult

    const { id } = await params
    const broadcastId = Number.parseInt(id, 10)
    if (!Number.isFinite(broadcastId) || broadcastId <= 0) {
      return NextResponse.json(
        { success: false, error: 'Invalid broadcast id' },
        { status: 400 }
      )
    }

    const broadcast = await prisma.broadcastMessageV2.findUnique({
      where: { id: broadcastId },
      select: {
        id: true,
        lineAccountId: true,
        totalRecipients: true,
        deliveredCount: true,
        readCount: true,
        sentAt: true,
        createdAt: true,
      },
    })
    if (!broadcast) {
      return NextResponse.json(
        { success: false, error: 'Broadcast not found' },
        { status: 404 }
      )
    }
    if (
      sessionUser.role !== 'owner' &&
      broadcast.lineAccountId !== sessionUser.lineAccountId
    ) {
      return NextResponse.json(
        { success: false, error: 'Forbidden' },
        { status: 403 }
      )
    }

    const { searchParams } = new URL(req.url)
    const queryParsed = listQuerySchema.safeParse({
      page: searchParams.get('page') ?? undefined,
      limit: searchParams.get('limit') ?? undefined,
      event: searchParams.get('event') ?? undefined,
      action: searchParams.get('action') ?? undefined,
    })
    if (!queryParsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid query', details: queryParsed.error.issues },
        { status: 400 }
      )
    }
    const { page, limit, event, action } = queryParsed.data
    const skip = (page - 1) * limit

    const where = {
      broadcastId,
      ...(event ? { eventType: event } : {}),
      ...(action ? { action } : {}),
    }

    const [events, total, summaryRows, uniqueByEvent] = await Promise.all([
      prisma.broadcastEngagement.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.broadcastEngagement.count({ where }),
      prisma.broadcastEngagement.groupBy({
        by: ['eventType'],
        where: { broadcastId },
        _count: { _all: true },
      }),
      prisma.broadcastEngagement.groupBy({
        by: ['eventType', 'lineUserId'],
        where: { broadcastId },
        _count: { _all: true },
      }),
    ])

    const lineUserPkIds = Array.from(
      new Set(
        events
          .map((e) => e.lineUserPkId)
          .filter((id): id is number => typeof id === 'number')
      )
    )
    const lineUserIds = Array.from(new Set(events.map((e) => e.lineUserId)))

    const usersByPk = await prisma.lineUser.findMany({
      where: {
        OR: [
          lineUserPkIds.length > 0 ? { id: { in: lineUserPkIds } } : null,
          {
            lineUserId: { in: lineUserIds },
            lineAccountId: broadcast.lineAccountId,
          },
        ].filter(Boolean) as any,
      },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        custom_display_name: true,
        pictureUrl: true,
      },
    })

    const userByLineId = new Map(usersByPk.map((u) => [u.lineUserId, u]))

    const rows = events.map((e) => {
      const profile = userByLineId.get(e.lineUserId) ?? null
      return {
        id: e.id,
        eventType: e.eventType,
        action: e.action,
        payload: e.payload ?? null,
        source: e.source,
        createdAt: e.createdAt.toISOString(),
        lineUserId: e.lineUserId,
        displayName: profile?.custom_display_name || profile?.displayName || null,
        pictureUrl: profile?.pictureUrl || null,
        lineUserPkId: profile?.id ?? e.lineUserPkId ?? null,
      }
    })

    const totalsByEvent: Record<string, number> = {}
    for (const row of summaryRows) {
      totalsByEvent[row.eventType] = row._count._all
    }

    const uniqueUsersByEvent: Record<string, number> = {}
    for (const row of uniqueByEvent) {
      uniqueUsersByEvent[row.eventType] = (uniqueUsersByEvent[row.eventType] ?? 0) + 1
    }

    return NextResponse.json({
      success: true,
      data: {
        broadcast: {
          id: broadcast.id,
          totalRecipients: broadcast.totalRecipients,
          deliveredCount: broadcast.deliveredCount,
          readCount: broadcast.readCount,
          sentAt: broadcast.sentAt?.toISOString() ?? null,
          createdAt: broadcast.createdAt.toISOString(),
        },
        summary: {
          totalEvents: total,
          totalsByEvent,
          uniqueUsersByEvent,
        },
        events: rows,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit) || 1,
        },
      },
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    console.error('[engagement GET] error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    )
  }
}
