import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const DASHBOARD_API = `${PHP_BASE}/api/odoo-dashboard-api.php`
const SLIPS_API = `${PHP_BASE}/api/slips-list.php`

async function phpPost(body: Record<string, unknown>) {
  const res = await fetch(DASHBOARD_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
    body: JSON.stringify(body),
    cache: 'no-store',
  })
  return res.json().catch(() => ({ success: false, error: 'Invalid JSON' }))
}

/**
 * GET /api/slip-center/customer-detail?ref=xxx&partnerId=xxx&lineUserId=xxx
 *
 * Fetch BDOs + slips for a specific customer.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const ref = searchParams.get('ref') || ''
    const partnerId = searchParams.get('partnerId') || ''
    const lineUserId = searchParams.get('lineUserId') || ''

    if (!ref && !partnerId && !lineUserId) {
      return NextResponse.json(
        { success: false, error: 'ref, partnerId, or lineUserId is required' },
        { status: 400 }
      )
    }

    // Fetch BDOs and slips in parallel
    const [bdoRes, slipRes, allSlipsRes] = await Promise.all([
      phpPost({
        action: 'pending_bdo_orders',
        customer_ref: ref,
        partner_id: partnerId,
        line_user_id: lineUserId,
        limit: 100,
      }),
      // Pending slips only (for matching)
      fetch(`${SLIPS_API}?status=pending&limit=100&offset=0${lineUserId ? `&search=${encodeURIComponent(lineUserId)}` : ''}`, {
        headers: { 'User-Agent': 'InboxReya-SlipCenter/1.0' },
        cache: 'no-store',
      }).then(r => r.json()).catch(() => ({ success: false })),
      // All slips (for history)
      fetch(`${SLIPS_API}?limit=50&offset=0${lineUserId ? `&search=${encodeURIComponent(lineUserId)}` : ''}`, {
        headers: { 'User-Agent': 'InboxReya-SlipCenter/1.0' },
        cache: 'no-store',
      }).then(r => r.json()).catch(() => ({ success: false })),
    ])

    const bdoOrders = bdoRes?.success ? (bdoRes.data?.bdo_orders || []) : []
    const pendingSlips = slipRes?.success ? (slipRes.data?.slips || []) : []
    const allSlips = allSlipsRes?.success ? (allSlipsRes.data?.slips || []) : []

    // Separate matched slips from today for the "matched today" section
    const today = new Date().toISOString().slice(0, 10)
    const matchedToday = allSlips.filter((s: any) =>
      s.status === 'matched' && s.matched_at && s.matched_at.startsWith(today)
    )

    return NextResponse.json({
      success: true,
      data: {
        bdoOrders,
        pendingSlips,
        allSlips,
        matchedToday,
        stats: {
          totalBdos: bdoOrders.length,
          totalPendingSlips: pendingSlips.length,
          totalMatchedToday: matchedToday.length,
        },
      },
    })
  } catch (error) {
    console.error('[slip-center/customer-detail] GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
