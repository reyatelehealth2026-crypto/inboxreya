/**
 * Hook for offline support and message queuing
 */

import { useState, useEffect, useCallback } from 'react'
import {
  isOnline,
  getQueuedMessages,
  queueMessage,
  processQueue,
  getNetworkMonitor,
  QueuedMessage,
} from '@/lib/offline'
import { useToast } from '@/hooks/use-toast'

export function useOnlineStatus() {
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Set initial status
    setOnline(isOnline())

    // Subscribe to network monitor
    const monitor = getNetworkMonitor()
    const unsubscribe = monitor.subscribe((status) => {
      setOnline(status)
    })

    return unsubscribe
  }, [])

  return online
}

export function useOfflineQueue() {
  const [queuedMessages, setQueuedMessages] = useState<QueuedMessage[]>([])
  const [isProcessing, setIsProcessing] = useState(false)
  const online = useOnlineStatus()
  const { toast } = useToast()

  // Load queued messages on mount
  useEffect(() => {
    setQueuedMessages(getQueuedMessages())
  }, [])

  const handleProcessQueue = useCallback(async () => {
    if (isProcessing) return

    setIsProcessing(true)

    try {
      // This should be implemented by the consumer
      // For now, we'll just show a toast
      toast({
        title: 'Sending queued messages...',
        description: `Processing ${queuedMessages.length} message(s)`,
        variant: 'default',
      })

      // Update queue state
      setQueuedMessages(getQueuedMessages())
    } catch (error) {
      console.error('Failed to process queue:', error)
      toast({
        title: 'Failed to send queued messages',
        description: 'Some messages could not be sent',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }, [isProcessing, queuedMessages.length, toast])

  // Process queue when coming back online
  useEffect(() => {
    if (online && queuedMessages.length > 0 && !isProcessing) {
      handleProcessQueue()
    }
  }, [online, queuedMessages.length, isProcessing, handleProcessQueue])

  const addToQueue = useCallback((
    message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>
  ) => {
    const queued = queueMessage(message)
    setQueuedMessages((prev) => [...prev, queued])

    toast({
      title: 'Message queued',
      description: 'Your message will be sent when you reconnect',
      variant: 'default',
    })

    return queued
  }, [toast])

  return {
    queuedMessages,
    addToQueue,
    processQueue: handleProcessQueue,
    isProcessing,
  }
}

/**
 * Hook for sending messages with offline support
 */
export function useOfflineMessage() {
  const online = useOnlineStatus()
  const { addToQueue } = useOfflineQueue()
  const { toast } = useToast()

  const sendMessage = useCallback(async (
    conversationId: number,
    content: string,
    sendFunction: () => Promise<any>
  ) => {
    // If offline, queue the message
    if (!online) {
      addToQueue({
        conversationId,
        content,
        type: 'text',
      })
      return null
    }

    // If online, send immediately
    try {
      return await sendFunction()
    } catch (error: any) {
      // If send fails due to network error, queue it
      if (error?.message?.includes('fetch') || error?.message?.includes('network')) {
        addToQueue({
          conversationId,
          content,
          type: 'text',
        })
        return null
      }

      // Otherwise, throw the error
      throw error
    }
  }, [online, addToQueue])

  return {
    sendMessage,
    isOnline: online,
  }
}
