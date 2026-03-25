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
