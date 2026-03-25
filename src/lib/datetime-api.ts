/**
 * Serialize instants for JSON APIs as RFC 3339 UTC (`...Z`).
 * Do not append a fake `+07:00` to a UTC string — it breaks `Date` parsing in browsers.
 */
export function toUtcIsoString(date: Date | string | null | undefined): string | null {
  if (date == null) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  try {
    return d.toISOString()
  } catch {
    return null
  }
}

/**
 * Workaround for dual-write timezone mismatch.
 * - Next.js (outgoing) writes correct UTC dates.
 * - PHP (incoming) writes naive DATETIME using MySQL System TZ (UTC+8).
 *   A message sent at 10:00 BKK is stored as "11:00" in MySQL.
 *   Prisma reads "11:00" and thinks it is "11:00Z" (UTC).
 *   When the browser parses "11:00Z", it adds 7h -> "18:00 BKK" (Wrong!).
 * 
 * To fix: For incoming messages created by PHP, we subtract 8 hours 
 * to convert the wrongly interpreted "11:00Z" back to the correct UTC "03:00Z".
 */
export function adjustIncomingMessageDate(date: Date | string | null | undefined, direction?: string | null): Date | null {
  if (date == null) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  
  // Only apply shift to 'incoming' messages (which we assume PHP created)
  if (direction === 'incoming') {
    // Subtract 8 hours
    return new Date(d.getTime() - (8 * 60 * 60 * 1000))
  }
  
  return d
}

export function toUtcIsoStringAdjusted(date: Date | string | null | undefined, direction?: string | null): string | null {
  const adjusted = adjustIncomingMessageDate(date, direction)
  return toUtcIsoString(adjusted)
}
