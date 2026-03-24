import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callPhpApi } from '@/lib/php-bridge'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

/**
 * GET /api/inbox/customers/[id]/slips
 *
 * Fetch payment slip records for a customer.
 * Looks up the customer's line_user_id, then queries the PHP backend.
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

    // Get lineUserId from DB
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: { lineUserId: true },
    })

    if (!user?.lineUserId) {
      return NextResponse.json({
        success: true,
        data: { slips: [], total: 0 },
      })
    }

    // Fetch slips from PHP backend
    const result = await cacheQuery(
      `customer:slips:${userId}`,
      () => callPhpApi(
        `/api/customer-slips.php?line_user_id=${encodeURIComponent(user.lineUserId)}`,
        { method: 'GET' }
      ),
      CACHE_TTL.ORDERS  // 30s
    )

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch slips' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      data: result.data,
    })
  } catch (error) {
    console.error('[customer-slips] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
