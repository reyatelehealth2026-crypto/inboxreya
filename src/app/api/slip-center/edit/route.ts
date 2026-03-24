import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheInvalidate } from '@/lib/redis'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const DASHBOARD_API = `${PHP_BASE}/api/odoo-dashboard-api.php`

/**
 * PATCH /api/slip-center/edit
 *
 * Edit local slip fields (amount, transfer_date, note).
 * Only allowed on slips with status = 'pending'.
 * Body: { localSlipId, amount?, transferDate?, note? }
 */
export async function PATCH(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { localSlipId, amount, transferDate, note } = body

    if (!localSlipId) {
      return NextResponse.json(
        { success: false, error: 'localSlipId is required' },
        { status: 400 }
      )
    }

    if (amount !== undefined && (isNaN(Number(amount)) || Number(amount) < 0)) {
      return NextResponse.json(
        { success: false, error: 'Invalid amount' },
        { status: 400 }
      )
    }

    const res = await fetch(DASHBOARD_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
      body: JSON.stringify({
        action: 'slip_update_local',
        slip_id: localSlipId,
        amount: amount !== undefined ? Number(amount) : undefined,
        transfer_date: transferDate || undefined,
        note: note || undefined,
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(10000),
    })

    const json = await res.json().catch(() => ({ success: false, error: 'Invalid JSON from PHP' }))

    if (json.success) {
      await cacheInvalidate('slipcenter:*')
    }

    return NextResponse.json(json)
  } catch (error) {
    console.error('[slip-center/edit] PATCH error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
