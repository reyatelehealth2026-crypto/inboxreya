const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000

export function toBroadcastCreatedAtIso(value: Date | string | null | undefined) {
  if (!value) return null
  const date = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(date.getTime())) return null
  return new Date(date.getTime() + BANGKOK_OFFSET_MS).toISOString()
}
