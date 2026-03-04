
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendPlatformMessage } from '@/lib/php-bridge'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { broadcastNewMessage, broadcastConversationUpdate } from '@/lib/pusher'

const isInternalRequest = (request: NextRequest) =>
  request.headers.get('x-internal-request') === 'true'

// Helper to handle the timezone discrepancy between Next.js (UTC connection) and PHP (Local connection + DATETIME)
// The DB stores literal Bangkok time (e.g. 17:00) but Prisma reads it as UTC (17:00Z).
// We simply assert that the time read IS +07:00.
const toBangkokWallTime = (date: Date | null | undefined) => {
  if (!date) return null
  try {
    // Take the ISO string (e.g. "2024-01-30T17:00:00.000Z") and declare it as +07:00
    // Result: "2024-01-30T17:00:00.000+07:00"
    return date.toISOString().replace('Z', '+07:00')
  } catch (e) {
    return null
  }
}

const parseMetadata = (value: string | null) => {
  if (!value) return null
  try {
    return JSON.parse(value)
  } catch {
    return null
  }
}

export async function GET(request: NextRequest) {
  try {
    const internalRequest = isInternalRequest(request)
    const session = internalRequest ? null : await auth()
    if (!internalRequest && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const userId = searchParams.get('userId')
    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get('limit') || '50')))
    const cursor = searchParams.get('cursor')
    const startDate = searchParams.get('startDate')
    const endDate = searchParams.get('endDate')
    const markRead = searchParams.get('markRead')

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
    }

    const lineUser = await prisma.lineUser.findUnique({
      where: { id: parsedUserId },
      select: { id: true, lineAccountId: true },
    })

    if (!lineUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (!internalRequest) {
      if (
        session?.user &&
        session.user.role !== 'super_admin' &&
        session.user.lineAccountId &&
        lineUser.lineAccountId !== session.user.lineAccountId
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    const cursorId = cursor ? Number(cursor) : null
    if (cursor && !Number.isFinite(cursorId)) {
      return NextResponse.json({ error: 'Invalid cursor' }, { status: 400 })
    }

    const skip = cursorId ? 1 : (page - 1) * limit

    const fromDate = startDate ? new Date(startDate) : null
    const toDate = endDate ? new Date(endDate) : null
    if ((fromDate && Number.isNaN(fromDate.getTime())) || (toDate && Number.isNaN(toDate.getTime()))) {
      return NextResponse.json({ error: 'Invalid date range' }, { status: 400 })
    }

    // Note: Filtering by date might also need adjustment if the DB values are shifted.
    // However, usually filters come from UI relative to "Now", which we also need to shift if we query against raw DB time.
    // For now, focusing on display and creation.

    const where: {
      userId: number
      createdAt?: { gte?: Date; lte?: Date }
    } = { userId: parsedUserId }
    if (fromDate || toDate) {
      where.createdAt = {
        ...(fromDate && { gte: fromDate }),
        ...(toDate && { lte: toDate }),
      }
    }

    const messages = await prisma.message.findMany({
      where,
      include: {
        replyTo: true,
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: limit,
      skip,
      ...(cursorId && { cursor: { id: cursorId } }),
    })

    const total = await prisma.message.count({ where })

    const shouldMarkRead = markRead !== 'false' && markRead !== '0'
    if (shouldMarkRead) {
      await prisma.message.updateMany({
        where: {
          userId: parsedUserId,
          direction: 'incoming',
          isRead: false,
        },
        data: { isRead: true },
      })
    }

    const formattedMessages = messages.map((msg) => ({
      id: msg.id.toString(),
      userId: msg.userId?.toString() ?? '',
      direction: msg.direction,
      messageType: msg.messageType,
      content: msg.content,
      mediaUrl: msg.mediaUrl,
      metadata: parseMetadata(msg.metadata),
      isRead: msg.isRead,
      sentBy: msg.sentBy,
      replyToId: msg.replyToId ? msg.replyToId.toString() : null,
      replyTo: msg.replyTo
        ? {
          id: msg.replyTo.id.toString(),
          content: msg.replyTo.content,
          messageType: msg.replyTo.messageType,
        }
        : null,
      platform: (msg.platform ?? 'line') as 'line' | 'facebook' | 'tiktok',
      createdAt: toBangkokWallTime(msg.createdAt),
      updatedAt: toBangkokWallTime(msg.updatedAt),
    }))

    // Reverse to show oldest first
    formattedMessages.reverse()

    const nextCursor = messages.length === limit ? messages[messages.length - 1].id.toString() : null

    return NextResponse.json({
      data: formattedMessages,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasMore: skip + messages.length < total,
        cursor: nextCursor,
      },
    })
  } catch (error) {
    console.error('Error fetching messages:', error)
    return NextResponse.json(
      { error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const internalRequest = isInternalRequest(request)
    const session = internalRequest ? null : await auth()
    if (!internalRequest && !session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, content, messageType = 'text', replyToId, mediaUrl, metadata } = body

    if (!userId || !content) {
      return NextResponse.json(
        { error: 'userId and content are required' },
        { status: 400 }
      )
    }

    if (typeof content === 'string' && content.length > 2000) {
      return NextResponse.json(
        { error: 'Content is too long (max 2000 characters)' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
    }

    const parsedReplyToId =
      replyToId !== undefined && replyToId !== null ? Number(replyToId) : null
    if (replyToId && !Number.isFinite(parsedReplyToId)) {
      return NextResponse.json({ error: 'replyToId must be a number' }, { status: 400 })
    }

    // Get the user to find their account and platform
    const user = await prisma.lineUser.findUnique({
      where: { id: parsedUserId },
      select: { id: true, lineAccountId: true, lineUserId: true, platform: true, platformUserId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!user.lineUserId) {
      return NextResponse.json({ error: 'User has no LINE user id' }, { status: 400 })
    }

    const userPlatform = (user.platform ?? 'line') as 'line' | 'facebook' | 'tiktok'

    if (!internalRequest) {
      if (
        session?.user &&
        session.user.role !== 'super_admin' &&
        session.user.lineAccountId &&
        user.lineAccountId !== session.user.lineAccountId
      ) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    }

    // Get quoteToken from the message being replied to (LINE only)
    let quoteToken: string | null = null
    if (parsedReplyToId && userPlatform === 'line') {
      const replyToMessage = await prisma.message.findUnique({
        where: { id: parsedReplyToId },
        select: { metadata: true },
      })
      if (replyToMessage?.metadata) {
        try {
          const parsedMetadata = typeof replyToMessage.metadata === 'string'
            ? JSON.parse(replyToMessage.metadata)
            : replyToMessage.metadata
          quoteToken = parsedMetadata?.quoteToken || null
        } catch {
          // Ignore parse errors
        }
      }
    }

    // Try to send via PHP API if configured (platform-aware)
    let platformSendSuccess = false
    let returnedQuoteToken: string | null = null

    if (process.env.PHP_API_URL) {
      try {
        const sendResult = await sendPlatformMessage({
          userId: parsedUserId.toString(),
          message: content,
          type: messageType,
          sentBy: session?.user?.id ?? null,
          platform: userPlatform,
          quoteToken,
        })
        platformSendSuccess = sendResult.success
        
        // Capture the quoteToken returned from LINE API (for future replies)
        if (sendResult.success && sendResult.quoteToken) {
          returnedQuoteToken = sendResult.quoteToken
        }

        if (!sendResult.success) {
          console.warn(`${userPlatform} message send failed (will still save message):`, sendResult.error)
        }
      } catch (phpError) {
        console.warn('PHP API error (will still save message):', phpError)
      }
    } else {
      console.warn('PHP_API_URL not configured, message will be saved but not sent to platform')
    }

    // Manual Time override for Bangkok Time
    const now = new Date()
    // Add 7 hours to ensure DATETIME columns receive the Bangkok face-value time
    const bangkokNow = new Date(now.getTime() + 7 * 60 * 60 * 1000)
    
    // Build metadata including the quoteToken from LINE
    const messageMetadata: any = metadata || {}
    if (returnedQuoteToken) {
      messageMetadata.quoteToken = returnedQuoteToken
      messageMetadata.sentAt = new Date().toISOString()
    }

    // Save to Prisma database (PHP no longer saves to avoid duplicates)
    const message = await prisma.message.create({
      data: {
        userId: parsedUserId,
        lineAccountId: user.lineAccountId,
        direction: 'outgoing',
        messageType,
        content,
        mediaUrl,
        metadata: Object.keys(messageMetadata).length > 0 ? JSON.stringify(messageMetadata) : null,
        sentBy: session?.user?.id ?? null,
        replyToId: parsedReplyToId,
        isRead: true,
        platform: userPlatform,
        createdAt: bangkokNow,
        updatedAt: bangkokNow,
      },
      include: {
        replyTo: true,
      },
    })

    // Update user's last interaction
    await prisma.lineUser.update({
      where: { id: parsedUserId },
      data: { lastInteraction: new Date() }, // lastInteraction might be TIMESTAMP or DATETIME? Usually datetime. Should probably apply same logic but usually less critical.
      select: { id: true },
    })

    const responsePayload = {
      id: message.id.toString(),
      userId: message.userId?.toString() ?? '',
      direction: message.direction,
      messageType: message.messageType,
      content: message.content,
      mediaUrl: message.mediaUrl,
      metadata: parseMetadata(message.metadata),
      isRead: message.isRead,
      sentBy: message.sentBy,
      replyToId: message.replyToId ? message.replyToId.toString() : null,
      replyTo: message.replyTo
        ? {
          id: message.replyTo.id.toString(),
          content: message.replyTo.content,
          messageType: message.replyTo.messageType,
        }
        : null,
      platform: userPlatform,
      createdAt: toBangkokWallTime(message.createdAt),
      updatedAt: toBangkokWallTime(message.updatedAt),
      platformSent: platformSendSuccess,
    }

    // Broadcast via SSE (existing)
    broadcastRealtimeEvent({
      type: 'new_message',
      data: {
        conversationId: parsedUserId.toString(),
        message: responsePayload,
      },
      timestamp: Date.now(),
    })

    // Broadcast via Pusher (new - real-time)
    await broadcastNewMessage({
      conversationId: parsedUserId.toString(),
      message: {
        id: responsePayload.id,
        userId: responsePayload.userId,
        direction: 'outgoing',
        messageType: responsePayload.messageType ?? 'text',
        content: responsePayload.content,
        mediaUrl: responsePayload.mediaUrl,
        metadata: responsePayload.metadata,
        replyToId: responsePayload.replyToId,
        replyTo: responsePayload.replyTo,
        createdAt: responsePayload.createdAt || new Date().toISOString(),
        sentBy: responsePayload.sentBy,
        platform: userPlatform,
      },
    })

    return NextResponse.json(responsePayload)
  } catch (error) {
    console.error('Error sending message:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}

