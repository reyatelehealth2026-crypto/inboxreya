import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const DASHBOARD_API = `${PHP_BASE}/api/odoo-dashboard-api.php`

/**
 * GET /api/slip-center/customer-detail?ref=xxx&partnerId=xxx&lineUserId=xxx
 *
 * Fetch BDOs + slips for a specific customer via a single combined PHP call.
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

    const res = await fetch(DASHBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
      body: JSON.stringify({
        action: 'slip_center_customer_detail',
        customer_ref: ref,
        partner_id: partnerId,
        line_user_id: lineUserId,
        limit: 100,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(25000), // 25s timeout — fail fast before Vercel 30s
    })

    const json = await res.json().catch(() => ({ success: false, error: 'Invalid JSON from PHP' }))

    if (!json.success) {
      // Return empty data with error info instead of 5xx so transient PHP failures
      // don't inflate the Vercel function error rate.
      return NextResponse.json({
        success: false,
        error: json.error || 'PHP error',
        data: { bdoOrders: [], pendingSlips: [], allSlips: [], matchedToday: [], stats: { totalBdos: 0, totalPendingSlips: 0, totalMatchedToday: 0 } },
      })
    }

    const d = json.data || {}
    return NextResponse.json({
      success: true,
      data: {
        bdoOrders:    d.bdo_orders    ?? [],
        pendingSlips: d.pending_slips ?? [],
        allSlips:     d.all_slips     ?? [],
        matchedToday: d.matched_today ?? [],
        stats: {
          totalBdos:          d.stats?.total_bdos          ?? (d.bdo_orders?.length    ?? 0),
          totalPendingSlips:  d.stats?.total_pending_slips ?? (d.pending_slips?.length ?? 0),
          totalMatchedToday:  d.stats?.total_matched_today ?? (d.matched_today?.length ?? 0),
        },
        _debug: d.errors?.length ? d.errors : undefined,
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
