import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * MySQL DATETIME has no TZ. mysql2 must use the same session TZ as the writer (PHP).
 * If PHP uses `date_default_timezone_set('Asia/Bangkok')` + `SET time_zone '+07:00'`, use +07:00.
 * If PHP host runs in +08 (common Singapore/HK VPS), set DATABASE_MYSQL_TIMEZONE=+08:00
 * or add `?timezone=%2B08%3A00` to DATABASE_URL — otherwise naive "08:51" may be read as UTC
 * → UI shows 15:51 instead of 07:51 Bangkok for the same moment.
 */
function withMysqlSessionTimezone(url: string | undefined): string | undefined {
  if (!url || !/^mysql/i.test(url)) return url
  if (/[?&]timezone=/.test(url)) return url
  const tz = process.env.DATABASE_MYSQL_TIMEZONE?.trim()
  if (!tz) return url
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
