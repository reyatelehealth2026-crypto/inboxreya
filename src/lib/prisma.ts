import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * MySQL DATETIME is naive (no TZ info). mysql2 needs a session timezone so it
 * can convert between JS Date (UTC internally) and the naive value stored in MySQL.
 *
 * The production MySQL server runs with SYSTEM timezone = UTC+8 (typical
 * Singapore / HK VPS). Both PHP (via date_default_timezone_set) and Prisma
 * write naive datetimes in that system timezone, so mysql2 must read them
 * back with the same offset.
 *
 * Priority:
 *   1. Explicit `?timezone=` already on DATABASE_URL  → use as-is
 *   2. DATABASE_MYSQL_TIMEZONE env var                 → append to URL
 *   3. Fallback "+08:00" (matches production MySQL SYSTEM tz)
 */
function withMysqlSessionTimezone(url: string | undefined): string | undefined {
  if (!url || !/^mysql/i.test(url)) return url
  if (/[?&]timezone=/.test(url)) return url
  const tz = process.env.DATABASE_MYSQL_TIMEZONE?.trim() || '+08:00'
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}timezone=${encodeURIComponent(tz)}`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: withMysqlSessionTimezone(process.env.DATABASE_URL),
      },
    },
  })

// Always cache globally — critical for serverless (Vercel) to prevent connection pool exhaustion (P2024)
globalForPrisma.prisma = prisma

export default prisma
