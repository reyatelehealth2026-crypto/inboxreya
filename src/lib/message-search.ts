import { Prisma } from '@prisma/client'
import prisma from './prisma'
import { cacheQuery } from './redis'

/** One-character terms match half the table and tell staff nothing. */
const MIN_TERM_LENGTH = 2
const CACHE_SECONDS = 60
// ponytail: `LIKE '%term%'` is a full scan of messages (210k rows / 2.8 s on
// prod 2026-09-17) — MariaDB FULLTEXT cannot tokenise Thai. Fine while the
// table is this size and results are cached; past ~1M rows move message search
// to Mroonga/ngram or an external index.
const MAX_USERS = 5000

const inFlight = new Map<string, Promise<number[]>>()

/**
 * Ids of users who have a message containing `term`.
 *
 * The conversation list used to OR `messages.content LIKE` straight into its
 * users query. That ran the scan twice per request (rows + count), again on
 * every 15 s poll, on each retry and on every typing pause — 2,169 search
 * requests in one morning, 489 of them 5xx, enough to drain the Prisma pool.
 * Here the scan runs once, is shared by concurrent callers, and is remembered
 * for a minute; the list then filters on `id IN (…)`.
 */
export async function userIdsWithMessageContaining(rawTerm: string): Promise<number[]> {
  const term = rawTerm.trim().toLowerCase()
  if (term.length < MIN_TERM_LENGTH) return []

  const running = inFlight.get(term)
  if (running) return running

  const scan = cacheQuery(
    `msgsearch:${term}`,
    async () => {
      // Same wildcard escaping Prisma's `contains` applies.
      const pattern = `%${term.replace(/[\\%_]/g, '\\$&')}%`
      const rows = await prisma.$queryRaw<{ userId: number | bigint }[]>`
        SELECT DISTINCT user_id AS userId FROM messages
        WHERE content LIKE ${pattern} AND user_id IS NOT NULL
        LIMIT ${Prisma.raw(String(MAX_USERS))}`
      return rows.map((row) => Number(row.userId))
    },
    CACHE_SECONDS,
  ).finally(() => inFlight.delete(term))

  inFlight.set(term, scan)
  return scan
}
