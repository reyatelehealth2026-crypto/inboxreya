import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { verifySlip } from '@/lib/slip-verify'

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip image via the slip-c API (https://slip-c.oiio.download/#docs),
 * mapping the result back to the existing frontend contract. Proxied server-side.
 *
 * The verification itself lives in `@/lib/slip-verify` because the pre-scan cron
 * runs exactly the same logic ahead of time.
 *
 * Body (JSON):
 *   imageUrl  – public URL of the slip image (required)
 *   amount    – expected transfer amount (optional; only picks the cheap QR path,
 *               a mismatch just loses the race to OCR)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { imageUrl, amount } = body

    if (!imageUrl) {
      return NextResponse.json({ error: 'imageUrl is required' }, { status: 400 })
    }

    // Always 200: a slip that fails to verify (bad QR, not in the bank system
    // yet, OCR timeout) is a normal outcome the frontend renders as a message,
    // not a transport error.
    const result = await verifySlip({ imageUrl, amount })
    return NextResponse.json(result)
  } catch (error) {
    console.error('[verify-slip] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
