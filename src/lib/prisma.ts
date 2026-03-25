import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/**
 * DATETIME NORMALIZATION HACK FOR PRISMA + MYSQL
 * 
 * Context:
 * - Odoo PHP uses Naive DATETIME columns and stores Asia/Bangkok (+07:00) local time.
 * - Prisma Rust Engine ALWAYS sends UTC strings when saving Date objects, and 
 *   ALWAYS assumes retrieved DATETIME strings are UTC.
 * 
 * Problem:
 * If Next.js saves a message at 10:00 BKK (03:00 UTC), Prisma stores "03:00".
 * Odoo PHP reads "03:00" and displays it wrong.
 * If Odoo PHP saves a message at 10:00 BKK, it stores "10:00".
 * Prisma reads "10:00", assumes it is "10:00 UTC", and Next.js shows 17:00 BKK.
 * 
 * Solution:
 * 1. On WRITE (create/update): Intercept all Date objects and ADD 7 hours 
 *    before passing them to Prisma. So "03:00 UTC" becomes "10:00 UTC", which 
 *    Prisma writes as "10:00". Odoo PHP reads "10:00" correctly!
 * 2. On READ (findMany/etc): Intercept all returned Date objects and SUBTRACT 7 hours.
 *    Prisma reads "10:00" and returns "10:00 UTC". We subtract 7h -> "03:00 UTC".
 *    Next.js sends "03:00 UTC" to browser, browser adds 7h -> "10:00 BKK" correctly!
 */

const OFFSET_MS = 7 * 60 * 60 * 1000 // 7 hours for Asia/Bangkok

function shiftDatesForward(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date && !isNaN(obj.getTime())) {
    return new Date(obj.getTime() + OFFSET_MS)
  }
  if (Array.isArray(obj)) {
    return obj.map(shiftDatesForward)
  }
  if (typeof obj === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = shiftDatesForward(v)
    }
    return out
  }
  return obj
}

function shiftDatesBackward(obj: any): any {
  if (obj === null || obj === undefined) return obj
  if (obj instanceof Date && !isNaN(obj.getTime())) {
    return new Date(obj.getTime() - OFFSET_MS)
  }
  if (Array.isArray(obj)) {
    return obj.map(shiftDatesBackward)
  }
  if (typeof obj === 'object') {
    const out: any = {}
    for (const [k, v] of Object.entries(obj)) {
      out[k] = shiftDatesBackward(v)
    }
    return out
  }
  return obj
}

function createPrismaClient(): PrismaClient {
  const client = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
  })

  return client.$extends({
    query: {
      $allModels: {
        async $allOperations({ args, query }) {
          // 1. Shift ANY Date in the query arguments FORWARD (+7h)
          // This includes `data`, `where`, `create`, etc.
          // So "03:00 UTC" -> "10:00 UTC" which Prisma writes as "10:00".
          const shiftedArgs = shiftDatesForward(args)

          // 2. Execute query
          const result = await query(shiftedArgs)

          // 3. Shift ANY returned Date BACKWARD (-7h)
          // Prisma reads "10:00" -> "10:00 UTC" -> we shift to "03:00 UTC"
          return shiftDatesBackward(result)
        },
      },
    },
  }) as unknown as PrismaClient
}

export const prisma =
  globalForPrisma.prisma ??
  createPrismaClient()

// Always cache globally — critical for serverless (Vercel) to prevent connection pool exhaustion (P2024)
globalForPrisma.prisma = prisma

export default prisma
