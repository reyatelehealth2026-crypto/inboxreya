import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

/**
 * GET /api/inbox/customers/[id]/recent-images
 *
 * Returns the 8 most recent incoming image messages for this user.
 * Used by SlipUploadModal to let sales pick a recent image as slip.
 */
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
    const userId = Number(id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const messages = await cacheQuery(
      `customer:recentimg:${userId}`,
      () => prisma.message.findMany({
        where: {
          userId,
          messageType: 'image',
          direction: 'incoming',
        },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          content: true,
          mediaUrl: true,
          createdAt: true,
        },
      }),
      CACHE_TTL.MESSAGES  // 15s
    )

    const images = messages.map((msg) => ({
      id: msg.id,
      url: msg.content || null,
      mediaUrl: msg.mediaUrl || null,
      createdAt: msg.createdAt?.toISOString() || null,
    }))

    return NextResponse.json({
      success: true,
      data: { images },
    })
  } catch (error) {
    console.error('[recent-images] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
