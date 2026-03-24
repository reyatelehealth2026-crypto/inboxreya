/**
 * GET /api/inbox/customers/[id]/customer-360
 *
 * Fetches Customer 360 data from PHP backend via odoo-webhooks-dashboard.php?action=customer_360
 * Returns profile, credit, orders, invoices, timeline, webhook_summary in one call.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

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

    // Get lineUserId and memberId from DB
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: { lineUserId: true, memberId: true },
    })

    if (!user?.lineUserId) {
      return NextResponse.json({
        success: true,
        data: {
          line_user_id: null,
          linked: false,
          profile: null,
          credit: null,
          orders: { total: 0, recent: [] },
          invoices: { total: 0, recent: [] },
          timeline: [],
          webhook_summary: { total: 0, success: 0, failed: 0 },
          warnings: ['No LINE user ID found'],
        },
      })
    }

    // Also try to get partner_id from odoo_line_users
    let partnerId: number | null = null
    let customerRef: string | null = user.memberId || null
    try {
      const link = await prisma.$queryRawUnsafe<Array<{
        odoo_partner_id: number | null
        odoo_customer_code: string | null
      }>>(
        `SELECT odoo_partner_id, odoo_customer_code FROM odoo_line_users WHERE line_user_id = ? LIMIT 1`,
        user.lineUserId
      )
      if (link.length > 0) {
        partnerId = link[0].odoo_partner_id
        customerRef = link[0].odoo_customer_code || customerRef
      }
    } catch {
      // Table may not exist
    }

    // Call PHP backend
    const phpBase = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
    const apiUrl = `${phpBase}/api/odoo-webhooks-dashboard.php`

    const { searchParams } = new URL(request.url)
    const ordersLimit = searchParams.get('orders_limit') || '10'
    const invoicesLimit = searchParams.get('invoices_limit') || '10'
    const timelineLimit = searchParams.get('timeline_limit') || '20'

    const result = await cacheQuery(
      `customer:360:${userId}`,
      async () => {
        const response = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            action: 'customer_360',
            line_user_id: user.lineUserId,
            partner_id: partnerId ? String(partnerId) : '',
            customer_ref: customerRef || '',
            orders_limit: Number(ordersLimit),
            invoices_limit: Number(invoicesLimit),
            timeline_limit: Number(timelineLimit),
          }),
          cache: 'no-store',
        })

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('application/json')) {
          const text = await response.text()
          console.error('[customer-360] Non-JSON:', text.substring(0, 200))
          return { success: false, error: 'PHP backend returned non-JSON response' }
        }

        return response.json()
      },
      CACHE_TTL.CUSTOMER_360  // 30s
    )

    return NextResponse.json(result)
  } catch (error) {
    console.error('[customer-360] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
