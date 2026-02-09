/**
 * Pusher Constants and Types
 * Shared between server and client
 */

// Channel names
export const CHANNELS = {
  // Main inbox channel for all updates
  INBOX: 'inbox',
  // Per-conversation channel for typing indicators
  conversation: (id: string) => `conversation-${id}`,
  // Per-user channel for private notifications
  user: (id: string) => `private-user-${id}`,
} as const

// Event types
export const EVENTS = {
  // Message events
  NEW_MESSAGE: 'new-message',
  MESSAGE_READ: 'message-read',
  MESSAGE_UPDATED: 'message-updated',
  
  // Conversation events
  CONVERSATION_UPDATED: 'conversation-updated',
  CONVERSATION_ASSIGNED: 'conversation-assigned',
  
  // Typing indicator
  TYPING_START: 'typing-start',
  TYPING_STOP: 'typing-stop',
  
  // User events
  USER_ONLINE: 'user-online',
  USER_OFFLINE: 'user-offline',
} as const

// Type definitions
export interface NewMessageEvent {
  conversationId: string
  message: {
    id: string
    userId: string
    direction: 'incoming' | 'outgoing'
    messageType: string
    content: string | null
    mediaUrl: string | null
    createdAt: string
    sentBy: string | null
  }
}

export interface TypingEvent {
  conversationId: string
  userId: string
  userName: string
}

export interface ConversationUpdatedEvent {
  conversationId: string
  updates: {
    unreadCount?: number
    lastMessage?: any
    status?: string
    assignees?: any[]
    tags?: any[]
  }
}
