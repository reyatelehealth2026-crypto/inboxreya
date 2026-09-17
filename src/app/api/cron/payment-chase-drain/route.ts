import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { sendLineMessage } from '@/lib/php-bridge'
import { DRAIN_BATCH, DRAIN_GAP_MS } from '@/lib/payment-chase'

/**
 * GET /api/cron/payment-chase-drain
 *
 * Sends approved chase messages slowly — DRAIN_BATCH per tick with a gap
 * between each, so a 200-message pass spreads over several minutes instead of
 * hitting LINE's rate limit in one burst.
 *
 * The run's status is re-read before every single send, which is what makes
 * pause and stop take effect within a couple of seconds rather than at the end
 * of the batch. Called every minute from the host crontab.
 */
export const maxDuration = 60

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

async function currentStatus(runId: number): Promise<string | null> {
  const rows = await prisma.$queryRaw<Array<{ status: string }>>`
    SELECT status FROM payment_chase_runs WHERE id = ${runId}
  `
  return rows[0]?.status ?? null
}

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // One run at a time: the oldest still going. Keeps ordering predictable and
    // the send rate global rather than per-run.
    const runs = await prisma.$queryRaw<Array<{ id: number; created_by: string | null }>>`
      SELECT id, created_by FROM payment_chase_runs
      WHERE status = 'running' ORDER BY id ASC LIMIT 1
    `
    const run = runs[0]
    if (!run) {
      return NextResponse.json({ success: true, message: 'No running chase', sent: 0 })
    }

    const runId = Number(run.id)
    const pending = await prisma.$queryRaw<
      Array<{ id: number; user_id: number; message: string }>
    >`
      SELECT id, user_id, message FROM payment_chase_queue
      WHERE run_id = ${runId} AND status = 'queued'
      ORDER BY id ASC LIMIT ${DRAIN_BATCH}
    `

    if (pending.length === 0) {
      await prisma.$executeRaw`
        UPDATE payment_chase_runs SET status = 'done', finished_at = NOW() WHERE id = ${runId}
      `
      return NextResponse.json({ success: true, runId, message: 'Run complete', sent: 0 })
    }

    let sent = 0
    let failed = 0
    let haltedBy: string | null = null

    for (const row of pending) {
      const status = await currentStatus(runId)
      if (status !== 'running') {
        haltedBy = status
        break
      }

      const result = await sendLineMessage({
        userId: String(row.user_id),
        message: String(row.message),
        sentBy: run.created_by ? String(run.created_by) : null,
      })

      const didFail = result?.success === false

      if (didFail) {
        failed++
        await prisma.$executeRaw`
          UPDATE payment_chase_queue SET status = 'failed',
                 error = ${String(result?.error ?? 'send failed').slice(0, 500)}
          WHERE id = ${row.id}
        `
      } else {
        sent++
        await prisma.$executeRaw`
          UPDATE payment_chase_queue SET status = 'sent', sent_at = NOW(), error = NULL
          WHERE id = ${row.id}
        `
      }

      await prisma.$executeRaw`
        UPDATE payment_chase_runs
        SET sent = sent + ${didFail ? 0 : 1}, failed = failed + ${didFail ? 1 : 0}
        WHERE id = ${runId}
      `

      await sleep(DRAIN_GAP_MS)
    }

    console.log(`[payment-chase-drain] run ${runId}: sent ${sent}, failed ${failed}`)
    return NextResponse.json({ success: true, runId, sent, failed, haltedBy })
  } catch (error) {
    console.error('[payment-chase-drain] failed:', error)
    return NextResponse.json({ success: false, error: 'Drain failed' }, { status: 500 })
  }
}
