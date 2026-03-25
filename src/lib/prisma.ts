import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * MySQL DATETIME is naive (no TZ info). mysql2 needs a session timezone so it
 * can convert between JS Date (UTC internally) and the naive value stored in MySQL.
 *
 * PHP uses date_default_timezone_set('Asia/Bangkok') and writes naive
 * DATETIME values in +07:00 (Bangkok time). Prisma/mysql2 must use the same
 * offset so it can correctly convert between JS Date (UTC) and the naive
 * value stored in MySQL.
 *
 * Priority:
 *   1. Explicit `?timezone=` already on DATABASE_URL  → use as-is
 *   2. DATABASE_MYSQL_TIMEZONE env var                 → append to URL
 *   3. Fallback "+07:00" (matches PHP date_default_timezone_set('Asia/Bangkok'))
 */
function withMysqlSessionTimezone(url: string | undefined): string | undefined {
  if (!url || !/^mysql/i.test(url)) return url
  if (/[?&]timezone=/.test(url)) return url
  const tz = process.env.DATABASE_MYSQL_TIMEZONE?.trim() || '+07:00'
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
