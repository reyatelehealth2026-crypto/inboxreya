/**
 * Deciding, without a human, which outstanding BDO a verified slip pays for.
 *
 * This runs unattended, so it errs towards doing nothing: a slip is only ever
 * attached when exactly one outstanding BDO matches the bank-confirmed amount to
 * the satang. Anything ambiguous is left for a rep, who can see the whole
 * customer history and pick correctly.
 */

export interface PendingBdo {
  bdo_id: number
  bdo_name?: string | null
  amount_total?: number | null
  amount_net_to_pay?: number | null
  payment_status?: string | null
}

/** What a BDO still expects to be paid — the net figure wins when present. */
export function bdoPayable(bdo: PendingBdo): number | null {
  const net = Number(bdo.amount_net_to_pay)
  if (Number.isFinite(net) && net > 0) return net

  const total = Number(bdo.amount_total)
  if (Number.isFinite(total) && total > 0) return total

  return null
}

export type MatchOutcome =
  | { status: 'matched'; bdo: PendingBdo }
  | { status: 'none' }
  | { status: 'ambiguous'; candidates: PendingBdo[] }

/**
 * This is a money comparison, so it is exact to the satang. The epsilon is half
 * a satang because a value like 100.10 does not survive a round trip through
 * JSON and MySQL DECIMAL as a clean binary float.
 */
const SATANG_EPSILON = 0.005

export function pickBdoForAmount(bdos: PendingBdo[], amount: number): MatchOutcome {
  if (!Number.isFinite(amount) || amount <= 0) return { status: 'none' }

  const candidates = bdos.filter((bdo) => {
    const payable = bdoPayable(bdo)
    if (payable === null) return false

    const settled = String(bdo.payment_status || '').toLowerCase()
    if (settled === 'paid' || settled === 'fully_paid' || settled === 'done') return false

    return Math.abs(payable - amount) < SATANG_EPSILON
  })

  if (candidates.length === 1) return { status: 'matched', bdo: candidates[0] }
  // Two BDOs for the same amount is a real case — a customer who orders the same
  // basket twice. Guessing would attach the payment to the wrong order, so hand
  // it back to a human instead.
  if (candidates.length > 1) return { status: 'ambiguous', candidates }
  return { status: 'none' }
}

/**
 * Outstanding BDOs for one inbox customer.
 *
 * Talks to the PHP backend directly rather than through
 * `/api/inbox/customers/[id]/bdos`, because that route requires a signed-in rep
 * and this runs from a cron with no session.
 */
export async function getPendingBdos(userId: number): Promise<PendingBdo[]> {
  // Imported here rather than at the top so the matching rules above can be
  // unit-tested without pulling in a database client.
  const { default: prisma } = await import('./prisma')

  const user = await prisma.lineUser.findUnique({
    where: { id: userId },
    select: { lineUserId: true, memberId: true },
  })

  // No member reference means the customer was never linked to Odoo, so there is
  // nothing to match against.
  if (!user?.memberId) return []

  const phpBase = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 8000)

  try {
    const response = await fetch(`${phpBase}/api/odoo-webhooks-dashboard.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'InboxReya-SlipAutoMatch/1.0',
      },
      body: JSON.stringify({
        action: 'pending_bdo_orders',
        customer_ref: user.memberId,
        line_user_id: user.lineUserId || '',
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    if (!response.ok) return []

    const text = await response.text()
    if (!text.trim()) return []

    const parsed = JSON.parse(text)
    const orders = parsed?.data?.bdo_orders ?? parsed?.bdo_orders
    return Array.isArray(orders) ? (orders as PendingBdo[]) : []
  } catch (error) {
    console.warn(
      '[slip-auto-match] could not load pending BDOs for',
      userId,
      error instanceof Error ? error.message : error
    )
    return []
  } finally {
    clearTimeout(timeout)
  }
}
