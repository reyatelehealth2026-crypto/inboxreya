import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { z } from 'zod'

const createBroadcastSchema = z
  .object({
    content: z.string().max(50000).optional(),
    mediaUrl: z.string().url().optional(),
    flexContent: z.record(z.string(), z.any()).optional(),
    targetSegmentId: z.number().int().positive().optional(),
    targetCustomerIds: z.array(z.number().int().positive()).optional(),
    scheduledAt: z.string().datetime().optional(),
  })
  .refine((data) => !!data.content || !!data.flexContent, {
  message: 'Either content or flexContent is required',
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

    const [broadcasts, total] = await Promise.all([
      prisma.broadcastMessageV2.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.broadcastMessageV2.count({ where }),
    ])

    return NextResponse.json({
      success: true,
      data: {
        broadcasts,
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
        },
      },
    })
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
    } else if (body.targetCustomerIds && body.targetCustomerIds.length > 0) {
      totalRecipients = body.targetCustomerIds.length
    } else {
      // Count all customers for this LINE account
      totalRecipients = await prisma.lineUser.count({
        where: {
          lineAccountId: session.user.lineAccountId,
          // lineUserId: { not: null }, // Removed as lineUserId might be optional or handled differently in LineUser model
        },
      })
    }

    const content = body.flexContent
      ? JSON.stringify(body.flexContent)
      : (validated.content || 'Broadcast message')

    const broadcast = await prisma.broadcastMessageV2.create({
      data: {
        lineAccountId: session.user.lineAccountId as number,
        content,
        mediaUrl: validated.mediaUrl,
        targetSegmentId: validated.targetSegmentId,
        scheduledAt: validated.scheduledAt ? new Date(validated.scheduledAt) : null,
        totalRecipients,
        status: validated.scheduledAt ? 'scheduled' : 'draft',
        createdBy: parseInt(session.user.id),
      },
    })

    // Store target customer IDs if provided
    if (body.targetCustomerIds && body.targetCustomerIds.length > 0) {
      const values = Prisma.join(
        body.targetCustomerIds.map((userId: number) => Prisma.sql`(${broadcast.id}, ${userId})`),
        ', '
      )
      await prisma.$executeRaw(Prisma.sql`INSERT INTO broadcast_recipients (broadcast_id, user_id) VALUES ${values}`)
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
