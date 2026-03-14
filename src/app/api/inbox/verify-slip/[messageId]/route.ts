import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getSlipVerificationByMessageId } from '@/lib/slip-verification'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { messageId } = await params
    const parsedMessageId = Number(messageId)
    if (!Number.isFinite(parsedMessageId)) {
      return NextResponse.json({ error: 'Invalid messageId' }, { status: 400 })
    }

    const data = await getSlipVerificationByMessageId(parsedMessageId)
    if (!data) {
      return NextResponse.json({ success: true, data: null }, { status: 200 })
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('[verify-slip] GET error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
