import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * MySQL DATETIME is naive (no TZ info). mysql2 needs a session timezone so it
 * can convert between JS Date (UTC internally) and the naive value stored in MySQL.
 *
 * PHP uses SET time_zone = '+07:00' when writing, so Prisma/mysql2 must use the
 * same offset to correctly interpret the naive DATETIME values stored in MySQL.
 *
 * We always force-set timezone to DATABASE_MYSQL_TIMEZONE (default +07:00),
 * replacing any existing timezone param in the URL to ensure correctness.
 */
function withMysqlSessionTimezone(url: string | undefined): string | undefined {
  if (!url || !/^mysql/i.test(url)) return url
  const tz = process.env.DATABASE_MYSQL_TIMEZONE?.trim() || '+07:00'
  // Remove any existing timezone param, then append the correct one
  const cleaned = url.replace(/([?&])timezone=[^&]*/g, '$1').replace(/[?&]$/, '')
  const joiner = cleaned.includes('?') ? '&' : '?'
  return `${cleaned}${joiner}timezone=${encodeURIComponent(tz)}`
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
