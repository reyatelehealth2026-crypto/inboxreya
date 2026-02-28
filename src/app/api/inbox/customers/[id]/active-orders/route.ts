import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inbox/customers/[id]/active-orders
 *
 * Fetch active and completed orders from odoo_order_projection.
 * Active = all states before invoice.paid
 * Completed = invoice.paid only
 */

interface OrderProjectionRow {
  id: number
  order_id: number
  order_name: string | null
  line_user_id: string | null
  odoo_partner_id: number | null
  customer_name: string | null
  customer_ref: string | null
  latest_event_type: string | null
  latest_state: string | null
  latest_state_display: string | null
  amount_total: number | null
  currency: string | null
  last_webhook_at: Date | null
  updated_at: Date | null
}

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
        data: { active: [], completed: [] },
      })
    }

    // Also resolve odoo_partner_id from odoo_line_users
    let odooPartnerId: number | null = null
    try {
      const partnerLink = await prisma.$queryRawUnsafe<Array<{ odoo_partner_id: number }>>(
        `SELECT odoo_partner_id FROM odoo_line_users WHERE line_user_id = ? LIMIT 1`,
        user.lineUserId
      )
      if (partnerLink.length > 0) {
        odooPartnerId = partnerLink[0].odoo_partner_id
      }
    } catch {
      // Table may not exist — continue with lineUserId only
    }

    // Check if odoo_order_projection table exists
    let tableExists = false
    try {
      const check = await prisma.$queryRawUnsafe<Array<{ cnt: bigint }>>(
        `SELECT COUNT(*) as cnt FROM information_schema.tables 
         WHERE table_schema = DATABASE() AND table_name = 'odoo_order_projection'`
      )
      tableExists = check.length > 0 && Number(check[0].cnt) > 0
    } catch {
      tableExists = false
    }

    if (!tableExists) {
      return NextResponse.json({
        success: true,
        data: { active: [], completed: [] },
      })
    }

    // Build WHERE clause: match by line_user_id OR odoo_partner_id
    let whereClause: string
    let queryParams: (string | number)[]

    if (odooPartnerId) {
      whereClause = `(op.line_user_id = ? OR op.odoo_partner_id = ?)`
      queryParams = [user.lineUserId, odooPartnerId]
    } else {
      whereClause = `op.line_user_id = ?`
      queryParams = [user.lineUserId]
    }

    // Fetch active orders (everything except invoice.paid and cancelled)
    const activeOrders = await prisma.$queryRawUnsafe<OrderProjectionRow[]>(
      `SELECT * FROM odoo_order_projection op
       WHERE ${whereClause}
         AND (op.latest_state IS NULL OR op.latest_state NOT IN ('invoice.paid', 'cancelled', 'bdo.cancelled'))
       ORDER BY op.last_webhook_at DESC
       LIMIT 20`,
      ...queryParams
    )

    // Fetch completed orders (invoice.paid)
    const completedOrders = await prisma.$queryRawUnsafe<OrderProjectionRow[]>(
      `SELECT * FROM odoo_order_projection op
       WHERE ${whereClause}
         AND op.latest_state = 'invoice.paid'
       ORDER BY op.last_webhook_at DESC
       LIMIT 10`,
      ...queryParams
    )

    // Serialize dates and decimals for JSON
    const serialize = (row: OrderProjectionRow) => ({
      id: row.id,
      orderId: row.order_id,
      orderName: row.order_name,
      lineUserId: row.line_user_id,
      odooPartnerId: row.odoo_partner_id,
      customerName: row.customer_name,
      customerRef: row.customer_ref,
      latestEventType: row.latest_event_type,
      latestState: row.latest_state,
      latestStateDisplay: row.latest_state_display,
      amountTotal: row.amount_total ? Number(row.amount_total) : null,
      currency: row.currency || 'THB',
      lastWebhookAt: row.last_webhook_at ? new Date(row.last_webhook_at).toISOString() : null,
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : null,
    })

    return NextResponse.json({
      success: true,
      data: {
        active: activeOrders.map(serialize),
        completed: completedOrders.map(serialize),
      },
    })
  } catch (error) {
    console.error('[active-orders] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
