import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const BDO_API  = `${PHP_BASE}/api/odoo-dashboard-api.php`
const INTERNAL_SECRET = process.env.INTERNAL_API_SECRET || ''

/**
 * GET /api/slip-center/bdo-detail?bdoId=xxx&lineUserId=xxx
 *
 * Fetch full BDO detail from bdo-inbox-api.php (live from Odoo).
 * Returns: bdo, sale_orders, outstanding_invoices, credit_notes, deposits, slips, summary, odoo_url
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bdoId     = searchParams.get('bdoId') || ''
    const lineUserId = searchParams.get('lineUserId') || ''

    if (!bdoId) {
      return NextResponse.json({ success: false, error: 'bdoId is required' }, { status: 400 })
    }

    const cacheKey = lineUserId
      ? `slipcenter:bdodetail:${bdoId}:${lineUserId}`
      : `slipcenter:bdodetail:${bdoId}`
    const data = await cacheQuery(
      cacheKey,
      async () => {
        const res = await fetch(BDO_API, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'InboxReya-SlipCenter/1.0',
            'X-Internal-Secret': INTERNAL_SECRET,
          },
          body: JSON.stringify({
            action: 'bdo_detail',
            bdo_id: Number(bdoId),
            line_user_id: lineUserId,
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(20000),
        })

        const rawText = await res.text()
        let json: any
        try {
          json = JSON.parse(rawText)
        } catch {
          throw new Error(`PHP returned non-JSON (HTTP ${res.status}): ${rawText.slice(0, 200)}`)
        }

        if (!json.success) {
          throw new Error(json.error || 'PHP error')
        }

        // bdo-inbox-api wraps result under json.data which contains the actionBdoDetail return
        const d = json.data || {}

        return {
          bdo:                  d.bdo                  ?? null,
          sale_orders:          d.sale_orders          ?? [],
          outstanding_invoices: d.outstanding_invoices ?? [],
          credit_notes:         d.credit_notes         ?? [],
          deposits:             d.deposits             ?? [],
          slips:                d.slips                ?? [],
          summary:              d.summary              ?? null,
          odoo_url:             d.odoo_url             ?? null,
          statement_pdf_url:    d.statement_pdf_url    ?? null,
          source:               d.source               ?? 'odoo',
          stale_warning:        d.stale_warning        ?? null,
        }
      },
      CACHE_TTL.SLIP_CENTER  // 30s
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[slip-center/bdo-detail] GET error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
