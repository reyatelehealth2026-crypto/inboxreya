import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

/**
 * GET   /api/inbox/payment-chase/runs/[id]  — progress, polled by the UI
 * PATCH /api/inbox/payment-chase/runs/[id]  — pause | resume | stop
 *
 * Stop leaves already-sent rows alone and returns the untouched ones to the
 * queue, so a halted run can be re-approved later without redrafting.
 *
 * Prisma, not the mysql2 pool in @/lib/db — see the note in @/lib/payment-chase.
 */

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const runId = Number((await params).id)
  if (!Number.isFinite(runId)) {
    return NextResponse.json({ success: false, error: 'Invalid run id' }, { status: 400 })
  }

  const rows = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT r.id, r.status, r.total, r.sent, r.failed, r.created_at, r.finished_at,
           (SELECT COUNT(*) FROM payment_chase_queue q
            WHERE q.run_id = r.id AND q.status = 'queued') AS remaining
    FROM payment_chase_runs r WHERE r.id = ${runId}
  `
  const run = rows[0]
  if (!run) {
    return NextResponse.json({ success: false, error: 'Run not found' }, { status: 404 })
  }

  const failures = await prisma.$queryRaw<Array<Record<string, unknown>>>`
    SELECT id, order_name, salesperson_name, error FROM payment_chase_queue
    WHERE run_id = ${runId} AND status = 'failed' LIMIT 50
  `

  // MySQL UNSIGNED INT and COUNT() arrive as JS BigInt, which JSON.stringify
  // refuses outright — one unconverted column 500s the whole response.
  const serialisable = (row: Record<string, unknown>) =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        typeof value === 'bigint' ? Number(value) : value,
      ])
    )

  return NextResponse.json({
    success: true,
    run: serialisable(run),
    failures: failures.map(serialisable),
  })
}

const actionSchema = z.object({ action: z.enum(['pause', 'resume', 'stop']) })

const NEXT_STATUS = { pause: 'paused', resume: 'running', stop: 'stopped' } as const

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const runId = Number((await params).id)
  if (!Number.isFinite(runId)) {
    return NextResponse.json({ success: false, error: 'Invalid run id' }, { status: 400 })
  }

  let body: z.infer<typeof actionSchema>
  try {
    body = actionSchema.parse(await request.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid action' }, { status: 400 })
  }

  const nextStatus = NEXT_STATUS[body.action]

  // A finished run stays finished — resuming one would send nothing but would
  // make the UI claim it is live again.
  const updated =
    body.action === 'stop'
      ? await prisma.$executeRaw`
          UPDATE payment_chase_runs SET status = ${nextStatus}, finished_at = NOW()
          WHERE id = ${runId} AND status IN ('running', 'paused')
        `
      : await prisma.$executeRaw`
          UPDATE payment_chase_runs SET status = ${nextStatus}
          WHERE id = ${runId} AND status IN ('running', 'paused')
        `

  if (updated === 0) {
    return NextResponse.json(
      { success: false, error: 'Run is not pausable — it already finished or was stopped' },
      { status: 409 }
    )
  }

  if (body.action === 'stop') {
    await prisma.$executeRaw`
      UPDATE payment_chase_queue SET status = 'draft', run_id = NULL
      WHERE run_id = ${runId} AND status = 'queued'
    `
  }

  return NextResponse.json({ success: true, status: nextStatus })
}
