import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

/**
 * GET  /api/inbox/payment-chase   — the pending chase queue, newest bills first
 * POST /api/inbox/payment-chase   — approve selected rows: opens a run and hands
 *                                   them to the drain cron
 *
 * Prisma, not the mysql2 pool in @/lib/db — see the note in @/lib/payment-chase.
 */

/**
 * MySQL UNSIGNED INT and COUNT() come back from Prisma raw queries as JS BigInt,
 * which JSON.stringify refuses outright — the whole response 500s on a single
 * unconverted column. Normalise before the row ever reaches NextResponse.json.
 */
function serialisable(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(row)) {
    out[key] = typeof value === 'bigint' ? Number(value) : value
  }
  return out
}

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const searchParams = new URL(request.url).searchParams
  const salesperson = searchParams.get('salesperson')
  const minAmount = Number(searchParams.get('minAmount') || 0)
  const round = Number(searchParams.get('round') || 0)

  const filters: Prisma.Sql[] = [Prisma.sql`q.status = 'draft'`]
  if (salesperson) filters.push(Prisma.sql`q.salesperson_name = ${salesperson}`)
  if (Number.isFinite(minAmount) && minAmount > 0) filters.push(Prisma.sql`q.amount >= ${minAmount}`)
  if (Number.isFinite(round) && round > 0) filters.push(Prisma.sql`q.chase_round = ${round}`)

  try {
    const items = await prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
      SELECT q.id, q.order_id, q.order_name, q.chase_round, q.user_id,
             q.salesperson_name, q.order_date, q.amount, q.message,
             u.display_name AS customer_name
      FROM payment_chase_queue q
      LEFT JOIN users u ON u.id = q.user_id
      WHERE ${Prisma.join(filters, ' AND ')}
      ORDER BY q.chase_round DESC, q.amount DESC
      LIMIT 500
    `)

    const salespeople = await prisma.$queryRaw<Array<{ name: string | null; n: bigint }>>(Prisma.sql`
      SELECT salesperson_name AS name, COUNT(*) AS n
      FROM payment_chase_queue WHERE status = 'draft'
      GROUP BY salesperson_name ORDER BY n DESC
    `)

    return NextResponse.json({
      success: true,
      items: items.map(serialisable),
      salespeople: salespeople.map((row) => ({ name: row.name, n: Number(row.n) })),
      totalAmount: items.reduce((sum, row) => sum + Number(row.amount), 0),
    })
  } catch (error) {
    console.error('[payment-chase] list failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to load queue' }, { status: 500 })
  }
}

const approveSchema = z.object({
  queueIds: z.array(z.number().int().positive()).min(1).max(1000),
})

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  let body: z.infer<typeof approveSchema>
  try {
    body = approveSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const createdBy = user.id ? String(user.id) : null

  try {
    const result = await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO payment_chase_runs (created_by, status, total)
        VALUES (${createdBy}, 'running', 0)
      `
      const [row] = await tx.$queryRaw<Array<{ runId: bigint }>>`
        SELECT LAST_INSERT_ID() AS runId
      `
      const runId = Number(row.runId)

      // Only rows still in 'draft' move — a row someone else already approved
      // stays with its original run instead of being sent twice.
      const queued = await tx.$executeRaw`
        UPDATE payment_chase_queue SET run_id = ${runId}, status = 'queued'
        WHERE id IN (${Prisma.join(body.queueIds)}) AND status = 'draft'
      `

      // Rolls the empty run back with it.
      if (queued === 0) throw new Error('NO_PENDING_ROWS')

      await tx.$executeRaw`UPDATE payment_chase_runs SET total = ${queued} WHERE id = ${runId}`
      return { runId, queued }
    })

    return NextResponse.json({ success: true, ...result })
  } catch (error) {
    if (error instanceof Error && error.message === 'NO_PENDING_ROWS') {
      return NextResponse.json(
        { success: false, error: 'Selected rows are no longer pending' },
        { status: 409 }
      )
    }
    console.error('[payment-chase] approve failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to queue messages' }, { status: 500 })
  }
}
