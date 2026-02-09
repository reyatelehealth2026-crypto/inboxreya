/**
 * Pusher Server-side Configuration
 * Used for sending events from the server
 * 
 * NOTE: This file should ONLY be imported in server-side code (API routes)
 * For client-side, use pusher-constants.ts for types and constants
 */

import Pusher from 'pusher'
import { CHANNELS, EVENTS } from './pusher-constants'
import type { NewMessageEvent, ConversationUpdatedEvent, TypingEvent } from './pusher-constants'

// Re-export constants and types for backward compatibility
export { CHANNELS, EVENTS }
export type { NewMessageEvent, ConversationUpdatedEvent, TypingEvent }

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
 * Broadcast new message to inbox channel
 */
export async function broadcastNewMessage(data: NewMessageEvent) {
  return triggerPusherEvent(CHANNELS.INBOX, EVENTS.NEW_MESSAGE, data)
}

/**
 * Broadcast conversation update
 */
export async function broadcastConversationUpdate(data: ConversationUpdatedEvent) {
  return triggerPusherEvent(CHANNELS.INBOX, EVENTS.CONVERSATION_UPDATED, data)
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
