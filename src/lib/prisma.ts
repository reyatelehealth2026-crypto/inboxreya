import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * MySQL DATETIME is naive (no TZ info).
 *
 * PHP uses SET time_zone = '+07:00' when writing, so naive DATETIME values
 * stored in MySQL represent Bangkok local time (+07:00).
 *
 * Prisma/mysql2 reads naive DATETIME as UTC (session_tz = SYSTEM = UTC+8 on
 * this server, but mysql2 ignores session_tz and treats the raw bytes as UTC).
 * Result: a value stored as "10:56" comes back as Date("10:56Z") — 7 hours ahead.
 *
 * Fix: use $extends to shift every Date in query results back by the stored
 * timezone offset (+07:00 = +7h), converting the wrongly-UTC-labeled value
 * to the correct UTC instant.
 *
 * Example: stored "10:56" (Bangkok) → Prisma returns Date("10:56Z") →
 *          we subtract 7h → Date("03:56Z") → frontend shows "10:56 AM Bangkok" ✓
 */

const STORED_TZ_OFFSET_MS = (() => {
  const raw = process.env.DATABASE_MYSQL_TIMEZONE?.trim() || '+07:00'
  // Parse "+07:00" or "-05:30" → offset in milliseconds
  const m = raw.match(/^([+-])(\d{2}):(\d{2})$/)
  if (!m) return 7 * 60 * 60 * 1000 // default +07:00
  const sign = m[1] === '+' ? 1 : -1
  return sign * (parseInt(m[2]) * 60 + parseInt(m[3])) * 60 * 1000
})()

function shiftDate(d: unknown): unknown {
  if (d instanceof Date && !isNaN(d.getTime())) {
    return new Date(d.getTime() - STORED_TZ_OFFSET_MS)
  }
  return d
}

function shiftDatesInResult(result: unknown): unknown {
  if (result instanceof Date) return shiftDate(result)
  if (Array.isArray(result)) return result.map(shiftDatesInResult)
  if (result !== null && typeof result === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(result as Record<string, unknown>)) {
      out[k] = shiftDatesInResult(v)
    }
    return out
  }
  return result
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  const extended = client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          const result = await query(args)
          return shiftDatesInResult(result)
        },
      },
    },
  })

  return extended as unknown as PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

// Always cache globally — critical for serverless (Vercel) to prevent connection pool exhaustion (P2024)
globalForPrisma.prisma = prisma

export default prisma
