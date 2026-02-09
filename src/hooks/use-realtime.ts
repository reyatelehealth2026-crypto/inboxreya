"use client"

import { useEffect, useRef, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import type { SSEEvent, NewMessageEvent, ConversationUpdateEvent, TypingEvent } from '@/types'
import { useChatStore } from '@/stores/chat'
import { useRealtimeStore } from '@/stores/realtime'
import { queryKeys } from '@/lib/query-keys'

interface UseRealtimeOptions {
  onNewMessage?: (event: NewMessageEvent) => void
  onConversationUpdate?: (event: ConversationUpdateEvent) => void
  onTyping?: (event: TypingEvent) => void
  enabled?: boolean
}

export function useRealtime(options: UseRealtimeOptions = {}) {
  const { onNewMessage, onConversationUpdate, onTyping, enabled = true } = options
  const queryClient = useQueryClient()
  const eventSourceRef = useRef<EventSource | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null)
  const lastEventAtRef = useRef<number | null>(null)
  const reconnectAttemptsRef = useRef(0)
  const connectRef = useRef<() => void>(() => {})
  const { addTypingUser, removeTypingUser } = useChatStore()
  const {
    isConnected,
    error,
    setConnected,
    setError,
    setLastEventAt,
    setReconnectAttempts,
  } = useRealtimeStore()

  const scheduleReconnect = useCallback((reason: string) => {
    if (!enabled) return
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }

    const attempts = reconnectAttemptsRef.current + 1
    reconnectAttemptsRef.current = attempts
    setReconnectAttempts(attempts)

    const delay = Math.min(30000, 1000 * 2 ** Math.min(attempts, 5))
    console.warn(`SSE reconnect scheduled (${reason}) in ${delay}ms`)
    reconnectTimeoutRef.current = setTimeout(() => {
      connectRef.current()
    }, delay)
  }, [enabled, setReconnectAttempts])

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return

    try {
      const eventSource = new EventSource('/api/inbox/realtime')
      eventSourceRef.current = eventSource

      eventSource.onopen = () => {
        setConnected(true)
        setError(null)
        reconnectAttemptsRef.current = 0
        setReconnectAttempts(0)
        lastEventAtRef.current = Date.now()
        setLastEventAt(lastEventAtRef.current)
        console.log('SSE connected')
      }

      eventSource.onmessage = (event) => {
        try {
          lastEventAtRef.current = Date.now()
          setLastEventAt(lastEventAtRef.current)
          const data: SSEEvent = JSON.parse(event.data)

          switch (data.type) {
            case 'new_message':
              const messageEvent = data.data as NewMessageEvent
              // Invalidate queries
              queryClient.invalidateQueries({
                queryKey: queryKeys.messagesForUser(messageEvent.conversationId),
              })
              queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
              onNewMessage?.(messageEvent)
              break

            case 'conversation_update':
              const updateEvent = data.data as ConversationUpdateEvent
              queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
              onConversationUpdate?.(updateEvent)
              break

            case 'typing':
              const typingEvent = data.data as TypingEvent
              if (typingEvent.isTyping) {
                addTypingUser(typingEvent.conversationId, {
                  id: typingEvent.userId,
                  name: typingEvent.userName,
                  timestamp: Date.now(),
                })
              } else {
                removeTypingUser(typingEvent.conversationId, typingEvent.userId)
              }
              onTyping?.(typingEvent)
              break
            
            case 'read_receipt':
              const readEvent = data.data as { conversationId: string }
              queryClient.invalidateQueries({
                queryKey: queryKeys.messagesForUser(readEvent.conversationId),
              })
              queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
              break

            case 'assignment_change':
              queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
              break

            case 'ping':
              // Keep-alive ping, ignore
              break

            default:
              console.log('Unknown SSE event:', data.type)
          }
        } catch (err) {
          console.error('Error parsing SSE message:', err)
        }
      }

      eventSource.onerror = (err) => {
        // Only log warning, as reconnection is automatic
        console.warn('SSE connection lost, reconnecting...')
        setConnected(false)
        setError('Connection lost')
        eventSource.close()
        eventSourceRef.current = null

        scheduleReconnect('error')
      }
    } catch (err) {
      console.error('Failed to connect SSE:', err)
      setError('Failed to connect')
    }
  }, [
    enabled,
    queryClient,
    onNewMessage,
    onConversationUpdate,
    onTyping,
    addTypingUser,
    removeTypingUser,
    setConnected,
    setError,
    setLastEventAt,
    setReconnectAttempts,
    scheduleReconnect,
  ])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
      reconnectTimeoutRef.current = null
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
      heartbeatIntervalRef.current = null
    }
    setConnected(false)
    setLastEventAt(null)
  }, [setConnected, setLastEventAt])

  useEffect(() => {
    connectRef.current = connect
    if (enabled) {
      connect()
    } else {
      disconnect()
    }

    return () => {
      disconnect()
    }
  }, [enabled, connect, disconnect])

  useEffect(() => {
    if (!enabled || !eventSourceRef.current) return

    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current)
    }

    heartbeatIntervalRef.current = setInterval(() => {
      if (!eventSourceRef.current) return
      const lastEventAt = lastEventAtRef.current
      if (!lastEventAt) return
      if (Date.now() - lastEventAt > 45000) {
        console.warn('SSE heartbeat timeout, reconnecting')
        eventSourceRef.current.close()
        eventSourceRef.current = null
        setConnected(false)
        scheduleReconnect('heartbeat')
      }
    }, 15000)

    return () => {
      if (heartbeatIntervalRef.current) {
        clearInterval(heartbeatIntervalRef.current)
        heartbeatIntervalRef.current = null
      }
    }
  }, [enabled, setConnected, scheduleReconnect])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const handleOnline = () => {
      if (!eventSourceRef.current) {
        scheduleReconnect('online')
      }
    }
    window.addEventListener('online', handleOnline)
    return () => window.removeEventListener('online', handleOnline)
  }, [scheduleReconnect])

  return {
    isConnected,
    error,
    reconnect: connect,
    disconnect,
  }
}

// Hook for sending typing indicators
export function useTypingIndicator(conversationId: string | null) {
  const timeoutRef = useRef<NodeJS.Timeout | null>(null)
  const isTypingRef = useRef(false)

  const sendTyping = useCallback(async (isTyping: boolean) => {
    if (!conversationId || isTypingRef.current === isTyping) return

    isTypingRef.current = isTyping

    try {
      await fetch('/api/inbox/typing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, isTyping }),
      })
    } catch (err) {
      console.error('Failed to send typing indicator:', err)
    }
  }, [conversationId])

  const startTyping = useCallback(() => {
    sendTyping(true)

    // Auto-stop after 5 seconds of inactivity
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
    }
    timeoutRef.current = setTimeout(() => {
      sendTyping(false)
    }, 5000)
  }, [sendTyping])

  const stopTyping = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    sendTyping(false)
  }, [sendTyping])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
      }
      if (isTypingRef.current) {
        sendTyping(false)
      }
    }
  }, [sendTyping])

  return { startTyping, stopTyping }
}
