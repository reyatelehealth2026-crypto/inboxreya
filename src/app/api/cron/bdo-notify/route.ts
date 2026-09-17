import { NextRequest, NextResponse } from 'next/server'
import {
  findBdoCandidates,
  sendBdoNotification,
  recordOutcome,
  NOTIFY_BATCH,
  NOTIFY_GAP_MS,
  FRESH_WINDOW_MINUTES,
} from '@/lib/bdo-notify'

/**
 * GET /api/cron/bdo-notify
 *
 * Sends the payment notification for BDOs that arrived in the last couple of
 * hours and have not been told to the customer yet — the click a rep used to
 * make on each row. Runs every two minutes from the host crontab.
 *
 * Sends immediately rather than queueing for approval: the reps already
 * approved these by reflex within a minute, and a queue would reintroduce
 * exactly the bottleneck that leaves 31% of BDOs unnotified. The brakes are the
 * freshness window in @/lib/bdo-notify (nothing old is ever blasted), the
 * unique key on bdo_notify_log (one decision per BDO), and BDO_NOTIFY_DISABLED.
 */
export const maxDuration = 60

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  // Kill switch: set BDO_NOTIFY_DISABLED=1 on the container to stop sending
  // without touching the crontab or shipping an image.
  if (process.env.BDO_NOTIFY_DISABLED === '1') {
    return NextResponse.json({ success: true, disabled: true, sent: 0 })
  }

  try {
    const candidates = await findBdoCandidates(NOTIFY_BATCH)
    if (candidates.length === 0) {
      return NextResponse.json({ success: true, message: 'No new BDOs', sent: 0 })
    }

    let sent = 0
    let failed = 0

    for (const candidate of candidates) {
      const result = await sendBdoNotification(candidate)

      if (result.success) {
        sent++
        await recordOutcome(candidate, 'sent')
      } else {
        failed++
        // Logged as failed, not skipped: the unique key stops a retry loop, and
        // a person can see which BDOs the customer never heard about.
        await recordOutcome(candidate, 'failed', result.error)
      }

      await sleep(NOTIFY_GAP_MS)
    }

    console.log(`[bdo-notify] sent ${sent}, failed ${failed} (window ${FRESH_WINDOW_MINUTES}m)`)
    return NextResponse.json({ success: true, sent, failed, considered: candidates.length })
  } catch (error) {
    console.error('[bdo-notify] sweep failed:', error)
    return NextResponse.json({ success: false, error: 'Sweep failed' }, { status: 500 })
  }
}
