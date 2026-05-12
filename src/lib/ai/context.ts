/**
 * Aggregates conversation context for the AI helpers (GhostDraft, Summarizer,
 * Action Suggester, Order Parser). Fans out to Prisma + PHP backend in
 * parallel with per-source timeouts; failures degrade gracefully into the
 * `degraded[]` field instead of throwing.
 */
import { prisma } from '../prisma'
import { cacheQuery, CACHE_TTL } from '../redis'
import { OrderService, callPhpApi } from '../php-bridge'
import { logger } from '../logger'

export type AiContext = {
  messages: Array<{ role: 'customer' | 'agent'; content: string; at: Date }>
  customer: { id: number; lineUserId: string; displayName: string | null; phone: string | null } | null
  orders: Array<{ orderNumber: string; total: number; status: string; createdAt: string }> | null
  catalog: Array<{ sku: string; name: string; price: number }> | null
  degraded: string[]
}

type CustomerProfile = AiContext['customer']
type OrdersList = AiContext['orders']
type CatalogList = AiContext['catalog']
type MessageList = AiContext['messages']

const TIMEOUT_SENTINEL = Symbol('ai-context-timeout')

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMEOUT_SENTINEL> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<typeof TIMEOUT_SENTINEL>((resolve) => {
    timer = setTimeout(() => resolve(TIMEOUT_SENTINEL), ms)
  })
  try {
    return await Promise.race([p, timeout])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

async function fetchMessages(userId: number, take: number): Promise<MessageList> {
  const rows = await prisma.message.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
    take,
  })
  return rows.reverse().map((msg) => ({
    role: msg.direction === 'incoming' ? ('customer' as const) : ('agent' as const),
    content: msg.content || `[${msg.messageType}]`,
    at: msg.createdAt,
  }))
}

async function fetchCustomer(userId: number): Promise<CustomerProfile> {
  return cacheQuery(
    `ai:customer:${userId}`,
    () =>
      prisma.lineUser.findUnique({
        where: { id: userId },
        select: { id: true, lineUserId: true, displayName: true, phone: true },
      }),
    CACHE_TTL.CUSTOMER_360,
  )
}

async function fetchOrders(lineUserId: string): Promise<OrdersList> {
  return cacheQuery(
    `ai:orders:${lineUserId}`,
    async () => {
      const res = await OrderService.getCustomerOrders(lineUserId)
      if (!res.success || !res.data) throw new Error(res.error || 'orders fetch failed')
      return res.data.orders.map((o) => ({
        orderNumber: o.orderNumber,
        total: o.total,
        status: o.status,
        createdAt: o.createdAt,
      }))
    },
    60,
  )
}

async function fetchCatalog(): Promise<CatalogList> {
  return cacheQuery(
    'ai:catalog:top20',
    async () => {
      const res = await callPhpApi<{ items: Array<{ sku: string; name: string; price: number }> }>(
        '/api/catalog.php?top=20',
      )
      if (!res.success || !res.data) throw new Error(res.error || 'catalog fetch failed')
      return res.data.items.map((p) => ({ sku: p.sku, name: p.name, price: p.price }))
    },
    900,
  )
}

export async function buildConversationContext(
  userId: number,
  opts?: {
    messageWindow?: number
    includeOrders?: boolean
    includeCatalog?: boolean
    perSourceTimeoutMs?: number
  },
): Promise<AiContext> {
  const messageWindow = opts?.messageWindow ?? 30
  const includeOrders = opts?.includeOrders ?? true
  const includeCatalog = opts?.includeCatalog ?? true
  const timeoutMs = opts?.perSourceTimeoutMs ?? 3000

  const degraded: string[] = []

  const settle = async <T>(name: string, work: Promise<T>): Promise<T | null> => {
    const settled = await Promise.allSettled([withTimeout(work, timeoutMs)])
    const r = settled[0]
    if (r.status === 'rejected') {
      degraded.push(name)
      return null
    }
    if (r.value === TIMEOUT_SENTINEL) {
      degraded.push(name)
      return null
    }
    return r.value as T
  }

  const [messages, customer, catalog] = await Promise.all([
    settle('messages', fetchMessages(userId, messageWindow)),
    settle('customer', fetchCustomer(userId)),
    includeCatalog ? settle('catalog', fetchCatalog()) : Promise.resolve(null),
  ])

  let orders: OrdersList = null
  if (includeOrders) {
    if (customer?.lineUserId) {
      orders = await settle('orders', fetchOrders(customer.lineUserId))
    } else {
      degraded.push('orders')
    }
  }

  if (degraded.length > 0) {
    logger.warn('ai context degraded', { scope: 'ai:context', userId, degraded })
  }

  return {
    messages: messages ?? [],
    customer: customer ?? null,
    orders,
    catalog: catalog ?? null,
    degraded,
  }
}
