import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { broadcastNewMessage, broadcastConversationUpdate } from '@/lib/pusher'

// This endpoint allows the old system (v1) to sync messages/events to the new system
// Protected by INTERNAL_API_SECRET

export async function POST(request: NextRequest) {
  try {
    // 1. Check Authentication
    const authHeader = request.headers.get('authorization')
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.NEXTAUTH_SECRET

    if (!authHeader || authHeader !== `Bearer ${internalSecret}`) {
      console.error('Sync webhook: Unauthorized - missing or invalid auth header')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse Payload
    const body = await request.json()
    const { event, data } = body

    if (!event || !data) {
      console.error('Sync webhook: Invalid payload - missing event or data', { event, hasData: !!data })
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }

    console.log(`Sync webhook: Received ${event} event for user ${data.lineUserId}`)

    // 3. Handle Events
    if (event === 'message') {
      await handleSyncMessage(data)
    } else if (event === 'user_update') {
      await handleSyncUser(data)
    } else {
      console.warn(`Sync webhook: Unknown event type: ${event}`)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Sync webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

function normalizePictureUrl(value: unknown) {
  if (typeof value !== 'string') return null
  const trimmed = value.trim()
  if (!trimmed) return null
  // Prisma String defaults to varchar(191) in MySQL, keep it safe.
  return trimmed.length > 191 ? trimmed.slice(0, 191) : trimmed
}

async function handleSyncMessage(data: any) {
  const {
    lineUserId,
    displayName,
    pictureUrl,
    direction, // 'incoming' | 'outgoing'
    type,      // 'text' | 'image' | ...
    content,
    mediaUrl,
    timestamp,
    lineAccountId, // optional, ID of the LINE account
    metadata,
    quoteToken
  } = data

  if (!lineUserId) return
  const safePictureUrl = normalizePictureUrl(pictureUrl)
  const createdAt = timestamp ? new Date(timestamp) : new Date()

  // 1. Resolve LineAccount
  // Convert lineAccountId to integer if provided (it comes as string from JSON)
  let accountId: number | undefined = lineAccountId ? parseInt(String(lineAccountId), 10) : undefined
  if (accountId && isNaN(accountId)) {
    accountId = undefined
  }

  if (!accountId) {
    const defaultAccount = await prisma.lineAccount.findFirst({
      where: { isDefault: true }
    })
    accountId = defaultAccount?.id
    
    // If still no account, try to get any active account
    if (!accountId) {
      const anyAccount = await prisma.lineAccount.findFirst({
        where: { isActive: true }
      })
      accountId = anyAccount?.id
    }
  }

  if (!accountId) {
    console.error(`No LINE account found for sync. lineUserId: ${lineUserId}, lineAccountId: ${lineAccountId}`)
    // Try to create a default account if none exists
    const newAccount = await prisma.lineAccount.create({
      data: {
        name: 'Default Account',
        channelSecret: 'default',
        channelAccessToken: 'default',
        isDefault: true,
        isActive: true
      }
    })
    accountId = newAccount.id
    console.log(`Created default LINE account with ID: ${accountId}`)
  }

  // 2. Find or Create User
  let user = await prisma.lineUser.findUnique({
    where: {
      lineAccountId_lineUserId: {
        lineAccountId: accountId as number,
        lineUserId: lineUserId
      }
    },
    select: {
      id: true,
      displayName: true,
      pictureUrl: true
    }
  })

  if (!user) {
    user = await prisma.lineUser.create({
      data: {
        lineAccountId: accountId as number,
        lineUserId: lineUserId,
        displayName: displayName || 'Unknown',
        pictureUrl: safePictureUrl,
        isRegistered: false,
        lastInteraction: new Date(timestamp || Date.now())
      },
      select: {
        id: true,
        displayName: true,
        pictureUrl: true
      }
    })
  } else {
    // Always update last interaction; optionally refresh profile fields
    await prisma.lineUser.update({
      where: { id: user.id },
      data: {
        displayName: displayName || user.displayName,
        pictureUrl: safePictureUrl || user.pictureUrl,
        lastInteraction: new Date(timestamp || Date.now())
      },
      select: { id: true }
    })
  }

  const metadataValue = (() => {
    let base: any = null

    if (metadata) {
      try {
        base = typeof metadata === 'string' ? JSON.parse(metadata) : metadata
      } catch {
        base = metadata
      }
    }

    if (quoteToken) {
      if (base && typeof base === 'object') {
        return JSON.stringify({ ...base, quoteToken })
      }
      if (typeof base === 'string' && base.trim().length > 0) {
        return JSON.stringify({ raw: base, quoteToken })
      }
      return JSON.stringify({ quoteToken })
    }

    if (base) {
      return typeof base === 'string' ? base : JSON.stringify(base)
    }

    return null
  })()

  // 3. Create Message
  const existingMessage = await prisma.message.findFirst({
    where: {
      userId: user.id,
      direction: direction || 'incoming',
      messageType: type || 'text',
      content: content || null,
      mediaUrl: mediaUrl || null,
      createdAt,
    },
  })

  if (existingMessage) {
    return
  }

  const createdMessage = await prisma.message.create({
    data: {
      lineAccountId: accountId as number,
      userId: user.id,
      direction: direction || 'incoming',
      messageType: type || 'text',
      content: content || null,
      mediaUrl: mediaUrl || null,
      metadata: metadataValue,
      createdAt,
      isRead: direction === 'outgoing' ? true : false
    }
  })

  // Broadcast via SSE (existing)
  broadcastRealtimeEvent({
    type: 'new_message',
    timestamp: Date.now(),
    data: {
      conversationId: user.id,
      message: {
        id: createdMessage.id,
        userId: createdMessage.userId,
        direction: createdMessage.direction,
        messageType: createdMessage.messageType,
        content: createdMessage.content,
        mediaUrl: createdMessage.mediaUrl,
        metadata: createdMessage.metadata ? JSON.parse(createdMessage.metadata) : null,
        isRead: createdMessage.isRead,
        sentBy: createdMessage.sentBy,
        replyToId: createdMessage.replyToId,
        createdAt: createdMessage.createdAt.toISOString(),
        updatedAt: createdMessage.updatedAt.toISOString()
      }
    }
  })

  // Broadcast via Pusher (new - real-time)
  await broadcastNewMessage({
    conversationId: user.id.toString(),
    message: {
      id: createdMessage.id.toString(),
      userId: createdMessage.userId?.toString() ?? '',
      direction: createdMessage.direction as 'incoming' | 'outgoing',
      messageType: createdMessage.messageType ?? 'text',
      content: createdMessage.content,
      mediaUrl: createdMessage.mediaUrl,
      createdAt: createdMessage.createdAt.toISOString(),
      sentBy: createdMessage.sentBy?.toString() || null,
    },
  })

  // Broadcast conversation update
  await broadcastConversationUpdate({
    conversationId: user.id.toString(),
    updates: {
      lastMessage: {
        id: createdMessage.id.toString(),
        content: createdMessage.content,
        messageType: createdMessage.messageType,
      },
      unreadCount: createdMessage.direction === 'incoming' ? 1 : 0,
    },
  })
}

async function handleSyncUser(data: any) {
  // Logic to sync user profile updates
  const { lineUserId, pictureUrl, ...updates } = data
  if (!lineUserId) return
  const safePictureUrl = normalizePictureUrl(pictureUrl)

  // Need account ID to find user
  // This simplistic version assumes single account or needs lookup
  // For now, we'll try to update across all accounts with this lineUserId (if multiple)
  // or just the default one.
  
  const users = await prisma.lineUser.findMany({
    where: { lineUserId },
    select: { id: true }
  })

  for (const user of users) {
    await prisma.lineUser.update({
      where: { id: user.id },
      data: {
        ...updates,
        ...(safePictureUrl ? { pictureUrl: safePictureUrl } : {}),
        updatedAt: new Date()
      },
      select: { id: true }
    })
  }
}
