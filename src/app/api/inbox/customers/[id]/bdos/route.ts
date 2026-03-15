import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inbox/customers/[id]/bdos
 *
 * Fetch pending BDO orders for a customer.
 * Resolves customer_ref (memberId) from DB, then queries PHP backend
 * for pending BDO orders linked to that partner.
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

    // Get memberId (customer_ref) and lineUserId from DB
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: { lineUserId: true, memberId: true },
    })

    if (!user) {
      return NextResponse.json({
        success: true,
        data: { bdo_orders: [], total: 0 },
      })
    }

    // Call PHP backend for pending BDO orders
    const phpBase = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
    const apiUrl = `${phpBase}/api/odoo-webhooks-dashboard.php`

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'InboxReya-BDO/1.0',
      },
      body: JSON.stringify({
        action: 'pending_bdo_orders',
        customer_ref: user.memberId || '',
        line_user_id: user.lineUserId || '',
      }),
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      return NextResponse.json({
        success: true,
        data: { bdo_orders: [], total: 0 },
      })
    }

    const result = await response.json()

    return NextResponse.json({
      success: true,
      data: result.data || { bdo_orders: result.bdo_orders || [], total: result.total || 0 },
    })
  } catch (error) {
    console.error('[customer-bdos] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
