import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

/**
 * GET /api/inbox/customers/[id]/bdos
 *
 * Fetch pending BDO orders for a customer.
 * Resolves customer_ref (memberId) from DB, then queries PHP backend
 * for pending BDO orders linked to that partner.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params
    const userId = Number(id)
    if (!Number.isFinite(userId)) {
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    // Get memberId (customer_ref) and lineUserId from DB
    const user = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: { lineUserId: true, memberId: true },
    })

    if (!user) {
      return NextResponse.json({
        success: true,
        data: { bdo_orders: [], total: 0 },
      })
    }

    // Call PHP backend for pending BDO orders
    const phpBase = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
    const apiUrl = `${phpBase}/api/odoo-webhooks-dashboard.php`

    const result = await cacheQuery(
      `customer:bdos:${userId}`,
      async () => {
        const empty = { bdo_orders: [], total: 0 }
        const controller = new AbortController()
        const timeout = setTimeout(() => controller.abort(), 8000)

        let response: Response
        try {
          response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'InboxReya-BDO/1.0',
            },
            body: JSON.stringify({
              action: 'pending_bdo_orders',
              customer_ref: user.memberId || '',
              line_user_id: user.lineUserId || '',
            }),
            cache: 'no-store',
            signal: controller.signal,
          })
        } catch (fetchErr) {
          const isAbort = fetchErr instanceof Error && fetchErr.name === 'AbortError'
          console.warn('[customer-bdos] PHP fetch failed', {
            kind: isAbort ? 'timeout' : 'network',
            error: fetchErr instanceof Error ? fetchErr.message : String(fetchErr),
            userId,
          })
          return empty
        } finally {
          clearTimeout(timeout)
        }

        if (!response.ok) {
          console.warn('[customer-bdos] PHP backend non-OK response', {
            status: response.status,
            statusText: response.statusText,
          })
          return empty
        }

        const text = await response.text()
        if (!text || !text.trim()) {
          return empty
        }

        let res: { data?: { bdo_orders?: unknown; total?: unknown }; bdo_orders?: unknown; total?: unknown }
        try {
          res = JSON.parse(text)
        } catch (parseErr) {
          console.warn('[customer-bdos] Failed to parse PHP response as JSON', {
            preview: text.slice(0, 200),
            error: parseErr instanceof Error ? parseErr.message : String(parseErr),
          })
          return empty
        }

        // PHP already filters by bdo_date >= 2025-03-24
        if (res && typeof res === 'object' && res.data && typeof res.data === 'object') {
          return {
            bdo_orders: Array.isArray(res.data.bdo_orders) ? res.data.bdo_orders : [],
            total: typeof res.data.total === 'number' ? res.data.total : 0,
          }
        }
        return {
          bdo_orders: Array.isArray(res?.bdo_orders) ? res.bdo_orders : [],
          total: typeof res?.total === 'number' ? res.total : 0,
        }
      },
      CACHE_TTL.ORDERS  // 30s
    )

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    console.error('[customer-bdos] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
