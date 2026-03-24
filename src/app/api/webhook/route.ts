import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import prisma from '@/lib/prisma'
import { createAutoTagManager } from '@/lib/services/auto-tag-manager'
import { broadcastNewMessage, broadcastConversationUpdate } from '@/lib/pusher'

const toBangkokWallDate = (date: Date | number | string) => {
  const baseDate = date instanceof Date ? date : new Date(date)
  return new Date(baseDate.getTime() + 7 * 60 * 60 * 1000)
}

const toIsoStringSafe = (date: Date | string | null | undefined) => {
  if (!date) return null
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  try {
    return d.toISOString()
  } catch {
    return null
  }
}

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

// Verify LINE signature
function verifySignature(body: string, signature: string): boolean {
  const channelSecret = process.env.LINE_CHANNEL_SECRET
  if (!channelSecret) return false

  const hash = crypto
    .createHmac('SHA256', channelSecret)
    .update(body)
    .digest('base64')

  return hash === signature
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('x-line-signature')
    if (!signature) {
      return NextResponse.json({ error: 'No signature' }, { status: 401 })
    }

    const body = await request.text()
    
    // Verify signature
    if (!verifySignature(body, signature)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 })
    }

    const data = JSON.parse(body)
    const events = data.events || []

    for (const event of events) {
      await handleEvent(event)
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Webhook error:', error)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleEvent(event: any) {
  const { type, source, message, timestamp } = event
  const eventDate = timestamp ? toBangkokWallDate(Number(timestamp)) : toBangkokWallDate(new Date())

  // Get or create LINE user
  const lineUserId = source.userId
  if (!lineUserId) return

  // Find LINE account (assume default for now)
  const lineAccount = await prisma.lineAccount.findFirst({
    where: { isDefault: true },
  })

  if (!lineAccount) {
    console.error('No default LINE account found')
    return
  }

  // Get or create user
  let user = await prisma.lineUser.findFirst({
    where: {
      lineUserId,
      lineAccountId: lineAccount.id,
    },
    select: {
      id: true,
      lineAccountId: true,
      displayName: true,
      pictureUrl: true,
    },
  })

  if (!user) {
    // Create new user
    user = await prisma.lineUser.create({
      data: {
        lineUserId,
        lineAccountId: lineAccount.id,
        displayName: source.displayName || null,
        lastInteraction: eventDate,
      },
      select: {
        id: true,
        lineAccountId: true,
        displayName: true,
        pictureUrl: true,
      },
    })

    // Trigger auto-tagging for new follower
    const autoTagManager = createAutoTagManager(lineAccount.id)
    await autoTagManager.onFollow(user.id)
  } else if (user) {
    // Update last interaction
    await prisma.lineUser.update({
      where: { id: user.id },
      data: { lastInteraction: eventDate },
      select: { id: true },
    })
  }

  // Handle different event types
  switch (type) {
    case 'message':
      await handleMessage(user, lineAccount.id, message, event.replyToken, eventDate)
      break

    case 'follow':
      await handleFollow(user, lineAccount.id)
      break

    case 'unfollow':
      await handleUnfollow(user)
      break

    case 'postback':
      await handlePostback(user, event.postback)
      break

    default:
      console.log('Unhandled event type:', type)
  }
}

async function handleMessage(
  user: any,
  lineAccountId: number,
  message: any,
  replyToken: string | null,
  eventDate: Date
) {
  // Save message to database
  const messageType = message.type
  let content = null
  let mediaUrl = null
  let metadataObj: Record<string, any> = {}

  // Store LINE message id for reply matching
  if (message.id) {
    metadataObj.lineMessageId = message.id
  }

  if (message.quotedMessageId) {
    metadataObj.quotedMessageId = message.quotedMessageId
  }

  // Store quoteToken from LINE message (used for quote reply feature)
  if (message.quoteToken) {
    metadataObj.quoteToken = message.quoteToken
  }

  switch (messageType) {
    case 'text':
      content = message.text
      break

    case 'image':
      mediaUrl = message.id // Store message ID, will fetch actual URL later
      break

    case 'video':
      mediaUrl = message.id
      break

    case 'audio':
      mediaUrl = message.id
      break

    case 'file':
      mediaUrl = message.id
      metadataObj.fileName = message.fileName
      metadataObj.fileSize = message.fileSize
      break

    case 'location':
      metadataObj.latitude = message.latitude
      metadataObj.longitude = message.longitude
      metadataObj.address = message.address
      break

    case 'sticker':
      metadataObj.packageId = message.packageId
      metadataObj.stickerId = message.stickerId
      break
  }

  const metadata = Object.keys(metadataObj).length > 0 ? JSON.stringify(metadataObj) : null

  let replyToId: number | null = null
  if (message.quotedMessageId) {
    replyToId = await resolveReplyToId(user.id, message.quotedMessageId)
  }

  const createdMessage = await prisma.message.create({
    data: {
      userId: user.id,
      lineAccountId,
      direction: 'incoming',
      messageType,
      content,
      mediaUrl,
      metadata,
      replyToken,
      isRead: false,
      replyToId,
      createdAt: eventDate,
      updatedAt: eventDate,
    },
  })

  // Update user's last interaction
  await prisma.$executeRaw`UPDATE users SET last_interaction = ${eventDate} WHERE id = ${user.id}`

  // Trigger auto-tagging based on message
  if (content) {
    const autoTagManager = createAutoTagManager(lineAccountId)
    await autoTagManager.onMessage(user.id, content)
  }

  // Broadcast new message via Pusher for real-time updates
  const createdAt = toIsoStringSafe(createdMessage.createdAt) ?? eventDate.toISOString()

  await broadcastNewMessage({
    conversationId: user.id.toString(),
    message: {
      id: createdMessage.id.toString(),
      userId: user.id.toString(),
      direction: 'incoming',
      messageType: messageType ?? 'text',
      content: content,
      mediaUrl: mediaUrl,
      metadata: metadata ? JSON.parse(metadata) : null,
      replyToId: replyToId ? replyToId.toString() : null,
      createdAt,
      sentBy: null,
    },
  })

  // Broadcast conversation update for unread count
  await broadcastConversationUpdate({
    conversationId: user.id.toString(),
    updates: {
      lastMessage: {
        id: createdMessage.id.toString(),
        content: content,
        messageType: messageType,
      },
      unreadCount: 1, // Will be accumulated on client
    },
  })
}

async function handleFollow(user: any, lineAccountId: number) {
  await prisma.lineUser.update({
    where: { id: user.id },
    data: { isBlocked: false },
    select: { id: true },
  })

  // Trigger auto-tagging for follow
  const autoTagManager = createAutoTagManager(lineAccountId)
  await autoTagManager.onFollow(user.id)
}

async function handleUnfollow(user: any) {
  await prisma.lineUser.update({
    where: { id: user.id },
    data: { isBlocked: true },
    select: { id: true },
  })
}

async function handlePostback(user: any, postback: any) {
  // Handle postback data (e.g., from rich menu, flex message buttons)
  console.log('Postback data:', postback.data)
  
  // You can implement custom logic here based on postback.data
}
