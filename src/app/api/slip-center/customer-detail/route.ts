import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

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

    const data = await cacheQuery(
      `slipcenter:custdetail:${ref || partnerId || lineUserId}`,
      async () => {
        const res = await fetch(DASHBOARD_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
          body: JSON.stringify({
            action: 'slip_center_customer_detail',
            customer_ref: ref,
            partner_id: partnerId,
            line_user_id: lineUserId,
            limit: 500,
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })

        const json = await res.json().catch(() => ({ success: false, error: 'Invalid JSON from PHP' }))

        if (!json.success) {
          throw new Error(json.error || 'PHP error')
        }

        const CUTOFF_STR = '2025-03-24'
        const isAfterCutoff = (b: any) => {
          const rawDate = b?.bdo_date ?? b?.doc_date ?? null
          if (!rawDate) return false  // no date = block
          const d = String(rawDate).slice(0, 10)
          return /^\d{4}-\d{2}-\d{2}$/.test(d) && d >= CUTOFF_STR
        }

        const d = json.data
        const rawBdos: any[] = d.bdo_orders ?? []

        const isPaid = (b: any) => {
          const s  = String(b?.payment_status || b?.status || '').toLowerCase().trim()
          const st = String(b?.state || '').toLowerCase().trim()
          return s === 'paid' || s === 'fully_paid' || s === 'done' || st === 'done'
        }

        const activeBdos = rawBdos.filter(b => !isPaid(b) && isAfterCutoff(b))
        const paidBdos   = rawBdos.filter(b => isPaid(b))

        return {
          bdoOrders:    activeBdos,
          paidBdos,
          pendingSlips: d.pending_slips ?? [],
          allSlips:     d.all_slips     ?? [],
          matchedToday: d.matched_today ?? [],
          stats: {
            totalBdos:          activeBdos.length,
            totalPaidBdos:      paidBdos.length,
            totalPendingSlips:  d.stats?.total_pending_slips ?? (d.pending_slips?.length ?? 0),
            totalMatchedToday:  d.stats?.total_matched_today ?? (d.matched_today?.length ?? 0),
          },
          _debug: d.errors?.length ? d.errors : undefined,
        }
      },
      CACHE_TTL.SLIP_CENTER  // 30s
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[slip-center/customer-detail] GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
