import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { buildBroadcastEnvelope, summarizeBroadcastForList } from '@/lib/broadcast-runtime'
import { z } from 'zod'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

const createBroadcastSchema = z.object({
  content: z.string().max(5000).optional(),
  mediaUrl: z.string().url().optional(),
  messageType: z.enum(['text', 'image', 'video', 'flex']).optional(),
  flexContent: z.any().optional(),
  templateId: z.number().int().positive().optional(),
  templateSourceTable: z.enum(['templates', 'flex_templates', 'quick_reply_templates']).optional(),
  targetSegmentId: z.number().int().positive().optional(),
  targetCustomerIds: z.array(z.number().int().positive()).optional(),
  scheduledAt: z.string().datetime().optional(),
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
      templateId: validated.templateId,
      templateSourceTable: validated.templateSourceTable,
      targetSegmentId: validated.targetSegmentId,
      targetCustomerIds: validated.targetCustomerIds,
    })

    const resolvedContent = JSON.stringify(envelope)

    // Calculate total recipients
    let totalRecipients = 0

    if (validated.targetSegmentId) {
      // Segment logic disabled per user request
      // const segment = await prisma.customer_segments.findUnique({
      //   where: { id: validated.targetSegmentId },
      // })

      // if (segment) {
      //   totalRecipients = segment.user_count || 0
      // }
      totalRecipients = 0;
    } else if (validated.targetCustomerIds && validated.targetCustomerIds.length > 0) {
      totalRecipients = validated.targetCustomerIds.length
    } else {
      // Count all customers for this LINE account
      totalRecipients = await prisma.lineUser.count({
        where: {
          lineAccountId: session.user.lineAccountId,
          // lineUserId: { not: null }, // Removed as lineUserId might be optional or handled differently in LineUser model
        },
      })
    }

    const broadcast = await prisma.broadcastMessageV2.create({
      data: {
        lineAccountId: session.user.lineAccountId as number,
        content: resolvedContent,
        mediaUrl: validated.mediaUrl || null,
        targetSegmentId: validated.targetSegmentId,
        scheduledAt: validated.scheduledAt ? new Date(validated.scheduledAt) : null,
        totalRecipients,
        status: validated.scheduledAt ? 'scheduled' : 'draft',
        createdBy: parseInt(session.user.id),
      },
    })

    // Invalidate broadcasts cache
    await cacheInvalidate('broadcasts:*')

    // Store target customer IDs if provided
    if (validated.targetCustomerIds && validated.targetCustomerIds.length > 0) {
      await prisma.$executeRaw`
        INSERT INTO broadcast_recipients (broadcast_id, user_id)
        VALUES ${validated.targetCustomerIds.map((userId: number) => `(${broadcast.id}, ${userId})`).join(', ')}
      `
    }

    return NextResponse.json({
      success: true,
      data: broadcast,
    })
  } catch (error: any) {
    console.error('Error creating broadcast:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create broadcast' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
