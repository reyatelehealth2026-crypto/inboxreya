/**
 * Hook for session management
 */

import { useEffect, useState, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import {
  handleSessionExpiration,
  saveUnsentMessage,
  getUnsentMessage,
  removeUnsentMessage,
  saveDraftMessage,
  getDraftMessage,
  isSessionExpired,
  getTimeUntilExpiry,
} from '@/lib/session'
import { useToast } from '@/hooks/use-toast'

/**
 * Hook for monitoring session expiration
 */
export function useSessionMonitor() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const { toast } = useToast()
  const [timeUntilExpiry, setTimeUntilExpiry] = useState<number>(0)

  useEffect(() => {
    if (status !== 'authenticated' || !session?.expires) return

    // Check if session is already expired
    if (isSessionExpired(session.expires)) {
      handleSessionExpiration()
      return
    }

    // Update time until expiry every minute
    const interval = setInterval(() => {
      const time = getTimeUntilExpiry(session.expires)
      setTimeUntilExpiry(time)

      // Show warning 5 minutes before expiry
      if (time > 0 && time <= 5 * 60 * 1000 && time > 4 * 60 * 1000) {
        toast({
          title: 'Session Expiring Soon',
          description: 'Your session will expire in 5 minutes. Please save your work.',
          variant: 'default',
        })
      }

      // Handle expiration
      if (time === 0) {
        handleSessionExpiration()
      }
    }, 60000) // Check every minute

    return () => clearInterval(interval)
  }, [session, status, router, toast])

  return {
    isExpired: timeUntilExpiry === 0,
    timeUntilExpiry,
    isAuthenticated: status === 'authenticated',
  }
}

/**
 * Hook for preserving unsent messages
 */
export function useUnsentMessages(conversationId: number) {
  const [unsentMessage, setUnsentMessage] = useState<string | null>(null)

  // Load unsent message on mount
  useEffect(() => {
    const message = getUnsentMessage(conversationId)
    if (message) {
      setUnsentMessage(message)
    }
  }, [conversationId])

  const saveMessage = useCallback((content: string) => {
    saveUnsentMessage(conversationId, content)
    setUnsentMessage(content)
  }, [conversationId])

  const clearMessage = useCallback(() => {
    removeUnsentMessage(conversationId)
    setUnsentMessage(null)
  }, [conversationId])

  return {
    unsentMessage,
    saveMessage,
    clearMessage,
    hasUnsentMessage: !!unsentMessage,
  }
}

/**
 * Hook for draft messages
 */
export function useDraftMessage(conversationId: number) {
  const [draft, setDraft] = useState<string>('')

  // Load draft on mount
  useEffect(() => {
    const savedDraft = getDraftMessage(conversationId)
    if (savedDraft) {
      setDraft(savedDraft)
    }
  }, [conversationId])

  // Auto-save draft
  useEffect(() => {
    const timer = setTimeout(() => {
      saveDraftMessage(conversationId, draft)
    }, 1000) // Debounce 1 second

    return () => clearTimeout(timer)
  }, [conversationId, draft])

  const updateDraft = useCallback((content: string) => {
    setDraft(content)
  }, [])

  const clearDraft = useCallback(() => {
    setDraft('')
    saveDraftMessage(conversationId, '')
  }, [conversationId])

  return {
    draft,
    updateDraft,
    clearDraft,
    hasDraft: draft.length > 0,
  }
}

/**
 * Hook for handling session expiration with data preservation
 */
export function useSessionExpiration() {
  const router = useRouter()
  const { toast } = useToast()

  const handleExpiration = useCallback(async (options?: {
    conversationId?: number
    messageContent?: string
    redirectUrl?: string
  }) => {
    // Show toast notification
    toast({
      title: 'Session Expired',
      description: 'Your session has expired. Redirecting to login...',
      variant: 'default',
    })

    // Handle expiration with data preservation
    await handleSessionExpiration({
      saveCurrentMessage: true,
      ...options,
    })
  }, [toast])

  return { handleExpiration }
}
