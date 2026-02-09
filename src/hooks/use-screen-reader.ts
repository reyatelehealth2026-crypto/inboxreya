import { useEffect, useCallback } from 'react'
import { announceToScreenReader } from '@/lib/accessibility'

/**
 * Hook for announcing messages to screen readers
 */
export function useScreenReaderAnnouncement() {
  const announce = useCallback(
    (message: string, priority: 'polite' | 'assertive' = 'polite') => {
      announceToScreenReader(message, priority)
    },
    []
  )

  return { announce }
}

/**
 * Hook for announcing new messages to screen readers
 */
export function useNewMessageAnnouncement(messages: any[]) {
  const { announce } = useScreenReaderAnnouncement()
  const lastMessageCountRef = useRef(messages.length)

  useEffect(() => {
    // Check if new messages were added
    if (messages.length > lastMessageCountRef.current) {
      const newMessagesCount = messages.length - lastMessageCountRef.current
      const latestMessage = messages[messages.length - 1]

      // Announce new message
      if (latestMessage) {
        const sender = latestMessage.direction === 'incoming' 
          ? latestMessage.sender?.name || 'Customer'
          : 'You'
        
        const announcement = newMessagesCount === 1
          ? `New message from ${sender}`
          : `${newMessagesCount} new messages`

        announce(announcement, 'polite')
      }
    }

    lastMessageCountRef.current = messages.length
  }, [messages, announce])
}

/**
 * Hook for announcing conversation updates
 */
export function useConversationUpdateAnnouncement() {
  const { announce } = useScreenReaderAnnouncement()

  const announceStatusChange = useCallback(
    (status: string) => {
      announce(`Conversation status changed to ${status}`, 'polite')
    },
    [announce]
  )

  const announceAssigneeChange = useCallback(
    (assigneeName: string) => {
      announce(`Conversation assigned to ${assigneeName}`, 'polite')
    },
    [announce]
  )

  const announceTagAdded = useCallback(
    (tagName: string) => {
      announce(`Tag ${tagName} added`, 'polite')
    },
    [announce]
  )

  const announceTagRemoved = useCallback(
    (tagName: string) => {
      announce(`Tag ${tagName} removed`, 'polite')
    },
    [announce]
  )

  return {
    announceStatusChange,
    announceAssigneeChange,
    announceTagAdded,
    announceTagRemoved,
  }
}

// Import useRef
import { useRef } from 'react'
