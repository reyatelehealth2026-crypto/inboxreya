/**
 * Pusher Client-side Hook
 * Handles real-time subscriptions and events
 */

'use client'

import { useEffect, useRef, useCallback, useState } from 'react'
import Pusher from 'pusher-js'
import type { Channel } from 'pusher-js'
import { useQueryClient } from '@tanstack/react-query'
import { useChatStore } from '@/stores/chat'
import { useInboxStore } from '@/stores/inbox'
import { CHANNELS, EVENTS } from '@/lib/pusher-constants'
import type { NewMessageEvent, ConversationUpdatedEvent, TypingEvent } from '@/lib/pusher-constants'
import { queryKeys } from '@/lib/query-keys'

// Singleton Pusher instance
let pusherInstance: Pusher | null = null

function getPusherClient(): Pusher | null {
  if (typeof window === 'undefined') return null
  
  // In production, environment variables are available at build time
  // Check both runtime and build-time variables
  const key = process.env.NEXT_PUBLIC_PUSHER_KEY || (typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_PUSHER_KEY__ : null)
  const cluster = process.env.NEXT_PUBLIC_PUSHER_CLUSTER || (typeof window !== 'undefined' ? (window as any).__NEXT_PUBLIC_PUSHER_CLUSTER__ : null) || 'ap1'

  if (!key) {
    // Only warn in development, fail silently in production to avoid console spam
    if (process.env.NODE_ENV === 'development') {
      console.warn('Pusher key not configured. Please set NEXT_PUBLIC_PUSHER_KEY in .env.local')
    }
    return null
  }

  if (!pusherInstance) {
    pusherInstance = new Pusher(key, {
      cluster,
    })
  }

  return pusherInstance
}

interface UsePusherOptions {
  enabled?: boolean
}

