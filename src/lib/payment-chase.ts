import prisma from '@/lib/prisma'

/**
 * Payment chase — the reps' daily "ไล่ยอดชำระ" pass, as a reviewable queue.
 *
 * A generator sweep drafts one message per unpaid bill; a rep ticks the rows to
 * send; a drain sweep pushes them slowly so LINE's rate limit is never hit and
 * the run can be paused mid-flight.
 *
 * Everything here goes through Prisma raw SQL rather than the mysql2 pool in
 * @/lib/db. That pool has no DB_* env on prod and falls back to a different,
 * legacy database, so a query written against it silently reads the wrong
 * server. Prisma follows DATABASE_URL, which is where odoo_orders, messages and
 * the payment_chase_* tables actually live.
 */

/** Bill ages (days) that get chased. Round number == the age it was drafted at. */
export const CHASE_ROUNDS = [2, 4, 7] as const

/** Messages per drain tick, and the gap between them. 30 x 2s fits one minute. */
export const DRAIN_BATCH = 30
export const DRAIN_GAP_MS = 2000

const BANK_LINE = 'ธนาคารกสิกรไทย เลขที่บัญชี 068-3-84622-8'

export interface ChaseCandidate {
  orderId: number
  orderName: string | null
  userId: number
  lineUserId: string | null
  salespersonName: string | null
  orderDate: Date
  amount: number
}

/** Thai short bill date as the reps write it by hand: 24-8-69 */
export function formatBillDate(date: Date): string {
  const buddhistYear = date.getFullYear() + 543
  return `${date.getDate()}-${date.getMonth() + 1}-${String(buddhistYear).slice(-2)}`
}

export function formatAmount(amount: number): string {
  return amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Mirrors the wording the reps already send, so nothing reads machine-written. */
export function composeChaseMessage(candidate: ChaseCandidate): string {
  return [
    'สวัสดีค่ะ 🙏',
    '',
    'ทางร้านขออนุญาตติดตามยอดชำระค่าสินค้า',
    '',
    `บิลวันที่ ${formatBillDate(candidate.orderDate)}`,
    `ยอดชำระ ${formatAmount(candidate.amount)} บาท`,
    '',
    `กรุณาชำระผ่าน ${BANK_LINE}`,
    'เมื่อโอนแล้วรบกวนแนบสลิปให้แอดมินด้วยนะคะ',
    '',
    'ขอบพระคุณค่ะ',
  ].join('\n')
}

/**
 * Unpaid bills that are exactly `round` days old and safe to chase.
 *
 * Four exclusions, in order of how badly getting them wrong would land:
 * a slip already waiting on review (chasing someone who paid), a conversation
 * that already happened today (the rep is mid-thread), a customer on the
 * permanent opt-out list, and a bill already drafted for this round.
 */
export async function findChaseCandidates(round: number): Promise<ChaseCandidate[]> {
  // `round` comes from CHASE_ROUNDS, so it is a literal integer by the time it
  // reaches the query — never user text.
  const day = Math.floor(Number(round))

  const rows = await prisma.$queryRawUnsafe<
    Array<{
      orderId: number
      orderName: string | null
      userId: number
      lineUserId: string | null
      salespersonName: string | null
      orderDate: Date
      amount: unknown
    }>
  >(
    `
    SELECT
      o.order_id          AS orderId,
      o.order_name        AS orderName,
      u.id                AS userId,
      o.line_user_id      AS lineUserId,
      o.salesperson_name  AS salespersonName,
      o.date_order        AS orderDate,
      o.amount_total      AS amount
    FROM odoo_orders o
    JOIN users u ON u.line_user_id = o.line_user_id
    WHERE o.is_paid = 0
      AND o.state NOT IN ('cancel', 'draft')
      AND o.line_user_id IS NOT NULL
      AND DATEDIFF(CURDATE(), DATE(o.date_order)) = ${day}
      AND o.amount_total > 0
      AND NOT EXISTS (
        SELECT 1 FROM payment_chase_exclusions e WHERE e.user_id = u.id
      )
      AND NOT EXISTS (
        SELECT 1 FROM payment_chase_queue q
        WHERE q.order_id = o.order_id AND q.chase_round = ${day}
      )
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.user_id = u.id
          AND m.message_type = 'image'
          AND m.direction = 'incoming'
          AND m.created_at >= NOW() - INTERVAL 2 DAY
      )
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.user_id = u.id AND DATE(m.created_at) = CURDATE()
      )
    ORDER BY o.amount_total DESC
    `
  )

  return rows.map((row) => ({
    orderId: Number(row.orderId),
    orderName: row.orderName ?? null,
    userId: Number(row.userId),
    lineUserId: row.lineUserId ?? null,
    salespersonName: row.salespersonName ?? null,
    orderDate: new Date(row.orderDate),
    amount: Number(row.amount),
  }))
}

/** Drafts one queue row per candidate. INSERT IGNORE leans on uniq_order_round. */
export async function generateChaseDrafts(): Promise<{
  drafted: number
  byRound: Record<number, number>
}> {
  const byRound: Record<number, number> = {}
  let drafted = 0

  for (const round of CHASE_ROUNDS) {
    const candidates = await findChaseCandidates(round)
    byRound[round] = 0

    for (const candidate of candidates) {
      const affected = await prisma.$executeRaw`
        INSERT IGNORE INTO payment_chase_queue
          (order_id, order_name, chase_round, user_id, line_user_id,
           salesperson_name, order_date, amount, message, status)
        VALUES (${candidate.orderId}, ${candidate.orderName}, ${round}, ${candidate.userId},
                ${candidate.lineUserId}, ${candidate.salespersonName}, ${candidate.orderDate},
                ${candidate.amount}, ${composeChaseMessage(candidate)}, 'draft')
      `
      if (affected > 0) {
        byRound[round]++
        drafted++
      }
    }
  }

  return { drafted, byRound }
}
