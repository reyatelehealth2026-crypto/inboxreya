import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

const PHP_BASE = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
const DASHBOARD_API = `${PHP_BASE}/api/odoo-dashboard-api.php`

/**
 * GET /api/slip-center/bdo-detail?bdoId=xxx&partnerId=xxx
 *
 * Fetch full BDO detail via odoo_bdo_detail_api action (same as odoo-dashboard.js openBdoDetail).
 * Returns: bdo summary, sale_orders, slips, outstanding_invoices, credit_notes, deposits, pdf_url
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const bdoId = searchParams.get('bdoId') || ''
    const partnerId = searchParams.get('partnerId') || ''

    if (!bdoId) {
      return NextResponse.json({ success: false, error: 'bdoId is required' }, { status: 400 })
    }

    const data = await cacheQuery(
      `slipcenter:bdo:${bdoId}:${partnerId}`,
      async () => {
        const res = await fetch(DASHBOARD_API, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'User-Agent': 'InboxReya-SlipCenter/1.0' },
          body: JSON.stringify({
            action: 'odoo_bdo_detail_api',
            bdo_id: bdoId,
            partner_id: partnerId || '',
          }),
          cache: 'no-store',
          signal: AbortSignal.timeout(15000),
        })

        const json = await res.json().catch(() => ({ success: false, error: 'Invalid JSON from PHP' }))

        if (!json.success) {
          throw new Error(json.error || 'PHP error')
        }

        const d = json.data || {}

        const pdfUrl = d.statement_pdf_url
          ? `${PHP_BASE}/api/odoo-dashboard-api.php?action=odoo_bdo_statement_pdf&bdo_id=${encodeURIComponent(String(bdoId))}`
          : (d.bdo?.statement_pdf_path ? `${PHP_BASE}/api/odoo-dashboard-api.php?action=odoo_bdo_statement_pdf&bdo_id=${encodeURIComponent(String(bdoId))}` : null)

        return {
          bdo: d.bdo ?? null,
          summary: d.summary ?? null,
          sale_orders: d.sale_orders ?? [],
          outstanding_invoices: d.outstanding_invoices ?? [],
          credit_notes: d.credit_notes ?? [],
          deposits: d.deposits ?? [],
          slips: d.slips ?? [],
          odoo_url: d.odoo_url ?? null,
          pdf_url: pdfUrl,
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
