/**
 * The record left on a customer's chat image once its slip has been verified and
 * attached, so reps can see at a glance which ones are already done.
 */
export interface SlipMark {
  verified: true
  bdoId: number | null
  /**
   * Set instead of `bdoId` for customers who pay before delivery: their slip is
   * filed against an invoice, and without recording which one the report cannot
   * tell those apart from a slip nobody has matched yet.
   */
  invoiceId: number | null
  bdoName: string | null
  amount: number | null
  ref: string | null
  points: number
  at: string
}

/**
 * Add the slip mark to a message's metadata without losing what is already
 * there. `Message.metadata` is one shared JSON column: quotedMessageId,
 * lineMessageId and flex payloads all live in it, and the chat view stops
 * rendering quotes and flex bubbles correctly if they are dropped.
 *
 * Kept out of the route so it can be tested without pulling in next-auth.
 */
export function mergeSlipMetadata(existing: string | null, slip: SlipMark): string {
  let base: Record<string, unknown> = {}

  if (existing) {
    try {
      const parsed = JSON.parse(existing)
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        base = parsed as Record<string, unknown>
      }
    } catch {
      // Not JSON we can merge into — park it under its own key rather than
      // overwriting whatever the sender put there.
      return JSON.stringify({ _raw: existing, slip })
    }
  }

  return JSON.stringify({ ...base, slip })
}
