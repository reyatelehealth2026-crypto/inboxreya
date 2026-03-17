import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const SLIP_MATCH_API = `${PHP_BASE}/api/slip-match-orders.php`

/**
 * POST /api/slip-center/match
 *
 * Match a slip to BDO(s) via slip-match-orders.php (canonical BDO matching endpoint).
 * Body: { localSlipId, lineAccountId, lineUserId, matches: [{bdo_id, amount}], note? }
 *
 * Maps to slip-match-orders.php action=match:
 *   slip_id        ← localSlipId
 *   line_account_id ← lineAccountId
 *   targets        ← [{ type: 'bdo', id: bdo_id, amount }]
 *   note           ← note
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { localSlipId, lineAccountId, lineUserId, matches, note } = body

    if (!localSlipId || !lineAccountId) {
      return NextResponse.json({ success: false, error: 'localSlipId and lineAccountId are required' }, { status: 400 })
    }
    if (!matches || !Array.isArray(matches) || matches.length === 0) {
      return NextResponse.json({ success: false, error: 'matches array is required' }, { status: 400 })
    }

    // Convert matches [{bdo_id, amount}] → targets [{type:'bdo', id, amount}]
    const targets = matches.map((m: { bdo_id: number; amount?: number }) => ({
      type: 'bdo',
      id: m.bdo_id,
      amount: m.amount ?? 0,
    }))

    const res = await fetch(SLIP_MATCH_API, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
      body: JSON.stringify({
        action: 'match',
        slip_id: localSlipId,
        line_account_id: lineAccountId,
        line_user_id: lineUserId || '',
        targets,
        note: note || 'Matched from Slip Center',
      }),
      cache: 'no-store',
    })

    const json = await res.json().catch(() => ({ success: false, error: 'Invalid response' }))
    return NextResponse.json(json)
  } catch (error) {
    console.error('[slip-center/match] POST error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
