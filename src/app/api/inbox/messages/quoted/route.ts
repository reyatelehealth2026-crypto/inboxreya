import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // quotedMessageId = LINE message ID of the quoted message (from LINE webhook quotedMessageId field)
    // quoteToken = legacy param (quoteToken stored in outgoing message metadata)
    const quotedMessageId = searchParams.get('quotedMessageId') || searchParams.get('quoteToken')

    if (!quotedMessageId) {
      return NextResponse.json({ error: 'quotedMessageId is required' }, { status: 400 })
    }

    // Search recent messages for one whose metadata.lineMessageId matches quotedMessageId
    // This covers both incoming (lineMessageId) and outgoing (quoteToken) messages
    const messages = await prisma.message.findMany({
      where: {
        metadata: { not: null },
      },
      orderBy: { createdAt: 'desc' },
      take: 500,
      select: {
        id: true,
        content: true,
        messageType: true,
        direction: true,
        metadata: true,
      },
    })

    let matchedMessage: typeof messages[number] | null = null

    for (const msg of messages) {
      try {
        const meta = typeof msg.metadata === 'string'
          ? JSON.parse(msg.metadata)
          : msg.metadata

        // Primary: match by lineMessageId (LINE's unique message ID stored when saving)
        if (meta?.lineMessageId === quotedMessageId) {
          matchedMessage = msg
          break
        }
        // Fallback: match by quoteToken (stored on outgoing messages from LINE API response)
        if (meta?.quoteToken === quotedMessageId) {
          matchedMessage = msg
          break
        }
      } catch {
        // ignore parse errors
      }
    }

    if (!matchedMessage) {
      return NextResponse.json({
        error: 'Message not found',
        content: null,
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      content: matchedMessage.content,
      messageType: matchedMessage.messageType,
      direction: matchedMessage.direction,
      messageId: matchedMessage.id.toString(),
    })
  } catch (error) {
    console.error('Error fetching quoted message:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quoted message' },
      { status: 500 }
    )
  }
}
