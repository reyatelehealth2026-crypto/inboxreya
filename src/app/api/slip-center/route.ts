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

    const [slipRes, bdoRes] = await Promise.all([
      fetch(`${SLIPS_API}?status=pending&limit=200&offset=0`, {
        headers: { 'User-Agent': 'InboxReya-SlipCenter/1.0' },
        cache: 'no-store',
      }).then(r => r.json()).catch(() => ({ success: false })),
      // Fast local-DB BDO overview — no Odoo live API, no customer_list bottleneck
      phpPost({ action: 'slip_center_bdo_overview', limit: 500 }),
    ])

    const pendingSlips: any[] = slipRes?.data?.slips ?? slipRes?.slips ?? []

    // slip_center_bdo_overview returns odoo_bdo_orders with payment_status pending/partial
    const allBdos: any[] = bdoRes?.data?.bdos ?? bdoRes?.bdos ?? []

    const pendingBdos = allBdos.filter((b: any) => {
      const status = String(b?.payment_status || b?.status || '').toLowerCase()
      if (status === 'paid' || status === 'fully_paid' || status === 'done') return false
      if (status === 'matched' || status === 'reconciled') return false
      return true
    })

    // Derive unique customer list from BDO + slip data (avoids slow customer_list action)
    const customerMap = new Map<string, any>()
    for (const b of allBdos) {
      const ref = b.customer_ref || b.line_user_id
      if (!ref) continue
      if (!customerMap.has(ref)) {
        customerMap.set(ref, {
          customer_ref: b.customer_ref || '',
          customer_name: b.customer_name || '',
          partner_id: b.partner_id ?? null,
          line_user_id: b.line_user_id || '',
        })
      }
    }
    for (const s of pendingSlips) {
      const ref = s.customer_ref || s.line_user_id
      if (!ref) continue
      if (!customerMap.has(ref)) {
        customerMap.set(ref, {
          customer_ref: s.customer_ref || '',
          customer_name: s.customer_name || '',
          partner_id: s.partner_id ?? null,
          line_user_id: s.line_user_id || '',
        })
      }
    }
    const customers = Array.from(customerMap.values())

    return NextResponse.json({
      success: true,
      data: {
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
      },
    })
  } catch (error) {
    console.error('[slip-center] GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
