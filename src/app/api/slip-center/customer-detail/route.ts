import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const DASHBOARD_API = `${PHP_BASE}/api/odoo-dashboard-api.php`
const SLIPS_API = `${PHP_BASE}/api/slips-list.php`

/**
 * GET /api/slip-center/customer-detail?ref=xxx&partnerId=xxx&lineUserId=xxx
 *
 * 2 parallel calls — same pattern as odoo-dashboard.js loadMatchingDashboard():
 *   1. slips-list.php?customer_ref=xxx (all slips for customer)
 *   2. odoo_bdo_list_api (BDOs for customer)
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
        { success: false, error: 'ref, partnerId or lineUserId is required' },
        { status: 400 }
      )
    }

    const slipParams = new URLSearchParams({ limit: '200', offset: '0' })
    if (ref) slipParams.set('customer_ref', ref)
    else if (partnerId) slipParams.set('partner_id', partnerId)
    else if (lineUserId) slipParams.set('line_user_id', lineUserId)

    const bdoBody: Record<string, unknown> = {
      action: 'odoo_bdo_list_api',
      limit: 200,
      offset: 0,
    }
    if (ref) bdoBody.customer_ref = ref
    if (partnerId) bdoBody.partner_id = partnerId
    if (lineUserId) bdoBody.line_user_id = lineUserId

    const signal = AbortSignal.timeout(20000)
    const headers = { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' }

    const [slipRes, bdoRes] = await Promise.all([
      fetch(`${SLIPS_API}?${slipParams}`, { headers: { 'User-Agent': headers['User-Agent'] }, cache: 'no-store', signal })
        .then(r => r.json()).catch(() => ({ success: false, data: { slips: [] } })),
      fetch(DASHBOARD_API, { method: 'POST', headers, body: JSON.stringify(bdoBody), cache: 'no-store', signal })
        .then(r => r.json()).catch(() => ({ success: false, data: { bdos: [] } })),
    ])

    // Deduplicate slips by id — slips-list.php JOINs odoo_bdos which multiplies rows
    const rawSlips: any[] = slipRes?.data?.slips ?? slipRes?.slips ?? []
    const slipSeen = new Set<number>()
    const allSlips: any[] = rawSlips.filter((s: any) => {
      if (slipSeen.has(s.id)) return false
      slipSeen.add(s.id)
      return true
    })

    const rawBdos: any[] = bdoRes?.data?.bdos ?? bdoRes?.bdos ?? []

    // Normalize BDO fields:
    // - Odoo live API returns: name, amount_net_to_pay, doc_date, partner_name
    // - Local sync table returns: bdo_name, amount_total, bdo_date, state
    const allBdos = rawBdos.map((b: any) => ({
      ...b,
      bdo_id:       b.bdo_id       ?? b.id             ?? null,
      bdo_name:     b.bdo_name     ?? b.name           ?? '',
      amount_total: b.amount_total ?? b.amount_net_to_pay ?? 0,
      bdo_date:     b.bdo_date     ?? b.doc_date        ?? null,
      payment_status: b.payment_status ?? b.state       ?? '',
    }))

    const pendingSlips = allSlips.filter((s: any) => {
      const st = String(s?.status || '').toLowerCase()
      return st === 'pending' || st === 'new' || st === 'uploaded' || st === ''
    })

    const today = new Date().toISOString().slice(0, 10)
    const matchedToday = allSlips.filter((s: any) => {
      const st = String(s?.status || '').toLowerCase()
      const matchedAt = s?.matched_at || s?.updated_at || ''
      return (st === 'matched' || st === 'reconciled') && matchedAt.startsWith(today)
    })

    // bdoOrders = unpaid BDOs with non-zero amount — what user needs to act on
    // allBdos = full list including done/paid — for reference
    const bdoOrders = allBdos.filter((b: any) => {
      const ps = String(b.payment_status || '').toLowerCase()
      if (ps === 'done' || ps === 'paid' || ps === 'fully_paid') return false
      const amt = parseFloat(String(b.amount_total ?? b.amount_net_to_pay ?? 0))
      if (amt <= 0) return false
      return true
    })

    return NextResponse.json({
      success: true,
      data: {
        bdoOrders,
        allBdos,
        pendingSlips,
        allSlips,
        matchedToday,
        stats: {
          totalBdos:         bdoOrders.length,
          totalAllBdos:      allBdos.length,
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
