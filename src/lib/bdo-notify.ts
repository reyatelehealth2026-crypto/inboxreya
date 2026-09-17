import prisma from '@/lib/prisma'

/**
 * Automatic BDO payment notifications.
 *
 * A rep used to open the BDO list and click send on each new row. Measured over
 * 14 days they did it fast — 88% within three minutes of the BDO appearing —
 * but they only reached 618 of 902 reachable BDOs, because the rows arrive in a
 * burst: 79% of a day's BDOs land between 15:00 and 17:00. The 284 they never
 * got to are customers who were simply never told what to pay.
 *
 * This sweep does the same click on a two-minute poll, which lands inside the
 * window the reps already hit by hand. It reuses the PHP action the button
 * calls, so the customer receives the identical Flex message.
 *
 * Prisma, not the mysql2 pool in @/lib/db — that pool has no DB_* env on prod
 * and silently falls back to a different, legacy database.
 */

/** Sent per sweep, and the gap between them, so a burst never floods LINE. */
export const NOTIFY_BATCH = 20
export const NOTIFY_GAP_MS = 1500

/**
 * How fresh a BDO must be to notify automatically.
 *
 * This is the backlog guard, and it is the reason the first run does not blast
 * every customer with an old unpaid BDO. Anything older is left for a person to
 * decide on — an unnotified BDO from last week is a conversation, not a ping.
 */
export const FRESH_WINDOW_MINUTES = 120

/**
 * `odoo_bdo_orders.created_at` is written in Thailand local time while the
 * server's NOW() is UTC — the two differ by seven hours. Comparing them
 * directly silently matches nothing (or everything). Every comparison against
 * that column goes through this expression.
 */
const NOW_IN_BDO_TZ = 'DATE_ADD(NOW(), INTERVAL 7 HOUR)'

export interface BdoCandidate {
  bdoId: number
  bdoName: string | null
  partnerId: number | null
  lineUserId: string | null
  amountTotal: number
}

/**
 * New BDOs that still owe the customer a payment notification.
 *
 * A BDO qualifies only when it is unpaid, reachable on LINE, recent, and has no
 * row in bdo_notify_log. The log covers our own sends; `messages` covers the
 * ones a rep sent by hand, including everything from before this existed.
 */
export async function findBdoCandidates(limit = NOTIFY_BATCH): Promise<BdoCandidate[]> {
  const rows = await prisma.$queryRawUnsafe<
    Array<{
      bdoId: number
      bdoName: string | null
      partnerId: number | null
      lineUserId: string | null
      amountTotal: unknown
    }>
  >(
    `
    SELECT b.bdo_id       AS bdoId,
           b.bdo_name     AS bdoName,
           b.partner_id   AS partnerId,
           b.line_user_id AS lineUserId,
           b.amount_total AS amountTotal
    FROM odoo_bdo_orders b
    WHERE b.payment_status = 'pending'
      AND b.line_user_id IS NOT NULL
      AND b.bdo_name IS NOT NULL
      AND b.amount_total > 0
      AND b.created_at >= ${NOW_IN_BDO_TZ} - INTERVAL ${FRESH_WINDOW_MINUTES} MINUTE
      AND NOT EXISTS (
        SELECT 1 FROM bdo_notify_log l WHERE l.bdo_id = b.bdo_id
      )
      AND NOT EXISTS (
        SELECT 1 FROM messages m
        WHERE m.sent_by = 'system:bdo_notification'
          AND m.created_at >= NOW() - INTERVAL 1 DAY
          AND m.content LIKE CONCAT('%', b.bdo_name, '%')
      )
    ORDER BY b.created_at ASC
    LIMIT ${Math.max(1, Math.floor(limit))}
    `
  )

  return rows.map((row) => ({
    bdoId: Number(row.bdoId),
    bdoName: row.bdoName ?? null,
    partnerId: row.partnerId === null ? null : Number(row.partnerId),
    lineUserId: row.lineUserId ?? null,
    amountTotal: Number(row.amountTotal),
  }))
}

/**
 * Fires the same PHP action the rep's button posts, so the customer gets the
 * identical Flex. Called server-to-server rather than through our own
 * /api/odoo-dashboard route, which would need a session this sweep cannot hold.
 */
export async function sendBdoNotification(
  candidate: BdoCandidate
): Promise<{ success: boolean; error?: string }> {
  const phpBase =
    process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 35_000)

  try {
    const response = await fetch(`${phpBase}/api/odoo-dashboard-api.php`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
        'User-Agent': 'InboxReya-BdoNotify/1.0',
      },
      body: JSON.stringify({
        action: 'send_bdo_payment_notification',
        bdo_id: candidate.bdoId,
        partner_id: candidate.partnerId ?? '',
      }),
      cache: 'no-store',
      signal: controller.signal,
    })

    const raw = await response.text()
    if (!raw.trim()) return { success: false, error: 'PHP returned an empty body' }

    const json = JSON.parse(raw)
    return json?.success
      ? { success: true }
      : { success: false, error: String(json?.error ?? 'send rejected') }
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : 'send failed' }
  } finally {
    clearTimeout(timeout)
  }
}

/** Records the outcome; the unique key on bdo_id keeps a BDO to one decision. */
export async function recordOutcome(
  candidate: BdoCandidate,
  status: 'sent' | 'failed' | 'skipped',
  reason?: string
): Promise<void> {
  await prisma.$executeRaw`
    INSERT INTO bdo_notify_log
      (bdo_id, bdo_name, partner_id, line_user_id, amount_total, status, reason)
    VALUES (${candidate.bdoId}, ${candidate.bdoName}, ${candidate.partnerId},
            ${candidate.lineUserId}, ${candidate.amountTotal}, ${status},
            ${reason ? reason.slice(0, 255) : null})
    ON DUPLICATE KEY UPDATE status = VALUES(status), reason = VALUES(reason)
  `
}
