import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** MySQL DATETIME without TZ: align session with Thailand (+07) so reads match PHP/MySQL `SET time_zone = '+07:00'`. */
function withMysqlTimezoneBangkok(url: string | undefined): string | undefined {
  if (!url || !/^mysql/i.test(url)) return url
  if (/[?&]timezone=/.test(url)) return url
  const joiner = url.includes('?') ? '&' : '?'
  return `${url}${joiner}timezone=${encodeURIComponent('+07:00')}`
}

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: withMysqlTimezoneBangkok(process.env.DATABASE_URL),
      },
    },
  })

// Always cache globally — critical for serverless (Vercel) to prevent connection pool exhaustion (P2024)
globalForPrisma.prisma = prisma

export default prisma
