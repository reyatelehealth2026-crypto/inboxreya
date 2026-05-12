/**
 * Resolves the active `AiPrompt` row for a given key (e.g. `ghost_draft`).
 * Highest `version` with `isActive = true` wins. Results are cached in-memory
 * for 60s so AI hot paths avoid a DB round-trip on every call.
 */
import { prisma } from '../prisma'

export interface ResolvedPrompt {
  key: string
  version: number
  body: string
  model: string
}

const CACHE_TTL_MS = 60_000
const cache = new Map<string, { value: ResolvedPrompt; expires: number }>()

export async function loadActivePrompt(key: string): Promise<ResolvedPrompt> {
  const now = Date.now()
  const cached = cache.get(key)
  if (cached && cached.expires > now) return cached.value

  const row = await prisma.aiPrompt.findFirst({
    where: { key, isActive: true },
    orderBy: { version: 'desc' },
    select: { key: true, version: true, body: true, model: true },
  })

  if (!row) {
    throw new Error('No active AI prompt for key=' + key)
  }

  const value: ResolvedPrompt = {
    key: row.key,
    version: row.version,
    body: row.body,
    model: row.model,
  }
  cache.set(key, { value, expires: now + CACHE_TTL_MS })
  return value
}

export function __resetPromptCache(): void {
  cache.clear()
}
