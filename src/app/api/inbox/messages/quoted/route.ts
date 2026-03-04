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
    const quoteToken = searchParams.get('quoteToken')

    if (!quoteToken) {
      return NextResponse.json({ error: 'quoteToken is required' }, { status: 400 })
    }

    // Find message by quoteToken in metadata
    // Note: This is a simplified query. In production, you might want to add an index
    // or store quoteToken in a separate column for better performance
    const messages = await prisma.message.findMany({
      where: {
        direction: 'outgoing',
        metadata: {
          not: null,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Limit to recent messages for performance
    })

    // Parse metadata and find matching quoteToken
    const matchedMessage = messages.find((msg) => {
      try {
        const metadata = typeof msg.metadata === 'string' 
          ? JSON.parse(msg.metadata) 
          : msg.metadata
        return metadata?.quoteToken === quoteToken
      } catch {
        return false
      }
    })

    if (!matchedMessage) {
      return NextResponse.json({ 
        error: 'Message not found',
        content: null 
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      content: matchedMessage.content,
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
