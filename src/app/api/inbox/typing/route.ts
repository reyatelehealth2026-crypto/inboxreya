import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { broadcastTyping } from '@/lib/pusher'

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { conversationId, isTyping } = await request.json()

    if (!conversationId) {
      return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })
    }

    await broadcastTyping(
      conversationId,
      {
        conversationId,
        userId: session.user.id || '',
        userName: session.user.name || 'Admin',
      },
      isTyping
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Typing indicator error:', error)
    return NextResponse.json({ error: 'Failed to send typing indicator' }, { status: 500 })
  }
}
