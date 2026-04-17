/**
 * Pusher Server-side Configuration
 * Used for sending events from the server
 * 
 * NOTE: This file should ONLY be imported in server-side code (API routes)
 * For client-side, use pusher-constants.ts for types and constants
 */

import Pusher from 'pusher'
import { CHANNELS, EVENTS } from './pusher-constants'
import type { NewMessageEvent, ConversationUpdatedEvent, MessageReadEvent, TypingEvent } from './pusher-constants'

// Re-export constants and types for backward compatibility
export { CHANNELS, EVENTS }
export type { NewMessageEvent, ConversationUpdatedEvent, MessageReadEvent, TypingEvent }

// Singleton pattern for Pusher instance
const globalForPusher = globalThis as typeof globalThis & {
  pusher?: Pusher
}

function createPusherServer(): Pusher | null {
  // Only run on server-side
  if (typeof window !== 'undefined') {
    return null
  }

  const appId = process.env.PUSHER_APP_ID
  const key = process.env.PUSHER_KEY
  const secret = process.env.PUSHER_SECRET
  const cluster = process.env.PUSHER_CLUSTER || 'ap1'

  if (!appId || !key || !secret) {
    console.warn('Pusher credentials not configured. Real-time features will be disabled.')
    return null
  }

  return new Pusher({
    appId,
    key,
    secret,
    cluster,
    useTLS: true,
  })
}

export const pusherServer = globalForPusher.pusher ?? createPusherServer()

if (process.env.NODE_ENV !== 'production' && pusherServer) {
  globalForPusher.pusher = pusherServer
}

/**
 * Trigger a Pusher event
 */
export async function triggerPusherEvent<T>(
  channel: string,
  event: string,
  data: T
): Promise<boolean> {
  if (!pusherServer) {
    console.warn('Pusher not configured, skipping event:', event)
    return false
  }

  try {
    await pusherServer.trigger(channel, event, data)
    console.log(`[Pusher] Event sent: ${event} on channel: ${channel}`)
    return true
  } catch (error) {
    console.error('Failed to trigger Pusher event:', error)
    return false
  }
}

/**
 * Pusher limits each event payload to 10 KB. Flex messages and very long
 * conversations can easily exceed this. Strip/truncate heavy fields so the
 * realtime "ping" still arrives; the client can refetch the full message
 * from `/api/inbox/messages` if it needs the full content.
 */
const PUSHER_SAFE_CONTENT_LIMIT = 4000

function sanitizeMessageForPusher(
  msg: NewMessageEvent['message']
): NewMessageEvent['message'] {
  const isHeavyType = msg.messageType === 'flex' || msg.messageType === 'imagemap'
  const content = msg.content
  let safeContent = content
  if (isHeavyType) {
    safeContent = null
  } else if (typeof content === 'string' && content.length > PUSHER_SAFE_CONTENT_LIMIT) {
    safeContent = content.slice(0, PUSHER_SAFE_CONTENT_LIMIT)
  }
  const replyTo = msg.replyTo
    ? {
        ...msg.replyTo,
        content:
          typeof msg.replyTo.content === 'string' &&
          msg.replyTo.content.length > PUSHER_SAFE_CONTENT_LIMIT
            ? msg.replyTo.content.slice(0, PUSHER_SAFE_CONTENT_LIMIT)
            : msg.replyTo.content,
      }
    : msg.replyTo
  return { ...msg, content: safeContent, replyTo }
}

/**
 * Broadcast new message to inbox channel
 */
export async function broadcastNewMessage(data: NewMessageEvent) {
  const safeData: NewMessageEvent = {
    ...data,
    message: sanitizeMessageForPusher(data.message),
  }
  return triggerPusherEvent(CHANNELS.INBOX, EVENTS.NEW_MESSAGE, safeData)
}

/**
 * Broadcast conversation update.
 * If `updates.lastMessage` looks like a message object with heavy `content`
 * (e.g. flex), strip/truncate it to stay under the 10 KB Pusher event limit.
 */
export async function broadcastConversationUpdate(data: ConversationUpdatedEvent) {
  const lastMessage = data.updates?.lastMessage
  let safeLastMessage = lastMessage
  if (lastMessage && typeof lastMessage === 'object') {
    const mt = lastMessage.messageType
    const content = lastMessage.content
    if (mt === 'flex' || mt === 'imagemap') {
      safeLastMessage = { ...lastMessage, content: null }
    } else if (typeof content === 'string' && content.length > PUSHER_SAFE_CONTENT_LIMIT) {
      safeLastMessage = { ...lastMessage, content: content.slice(0, PUSHER_SAFE_CONTENT_LIMIT) }
    }
  }
  const safeData: ConversationUpdatedEvent = {
    ...data,
    updates: { ...data.updates, lastMessage: safeLastMessage },
  }
  return triggerPusherEvent(CHANNELS.INBOX, EVENTS.CONVERSATION_UPDATED, safeData)
}

/**
 * Broadcast read receipts to inbox channel
 */
export async function broadcastMessageRead(data: MessageReadEvent) {
  return triggerPusherEvent(CHANNELS.INBOX, EVENTS.MESSAGE_READ, data)
}

/**
 * Broadcast typing indicator
 */
export async function broadcastTyping(
  conversationId: string,
  data: TypingEvent,
  isTyping: boolean
) {
  const event = isTyping ? EVENTS.TYPING_START : EVENTS.TYPING_STOP
  return triggerPusherEvent(CHANNELS.conversation(conversationId), event, data)
}
