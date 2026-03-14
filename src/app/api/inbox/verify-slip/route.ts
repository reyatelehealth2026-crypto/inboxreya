import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { verifySlipMessage } from '@/lib/slip-verification'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, userId, expectedAmount, expectedDate, note } = body || {}

    if (!messageId || !userId) {
      return NextResponse.json({ error: 'messageId and userId are required' }, { status: 400 })
    }

    const parsedMessageId = Number(messageId)
    const parsedUserId = Number(userId)
    const parsedExpectedAmount =
      expectedAmount !== undefined && expectedAmount !== null && expectedAmount !== ''
        ? Number(expectedAmount)
        : null

    if (!Number.isFinite(parsedMessageId) || !Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'Invalid messageId or userId' }, { status: 400 })
    }

    if (parsedExpectedAmount !== null && !Number.isFinite(parsedExpectedAmount)) {
      return NextResponse.json({ error: 'Invalid expectedAmount' }, { status: 400 })
    }

    const data = await verifySlipMessage({
      messageId: parsedMessageId,
      userId: parsedUserId,
      expectedAmount: parsedExpectedAmount,
      expectedDate: expectedDate || null,
      note: note || null,
      verifiedBy: session.user.name || session.user.email || 'admin',
    })

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[verify-slip] POST error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
