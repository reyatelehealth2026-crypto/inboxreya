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

    console.log('[DEBUG] Looking for quoteToken:', quoteToken.substring(0, 20) + '...')

    // Find message by quoteToken in metadata
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
      take: 200,
    })

    console.log('[DEBUG] Found', messages.length, 'messages with metadata')

    // Parse metadata and find matching quoteToken
    let matchedMessage = null
    for (const msg of messages) {
      try {
        const metadata = typeof msg.metadata === 'string' 
          ? JSON.parse(msg.metadata) 
          : msg.metadata
        
        if (metadata?.quoteToken === quoteToken) {
          matchedMessage = msg
          console.log('[DEBUG] Found match! Message ID:', msg.id)
          break
        }
      } catch (e) {
        // Ignore parse errors
      }
    }

    if (!matchedMessage) {
      // Debug: Show some sample metadata
      const samples = messages.slice(0, 5).map(m => ({
        id: m.id,
        metadata: typeof m.metadata === 'string' ? JSON.parse(m.metadata || '{}') : m.metadata
      }))
      console.log('[DEBUG] Sample metadata:', JSON.stringify(samples, null, 2))
      
      return NextResponse.json({ 
        error: 'Message not found',
        content: null,
        debug: {
          searched: messages.length,
          quoteTokenPrefix: quoteToken.substring(0, 20)
        }
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