export function usePusher(options: UsePusherOptions = {}) {
  const { enabled = true } = options
  const queryClient = useQueryClient()
  const { selectedConversationId } = useInboxStore()
  const { addTypingUser, removeTypingUser } = useChatStore()
  
  const pusherRef = useRef<Pusher | null>(null)
  const inboxChannelRef = useRef<Channel | null>(null)
  const conversationChannelRef = useRef<Channel | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [error, setError] = useState<Error | null>(null)

  // Handle new message event
  const handleNewMessage = useCallback((data: NewMessageEvent) => {
    console.log('[Pusher] New message received:', data)
    
    // Use the correct query key format that matches useMessages
    const messagesQueryKey = queryKeys.messagesForUser(data.conversationId)
    
    // Optimistically update messages cache if the conversation is open
    const allMessagesQueries = queryClient.getQueriesData({
      queryKey: messagesQueryKey,
      exact: false, // Match all queries that start with ['messages', conversationId]
    })
    
    console.log('[Pusher] Found queries to update:', allMessagesQueries.length)
    
    allMessagesQueries.forEach(([queryKey, cachedData]) => {
      if (cachedData && typeof cachedData === 'object' && 'data' in cachedData) {
        const existingMessages = (cachedData as any).data || []
        // Check if message exists - handle both string and number IDs
        const messageIdStr = String(data.message.id)
        const messageIdNum = parseInt(data.message.id, 10)
        const messageExists = existingMessages.some((msg: any) => {
          const msgIdStr = String(msg.id)
          const msgIdNum = typeof msg.id === 'number' ? msg.id : parseInt(msg.id, 10)
          return msgIdStr === messageIdStr || msgIdNum === messageIdNum || msg.id === data.message.id
        })
        
        if (!messageExists) {
          // Add new message to cache
          const newMessage = {
            id: data.message.id,
            userId: data.message.userId,
            direction: data.message.direction,
            messageType: data.message.messageType,
            content: data.message.content,
            mediaUrl: data.message.mediaUrl,
            metadata: null,
            isRead: data.message.direction === 'outgoing',
            sentBy: data.message.sentBy,
            replyToId: null,
            replyTo: null,
            platform: data.message.platform ?? 'line',
            createdAt: data.message.createdAt,
            updatedAt: data.message.createdAt,
          }
          
          queryClient.setQueryData(queryKey, {
            ...cachedData,
            data: [...existingMessages, newMessage],
          })
          console.log('[Pusher] Optimistically updated messages cache for query:', queryKey, 'New message:', newMessage)
        } else {
          console.log('[Pusher] Message already exists in cache:', data.message.id)
        }
      }
    })
    
    // Invalidate all messages queries for this conversation (prefix match)
    // This will mark queries as stale and refetch active ones
    queryClient.invalidateQueries({
      queryKey: messagesQueryKey,
      exact: false, // Match all queries that start with this key
      refetchType: 'active', // Refetch active queries immediately
    })
    
    // Invalidate all conversations queries (prefix match)
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversationsRoot(),
      exact: false, // Match all conversations queries
      refetchType: 'active', // Refetch active queries immediately
    })
    
    console.log('[Pusher] Queries invalidated for conversation:', data.conversationId)
  }, [queryClient])

  // Handle conversation update event
  const handleConversationUpdate = useCallback((data: ConversationUpdatedEvent) => {
    console.log('[Pusher] Conversation updated:', data)
    
    // Invalidate and refetch all conversations queries (prefix match)
    queryClient.invalidateQueries({
      queryKey: queryKeys.conversationsRoot(),
      exact: false, // Match all conversations queries
      refetchType: 'active', // Refetch active queries immediately
    })
    
    // If it's the selected conversation, invalidate messages too
    if (data.conversationId === selectedConversationId) {
      queryClient.invalidateQueries({
        queryKey: queryKeys.messagesForUser(data.conversationId),
        exact: false, // Match all messages queries for this conversation
        refetchType: 'active', // Refetch active queries immediately
      })
    }
  }, [queryClient, selectedConversationId])

  // Handle typing start
  const handleTypingStart = useCallback((data: TypingEvent) => {
    addTypingUser(data.conversationId, {
      id: data.userId,
      name: data.userName,
      timestamp: Date.now(),
    })
  }, [addTypingUser])

  // Handle typing stop
  const handleTypingStop = useCallback((data: TypingEvent) => {
    removeTypingUser(data.conversationId, data.userId)
  }, [removeTypingUser])

  // Subscribe to inbox channel
  useEffect(() => {
    if (!enabled) return

    const pusher = getPusherClient()
    if (!pusher) return

    pusherRef.current = pusher

    // Connection state handlers
    pusher.connection.bind('connected', () => {
      console.log('[Pusher] Connected')
      setIsConnected(true)
      setError(null)
    })

    pusher.connection.bind('disconnected', () => {
      console.log('[Pusher] Disconnected')
      setIsConnected(false)
    })

    pusher.connection.bind('error', (err: Error) => {
      console.error('[Pusher] Connection error:', err)
      setError(err)
    })

    // Subscribe to inbox channel
    const inboxChannel = pusher.subscribe(CHANNELS.INBOX)
    inboxChannelRef.current = inboxChannel

    inboxChannel.bind('pusher:subscription_succeeded', () => {
      console.log('[Pusher] Subscribed to inbox channel')
      console.log('[Pusher] Event bindings:', {
        NEW_MESSAGE: EVENTS.NEW_MESSAGE,
        CONVERSATION_UPDATED: EVENTS.CONVERSATION_UPDATED,
        MESSAGE_READ: EVENTS.MESSAGE_READ,
      })
    })

    inboxChannel.bind('pusher:subscription_error', (error: any) => {
      console.error('[Pusher] Subscription error:', error)
    })

    // Bind events with debug logging
    inboxChannel.bind(EVENTS.NEW_MESSAGE, (data: any) => {
      console.log('[Pusher] Raw event received:', EVENTS.NEW_MESSAGE, data)
      handleNewMessage(data)
    })
    inboxChannel.bind(EVENTS.CONVERSATION_UPDATED, (data: any) => {
      console.log('[Pusher] Raw event received:', EVENTS.CONVERSATION_UPDATED, data)
      handleConversationUpdate(data)
    })
    inboxChannel.bind(EVENTS.MESSAGE_READ, (data: any) => {
      console.log('[Pusher] Raw event received:', EVENTS.MESSAGE_READ, data)
      handleConversationUpdate(data)
    })
    
    // Debug: Log all events
    inboxChannel.bind_global((eventName: string, data: any) => {
      if (!eventName.startsWith('pusher:')) {
        console.log('[Pusher] Global event listener:', eventName, data)
      }
    })

    return () => {
      inboxChannel.unbind_all()
      pusher.unsubscribe(CHANNELS.INBOX)
    }
  }, [enabled, handleNewMessage, handleConversationUpdate])

  // Subscribe to conversation-specific channel for typing indicators
  useEffect(() => {
    if (!enabled || !selectedConversationId) return

    const pusher = pusherRef.current
    if (!pusher) return

    // Unsubscribe from previous conversation channel
    if (conversationChannelRef.current) {
      conversationChannelRef.current.unbind_all()
      pusher.unsubscribe(conversationChannelRef.current.name)
    }

    // Subscribe to new conversation channel
    const channelName = CHANNELS.conversation(selectedConversationId)
    const conversationChannel = pusher.subscribe(channelName)
    conversationChannelRef.current = conversationChannel

    conversationChannel.bind('pusher:subscription_succeeded', () => {
      console.log(`[Pusher] Subscribed to conversation channel: ${channelName}`)
    })

    conversationChannel.bind('pusher:subscription_error', (error: any) => {
      console.error(`[Pusher] Conversation subscription error:`, error)
    })

    conversationChannel.bind(EVENTS.TYPING_START, handleTypingStart)
    conversationChannel.bind(EVENTS.TYPING_STOP, handleTypingStop)

    return () => {
      conversationChannel.unbind_all()
      pusher.unsubscribe(channelName)
    }
  }, [enabled, selectedConversationId, handleTypingStart, handleTypingStop])

  return {
    isConnected,
    error,
  }
}

/**
 * Hook to send typing indicator
 */
export function useTypingIndicator(conversationId: string | null) {
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)

  const sendTyping = useCallback(async (isTyping: boolean) => {
    if (!conversationId) return

    try {
      await fetch('/api/inbox/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, isTyping }),
      })
    } catch (error) {
      console.error('Failed to send typing indicator:', error)
    }
  }, [conversationId])

  const startTyping = useCallback(() => {
    if (!isTypingRef.current) {
      isTypingRef.current = true
      sendTyping(true)
    }

    // Reset timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }

    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      isTypingRef.current = false
      sendTyping(false)
    }, 3000)
  }, [sendTyping])

  const stopTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current)
    }
    if (isTypingRef.current) {
      isTypingRef.current = false
      sendTyping(false)
    }
  }, [sendTyping])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current)
      }
    }
  }, [])

  return { startTyping, stopTyping }
}
