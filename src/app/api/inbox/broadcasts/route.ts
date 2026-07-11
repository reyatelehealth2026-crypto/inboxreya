import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { buildBroadcastEnvelope, summarizeBroadcastForList } from '@/lib/broadcast-runtime'
import { toBroadcastCreatedAtIso } from '@/lib/broadcast-time'
import { countBroadcastRecipients } from '@/lib/broadcast-recipient-estimate'
import { z } from 'zod'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

const positiveInt = z.coerce.number().int().positive()
const optionalPositiveInt = z.preprocess((value) => value === '' || value === null ? undefined : value, positiveInt.optional())
const optionalUrl = z.preprocess((value) => typeof value === 'string' && !value.trim() ? undefined : value, z.string().url().optional())
const optionalIsoDateTime = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  if (!trimmed) return undefined
  const date = new Date(trimmed)
  return Number.isFinite(date.getTime()) ? date.toISOString() : trimmed
}, z.string().datetime().optional())
const isoDateTime = z.preprocess((value) => {
  if (typeof value !== 'string') return value
  const trimmed = value.trim()
  const date = new Date(trimmed)
  return Number.isFinite(date.getTime()) ? date.toISOString() : trimmed
}, z.string().datetime())
const positiveIntArray = z.array(positiveInt).transform((ids) => [...new Set(ids)])

const createBroadcastSchema = z.object({
  content: z.string().max(5000).optional(),
  mediaUrl: optionalUrl,
  messageType: z.enum(['text', 'image', 'video', 'flex']).optional(),
  flexContent: z.any().optional(),
  flexContents: z.array(z.any()).max(5).optional(),
  templateId: optionalPositiveInt,
  templateIds: z.array(positiveInt).max(5).transform((ids) => [...new Set(ids)]).optional(),
  templateSourceTable: z.enum(['templates', 'flex_templates', 'quick_reply_templates']).optional(),
  targetSegmentId: optionalPositiveInt,
  targetCustomerIds: positiveIntArray.optional(),
  targetTagIds: positiveIntArray.optional(),
  scheduledAt: optionalIsoDateTime,
  scheduledDates: z.array(isoDateTime).max(31).optional(),
})

// GET /api/inbox/broadcasts - List all broadcasts
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user: sessionUser } = authResult
    const session = { user: sessionUser }
    const { searchParams } = new URL(req.url)

    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    const skip = (page - 1) * limit

    const where: any = {
      lineAccountId: session.user.lineAccountId,
    }

    if (status) {
      where.status = status
    }

    const data = await cacheQuery(
      `broadcasts:account:${session.user.lineAccountId}:${page}:${status || 'all'}`,
      async () => {
        const [broadcasts, total] = await Promise.all([
          prisma.broadcastMessageV2.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            skip,
            take: limit,
          }),
          prisma.broadcastMessageV2.count({ where }),
        ])

        return {
          broadcasts: broadcasts.map((broadcast) => {
            const summary = summarizeBroadcastForList({
              content: broadcast.content,
              mediaUrl: broadcast.mediaUrl,
            })

            return {
              ...broadcast,
              content: summary.summaryText,
              mediaUrl: summary.mediaUrl,
              messageType: summary.messageType,
              createdAt: toBroadcastCreatedAtIso(broadcast.createdAt),
            }
          }),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }
      },
      CACHE_TTL.BROADCASTS  // 30s
    )

    return NextResponse.json({ success: true, data })
  } catch (error: any) {
    console.error('Error fetching broadcasts:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch broadcasts' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// POST /api/inbox/broadcasts - Create new broadcast
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user: sessionUser } = authResult
    const session = { user: sessionUser }
    const body = await req.json()

    const validated = createBroadcastSchema.parse(body)
    const envelope = buildBroadcastEnvelope({
      content: validated.content,
      mediaUrl: validated.mediaUrl,
      messageType: validated.messageType,
      flexContent: validated.flexContent,
      flexContents: validated.flexContents,
      templateId: validated.templateId,
      templateSourceTable: validated.templateSourceTable,
      targetSegmentId: validated.targetSegmentId,
      targetCustomerIds: validated.targetCustomerIds,
      targetTagIds: validated.targetTagIds,
    })

    const resolvedContent = JSON.stringify(envelope)

    const totalRecipients = await countBroadcastRecipients({
      lineAccountId: session.user.lineAccountId as number,
      targetSegmentId: validated.targetSegmentId,
      targetCustomerIds: validated.targetCustomerIds,
      targetTagIds: validated.targetTagIds,
    })

    // Resolve list of scheduled dates: either scheduledDates array, single scheduledAt, or none (draft).
    const scheduleList: (Date | null)[] = (() => {
      if (validated.scheduledDates && validated.scheduledDates.length > 0) {
        return validated.scheduledDates.map((iso) => new Date(iso))
      }
      if (validated.scheduledAt) {
        return [new Date(validated.scheduledAt)]
      }
      return [null]
    })()

    const created = await Promise.all(
      scheduleList.map((scheduledAt) =>
        prisma.broadcastMessageV2.create({
          data: {
            lineAccountId: session.user.lineAccountId as number,
            content: resolvedContent,
            mediaUrl: validated.mediaUrl || null,
            targetSegmentId: validated.targetSegmentId,
            scheduledAt,
            totalRecipients,
            status: scheduledAt ? 'scheduled' : 'draft',
            createdBy: parseInt(session.user.id),
          },
        })
      )
    )

    // Invalidate broadcasts cache
    await cacheInvalidate('broadcasts:*')

    // Store target customer IDs if provided (mirror to every created broadcast).
    if (validated.targetCustomerIds && validated.targetCustomerIds.length > 0) {
      const userIds = validated.targetCustomerIds
      for (const broadcast of created) {
        await prisma.$executeRaw`
          INSERT INTO broadcast_recipients (broadcast_id, user_id)
          VALUES ${userIds.map((userId: number) => `(${broadcast.id}, ${userId})`).join(', ')}
        `
      }
    }

    const primary = created[0]
    return NextResponse.json({
      success: true,
      data: created.length > 1 ? { ...primary, broadcasts: created } : primary,
    })
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      )
    }
    if (error instanceof Error && (
      error.message.startsWith('Invalid flexContent payload')
      || error.message.includes('broadcast requires')
      || error.message.includes('Cannot send more than 5 flex messages')
    )) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 400 }
      )
    }

    console.error('Error creating broadcast:', error)

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create broadcast' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
