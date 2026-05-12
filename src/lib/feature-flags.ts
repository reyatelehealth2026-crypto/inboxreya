/**
 * Feature-flag lookups backed by the `FeatureFlag` Prisma model. Fail-closed:
 * missing rows, disabled rows, and DB errors all resolve to `false`. Rows are
 * cached in-memory for 30s to keep hot paths cheap.
 */
import { prisma } from './prisma'
import { logger } from './logger'

export interface FlagUser {
  id: string
  role?: string | null
}

type FlagRow = {
  enabled: boolean
  enabledForRoles: string | null
  enabledForUserIds: string | null
}

const CACHE_TTL_MS = 30_000
const cache = new Map<string, { row: FlagRow | null; expires: number }>()

function splitCsv(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((s) => s.trim()).filter(Boolean)
}

async function getFlagRow(key: string): Promise<FlagRow | null> {
  const cached = cache.get(key)
  const now = Date.now()
  if (cached && cached.expires > now) return cached.row
  try {
    const row = await prisma.featureFlag.findUnique({
      where: { key },
      select: { enabled: true, enabledForRoles: true, enabledForUserIds: true },
    })
    cache.set(key, { row, expires: now + CACHE_TTL_MS })
    return row
  } catch (err) {
    logger.warn('feature-flag lookup failed', { scope: 'feature-flags', key, err: String(err) })
    return null
  }
}

export async function isFeatureEnabled(key: string, user: FlagUser): Promise<boolean> {
  const row = await getFlagRow(key)
  if (!row) return false
  const canaryIds = splitCsv(row.enabledForUserIds)
  if (canaryIds.includes(user.id)) return true
  if (!row.enabled) return false
  const roles = splitCsv(row.enabledForRoles)
  if (roles.length === 0) return true
  return user.role ? roles.includes(user.role) : false
}

export async function assertFeatureEnabled(key: string, user: FlagUser): Promise<void> {
  const ok = await isFeatureEnabled(key, user)
  if (ok) return
  const err = new Error('feature not enabled: ' + key) as Error & { statusCode?: number }
  err.statusCode = 404
  throw err
}

export function __resetFeatureFlagCache(): void {
  cache.clear()
}
