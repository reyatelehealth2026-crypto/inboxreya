/**
 * Odoo Webhook Dashboard API Route
 * Proxies requests to PHP Odoo dashboard backend.
 * 
 * Supports both legacy inbox actions and the newer Odoo dashboard actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { cacheQuery, cacheInvalidate } from '@/lib/redis'
import crypto from 'crypto'

// TTL (วินาที) สำหรับแต่ละ action — ตรงกับที่ PHP side กำหนด
const ACTION_CACHE_TTL: Record<string, number> = {
  stats:                    60,
  order_grouped_today:      60,
  customer_list:            60,
  invoice_list:             60,
  order_list:               60,
  notification_log:         60,
  salesperson_list:         300,
  overview_today:           45,
  customer_full_detail:     45,
  overview_combined:        45,
  odoo_orders:              30,
  odoo_invoices:            30,
  odoo_slips:               30,
  odoo_bdo_list_api:        30,
  customer_detail:          45,
  customer_360:             30,
  pending_bdo_orders:       60,
  webhook_stats_mini:       30,
  dlq_stats:                30,
  activity_log_list:        30,
  // ── เพิ่มเติม: cache actions ที่ JS เรียกบ่อย ──
  overview_fast:            30,
  odoo_bdo_detail_api:      30,
  daily_summary_preview:    60,
  search_orders:            30,
  circuit_breaker_status:   30,
  slip_center_customer_detail: 30,
  slip_center_bdo_overview: 30,
  health:                   60,
  list:                     60,
  detail:                   45,
  dlq_list:                 30,
  customer_lookup:          60,
  invoice_lookup:           60,
  order_timeline:           30,
  odoo_bdos:                30,
}

// Actions ที่ write/mutate ข้อมูล — ห้าม cache เด็ดขาด
const MUTATION_ACTIONS = new Set([
  'order_status_override', 'order_note_add', 'order_notes_list',
  'send_bdo_payment_notification', 'preview_bdo_payment_notification',
  'dlq_retry', 'slip_match_bdo', 'slip_unmatch',
  'odoo_slip_match_api', 'odoo_slip_unmatch_api', 'unmatch_slip',
  'send_daily_summary',
])

const ALLOWED_ACTIONS = [
  'health', 'stats', 'list', 'detail', 'order_timeline',
  'customer_lookup', 'invoice_lookup', 'customer_list', 'invoice_list', 'order_list',
  'odoo_orders', 'odoo_invoices', 'odoo_slips', 'odoo_bdos',
  'pending_bdo_orders', 'unmatch_slip',
  'slip_match_bdo', 'odoo_slip_match_api',
  'slip_unmatch', 'odoo_slip_unmatch_api',
  'odoo_bdo_list_api', 'odoo_bdo_detail_api', 'odoo_bdo_statement_pdf',
  'customer_360', 'webhook_stats_mini',
  'dlq_list', 'dlq_retry', 'dlq_stats',
  'daily_summary_preview', 'notification_log',
  'order_grouped_today', 'customer_detail',
  'order_status_override', 'order_note_add', 'order_notes_list',
  'activity_log_list', 'salesperson_list',
  'send_bdo_payment_notification',
  'preview_bdo_payment_notification',
]

function normalizeActionInput(input: Record<string, unknown>) {
  const normalized = { ...input }
  const action = String(normalized.action || 'health')

  if (action === 'unmatch_slip') {
    normalized.action = 'odoo_slip_unmatch_api'
    if (normalized.local_slip_id == null && normalized.slip_id != null) {
      normalized.local_slip_id = normalized.slip_id
    }
  }

  if (action === 'slip_match_bdo') {
    if (normalized.local_slip_id == null && normalized.slip_id != null) {
      normalized.local_slip_id = normalized.slip_id
    }
  }

  return normalized
}

export async function GET(request: NextRequest) {
  return handleRequest(request)
}

export async function POST(request: NextRequest) {
  return handleRequest(request)
}

async function handleRequest(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    // Parse input from query params or body
    let input: Record<string, unknown> = {}

    const { searchParams } = new URL(request.url)
    searchParams.forEach((value, key) => {
      input[key] = value
    })

    if (request.method === 'POST') {
      try {
        const body = await request.json()
        input = { ...input, ...body }
      } catch {
        // No body or invalid JSON
      }
    }

    input = normalizeActionInput(input)
    const action = String(input.action || 'health')

    if (!ALLOWED_ACTIONS.includes(action)) {
      return NextResponse.json(
        { success: false, error: `Unknown action: ${action}` },
        { status: 400 }
      )
    }

    // Build PHP API URL
    const phpBase = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
    const apiUrl = `${phpBase}/api/odoo-dashboard-api.php`

    const cacheTtl = ACTION_CACHE_TTL[action]
    const isCacheable = cacheTtl !== undefined && !MUTATION_ACTIONS.has(action) && request.method !== 'POST'

    if (isCacheable) {
      // สร้าง cache key จาก action + input params (ไม่รวม session)
      const inputHash = crypto
        .createHash('md5')
        .update(JSON.stringify(input))
        .digest('hex')
        .slice(0, 12)
      const cacheKey = `odoo:dash:${action}:${inputHash}`

      const result = await cacheQuery(
        cacheKey,
        async () => {
          const res = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'InboxReya-OdooDashboard/1.0',
            },
            body: JSON.stringify(input),
            cache: 'no-store',
          })
          if (!res.ok) throw new Error(`PHP returned ${res.status}`)
          const ct = res.headers.get('content-type')
          if (!ct?.includes('application/json')) {
            const text = await res.text()
            throw new Error(`Non-JSON: ${text.substring(0, 200)}`)
          }
          return res.json()
        },
        cacheTtl
      )
      return NextResponse.json(result, {
        headers: { 'X-Cache-Action': action, 'X-Cache-TTL': String(cacheTtl) },
      })
    }

    // Non-cacheable: proxy ตรงๆ (timeout 35s สำหรับ mutation actions ที่เรียก Odoo API)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 35_000)
    let response: Response
    try {
      response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'User-Agent': 'InboxReya-OdooDashboard/1.0',
        },
        body: JSON.stringify(input),
        cache: 'no-store',
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeoutId)
    }

    const raw = await response.text()
    if (!raw.trim()) {
      console.error('[OdooDashboard] Empty response body from PHP, action:', action)
      return NextResponse.json(
        { success: false, error: 'PHP backend returned empty response' },
        { status: 502 }
      )
    }

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      console.error('[OdooDashboard] Non-JSON response:', raw.substring(0, 300))
      return NextResponse.json(
        { success: false, error: 'PHP backend returned non-JSON response' },
        { status: 502 }
      )
    }

    let result: unknown
    try {
      result = JSON.parse(raw)
    } catch (parseErr) {
      console.error('[OdooDashboard] JSON parse error, action:', action, 'body prefix:', raw.substring(0, 300))
      return NextResponse.json(
        { success: false, error: 'PHP backend returned malformed JSON' },
        { status: 502 }
      )
    }

    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('[OdooDashboard] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
