import { NextRequest, NextResponse } from 'next/server'
import { generateChaseDrafts } from '@/lib/payment-chase'

/**
 * GET /api/cron/payment-chase
 *
 * Daily sweep that drafts the "ไล่ยอดชำระ" queue. Drafts only — nothing is sent
 * until a rep approves rows in /inbox/payment-chase.
 *
 * Scheduled 09:00 ICT from the host crontab (see scripts/payment-chase-cron.sh).
 */
export const maxDuration = 60

export async function GET(request: NextRequest) {
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && request.headers.get('authorization') !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await generateChaseDrafts()
    console.log(`[payment-chase] drafted ${result.drafted}`, result.byRound)
    return NextResponse.json({ success: true, ...result, timestamp: new Date().toISOString() })
  } catch (error) {
    console.error('[payment-chase] generate failed:', error)
    return NextResponse.json({ success: false, error: 'Failed to generate drafts' }, { status: 500 })
  }
}
