import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { broadcastNewMessage, broadcastConversationUpdate } from '@/lib/pusher'

 async function resolveReplyToId(userId: number, quotedMessageId: string) {
   const exactMatch = await prisma.message.findFirst({
     where: {
       userId,
       metadata: {
         contains: `"lineMessageId":"${quotedMessageId}"`,
       },
     },
     orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
     select: { id: true },
   })

   if (exactMatch) {
     return exactMatch.id
   }

   const fallbackMessages = await prisma.message.findMany({
     where: {
       userId,
       metadata: { not: null },
     },
     orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
     take: 2000,
     select: {
       id: true,
       metadata: true,
     },
   })

   for (const msg of fallbackMessages) {
     try {
       const parsed = typeof msg.metadata === 'string' ? JSON.parse(msg.metadata) : msg.metadata
       if (parsed?.lineMessageId === quotedMessageId) {
         return msg.id
       }
     } catch {
     }
   }

   return null
 }

// This endpoint allows the old system (v1) to sync messages/events to the new system
// Protected by INTERNAL_API_SECRET

export async function POST(request: NextRequest) {
  console.log('=== SYNC WEBHOOK START ===')
  try {
    // 1. Check Authentication
    const authHeader = request.headers.get('authorization')
    const internalSecret = process.env.INTERNAL_API_SECRET || process.env.NEXTAUTH_SECRET
    
    console.log('Auth header present:', !!authHeader)
    console.log('Secret configured:', !!internalSecret)

    if (!authHeader || authHeader !== `Bearer ${internalSecret}`) {
      console.error('Unauthorized - invalid auth')
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Parse Payload
    const body = await request.json()
    console.log('Received body:', JSON.stringify(body).substring(0, 200))
    
    const { event, data } = body
    
    if (!event || !data) {
      console.error('Invalid payload')
      return NextResponse.json({ error: 'Invalid payload' }, { status: 400 })
    }
    
    console.log(`Processing ${event} event`)

    if (event === 'message') {
      await handleSyncMessage(data)
    } else {
      console.warn('Unknown event:', event)
    }
    
    console.log('=== SYNC WEBHOOK SUCCESS ===')
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('=== SYNC WEBHOOK ERROR ===', error)
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
  console.log('[handleSyncMessage] Received data:', JSON.stringify(data))
  
  const {
    lineUserId,
    displayName,
    pictureUrl,
    direction,
    type,
    content,
    mediaUrl,
    timestamp,
    lineAccountId,
    metadata,
    quoteToken,
    lineMessageId,
    quotedMessageId
  } = data
  
  console.log('[handleSyncMessage] content:', content, 'type:', type)

  if (!lineUserId) return
  const safePictureUrl = normalizePictureUrl(pictureUrl)
  const createdAt = timestamp ? new Date(timestamp) : new Date()

  const parsedMetadata = (() => {
    if (!metadata) return null
    try {
      return typeof metadata === 'string' ? JSON.parse(metadata) : metadata
    } catch {
      return null
    }
  })()

  const resolvedLineMessageId = lineMessageId ?? parsedMetadata?.lineMessageId
  const resolvedQuotedMessageId = quotedMessageId ?? parsedMetadata?.quotedMessageId

  // Use the true instant from timestamp (ms) or "now". Prisma + MySQL session timezone handles storage.
  // Do not add +7h — Date is UTC instant; adding hours shifts the event incorrectly.

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

    const extra: Record<string, any> = {}
    if (quoteToken) extra.quoteToken = quoteToken
    if (resolvedLineMessageId) extra.lineMessageId = resolvedLineMessageId
    if (resolvedQuotedMessageId) extra.quotedMessageId = resolvedQuotedMessageId

    if (Object.keys(extra).length > 0) {
      if (base && typeof base === 'object') {
        return JSON.stringify({ ...base, ...extra })
      }
      if (typeof base === 'string' && base.trim().length > 0) {
        return JSON.stringify({ raw: base, ...extra })
      }
      return JSON.stringify(extra)
    }

    if (base) {
      return typeof base === 'string' ? base : JSON.stringify(base)
    }

    return null
  })()

  // 3. Dedup check - use lineMessageId as primary key, fallback to content+direction within 10s window
  if (resolvedLineMessageId) {
    // Primary: LINE message ID is globally unique per message
    // Use exact JSON key match to avoid false positives (e.g. quotedMessageId containing the same value)
    const existingByLineId = await prisma.message.findFirst({
      where: {
        userId: user.id,
        metadata: { contains: `"lineMessageId":"${resolvedLineMessageId}"` },
      },
      select: { id: true },
    })
    if (existingByLineId) {
      console.log('[handleSyncMessage] Duplicate skipped (lineMessageId):', resolvedLineMessageId)
      return
    }
  } else {
    // Fallback: same content + direction within a 10-second window
    const windowStart = new Date(createdAt.getTime() - 10000)
    const windowEnd = new Date(createdAt.getTime() + 10000)
    const existingMessage = await prisma.message.findFirst({
      where: {
        userId: user.id,
        direction: direction || 'incoming',
        content: content || null,
        createdAt: { gte: windowStart, lte: windowEnd },
      },
      select: { id: true },
    })
    if (existingMessage) {
      console.log('[handleSyncMessage] Duplicate skipped (content+window):', content?.substring(0, 30))
      return
    }
  }

  let replyToId: number | null = null
  if (resolvedQuotedMessageId) {
    replyToId = await resolveReplyToId(user.id, resolvedQuotedMessageId)
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
      updatedAt: createdAt,
      isRead: direction === 'outgoing' ? true : false,
      replyToId,
    },
    include: { replyTo: true },
  })
  
  console.log('[handleSyncMessage] Created message:', {
    id: createdMessage.id,
    content: createdMessage.content,
    messageType: createdMessage.messageType
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
        replyTo: createdMessage.replyTo
          ? {
              id: createdMessage.replyTo.id.toString(),
              content: createdMessage.replyTo.content,
              messageType: createdMessage.replyTo.messageType,
            }
          : null,
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
      metadata: createdMessage.metadata ? JSON.parse(createdMessage.metadata) : null,
      replyToId: createdMessage.replyToId ? createdMessage.replyToId.toString() : null,
      replyTo: createdMessage.replyTo
        ? {
            id: createdMessage.replyTo.id.toString(),
            content: createdMessage.replyTo.content,
            messageType: createdMessage.replyTo.messageType,
          }
        : null,
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
