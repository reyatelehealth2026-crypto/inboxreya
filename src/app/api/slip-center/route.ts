import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

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
 * GET /api/slip-center
 *
 * Combined data for the Slip Center dashboard:
 * - customer_list (with fast mode)
 * - pending slips
 * - pending BDOs
 * All fetched in parallel from the PHP backend.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const combinedData = await cacheQuery(
      `slipcenter:dashboard`,
      async () => {
        const [custRes, slipRes, bdoRes] = await Promise.all([
          phpPost({ action: 'customer_list', limit: 100, offset: 0, fast: 1 }),
          fetch(`${SLIPS_API}?status=pending&limit=200&offset=0`, {
            headers: { 'User-Agent': 'InboxReya-SlipCenter/1.0' },
            cache: 'no-store',
          }).then(r => r.json()).catch(() => ({ success: false })),
          phpPost({ action: 'slip_center_bdo_overview', limit: 200 }),
        ])

        const customers = custRes?.success && custRes?.data?.customers
          ? custRes.data.customers
          : []

        const pendingSlips = slipRes?.success && slipRes?.data?.slips
          ? slipRes.data.slips
          : []

        const allBdos = bdoRes?.success && bdoRes?.data?.bdos
          ? bdoRes.data.bdos
          : []

        const pendingBdos = allBdos.filter((b: any) => {
          const status = String(b?.payment_status || b?.status || '').toLowerCase()
          if (status === 'paid' || status === 'fully_paid' || status === 'done') return false
          if (status === 'matched' || status === 'reconciled') return false
          return true
        })

        return {
          customers,
          pendingSlips,
          pendingBdos,
          allBdos,
          stats: {
            totalCustomers: customers.length,
            totalPendingSlips: pendingSlips.length,
            totalPendingBdos: pendingBdos.length,
            totalAllBdos: allBdos.length,
          },
        }
      },
      CACHE_TTL.SLIP_CENTER  // 30s
    )

    return NextResponse.json({ success: true, data: combinedData })
  } catch (error) {
    console.error('[slip-center] GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
