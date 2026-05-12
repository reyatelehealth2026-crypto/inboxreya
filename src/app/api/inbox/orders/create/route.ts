/** Create order from inbox: validates parsed items and proxies them to PHP OrderService.createOrder. */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { OrderService } from '@/lib/php-bridge'
import { logger } from '@/lib/logger'

interface IncomingItem {
  sku: string
  name: string
  qty: number
  price?: number
}

function validateItems(raw: unknown): IncomingItem[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null
  const out: IncomingItem[] = []
  for (const it of raw) {
    if (!it || typeof it !== 'object') return null
    const r = it as Record<string, unknown>
    const sku = typeof r.sku === 'string' ? r.sku.trim() : ''
    if (sku.length === 0) return null
    const qty = typeof r.qty === 'number' ? r.qty : Number(r.qty)
    if (!Number.isInteger(qty) || qty <= 0) return null
    const name = typeof r.name === 'string' ? r.name : ''
    let price: number | undefined
    if (r.price !== undefined && r.price !== null) {
      const p = typeof r.price === 'number' ? r.price : Number(r.price)
      if (!Number.isFinite(p)) return null
      price = p
    }
    out.push({ sku, name, qty, ...(price !== undefined ? { price } : {}) })
  }
  return out
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawUserId = (body as { userId?: number | string }).userId
    const userId = rawUserId != null ? parseInt(String(rawUserId), 10) : NaN
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid or missing userId' }, { status: 400 })
    }

    const items = validateItems((body as { items?: unknown }).items)
    if (!items) {
      return NextResponse.json({ error: 'Invalid or missing items' }, { status: 400 })
    }

    const user = await prisma.lineUser.findFirst({
      where: {
        id: userId,
        ...(session.user.role !== 'super_admin' && session.user.lineAccountId
          ? { lineAccountId: session.user.lineAccountId }
          : {}),
      },
      select: { id: true, lineUserId: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // The PHP backend resolves products by SKU when productId=0, but the
    // OrderService.createOrder TS type was authored before this was needed.
    // We pass `sku`/`name`/`price` through anyway (PHP ignores unknown
    // fields when productId is set) and cast through `unknown` to satisfy
    // the legacy signature.
    const phpItems = items.map((i) => ({
      productId: 0,
      quantity: i.qty,
      sku: i.sku,
      name: i.name,
      ...(i.price !== undefined ? { price: i.price } : {}),
    })) as unknown as Array<{ productId: number; quantity: number }>

    const result = await OrderService.createOrder({
      userId: user.lineUserId,
      items: phpItems,
      adminId: session.user.id,
    })

    if (!result.success) {
      logger.warn('order create failed via php', {
        scope: 'api:inbox:orders:create',
        userId,
        adminId: session.user.id,
        detail: result.error,
      })
      return NextResponse.json(
        { error: 'ไม่สามารถสร้างออเดอร์ได้', detail: result.error },
        { status: 502 },
      )
    }

    logger.info('order created from inbox', {
      scope: 'api:inbox:orders:create',
      userId,
      adminId: session.user.id,
      orderId: result.data?.orderId,
      orderNumber: result.data?.orderNumber,
      itemCount: items.length,
    })

    return NextResponse.json({
      orderId: result.data?.orderId,
      orderNumber: result.data?.orderNumber,
    })
  } catch (error) {
    logger.error(error, { scope: 'api:inbox:orders:create' })
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to create order', message }, { status: 500 })
  }
}
