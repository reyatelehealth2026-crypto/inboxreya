import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheInvalidate } from '@/lib/redis'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const DASHBOARD_API = `${PHP_BASE}/api/odoo-dashboard-api.php`

/**
 * POST /api/slip-center/unmatch
 *
 * Unmatch a slip from BDO via PHP backend.
 * Body: { slipInboxId, lineUserId, localSlipId?, reason? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { slipInboxId, lineUserId, localSlipId, reason } = body

    const res = await fetch(DASHBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
      body: JSON.stringify({
        action: 'odoo_slip_unmatch_api',
        slip_inbox_id: slipInboxId || 0,
        line_user_id: lineUserId || '',
        local_slip_id: localSlipId || 0,
        reason: reason || 'Unmatched from Slip Center',
      }),
      cache: 'no-store',
    })

    const json = await res.json().catch(() => ({ success: false, error: 'Invalid response' }))
    if (json.success) {
      await cacheInvalidate('slipcenter:*')
    }
    return NextResponse.json(json)
  } catch (error) {
    console.error('[slip-center/unmatch] POST error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
