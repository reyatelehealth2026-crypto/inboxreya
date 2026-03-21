/**
 * Odoo Webhook Dashboard API Route
 * Proxies requests to PHP Odoo dashboard backend.
 * 
 * Supports both legacy inbox actions and the newer Odoo dashboard actions.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

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

    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'InboxReya-OdooDashboard/1.0',
      },
      body: JSON.stringify(input),
      cache: 'no-store',
    })

    const contentType = response.headers.get('content-type')
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text()
      console.error('[OdooDashboard] Non-JSON response:', text.substring(0, 300))
      return NextResponse.json(
        { success: false, error: 'PHP backend returned non-JSON response' },
        { status: 502 }
      )
    }

    const result = await response.json()
    return NextResponse.json(result, { status: response.status })
  } catch (error) {
    console.error('[OdooDashboard] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
