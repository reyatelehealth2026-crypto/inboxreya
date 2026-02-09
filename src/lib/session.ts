/**
 * Session Management
 * Handles session expiration, data preservation, and graceful redirects
 */

import { signOut } from 'next-auth/react'

const UNSENT_MESSAGES_KEY = 'inbox-unsent-messages'
const DRAFT_MESSAGES_KEY = 'inbox-draft-messages'
const FORM_DATA_KEY = 'inbox-form-data'

function logLocalStorageError(operation: string, message: string, error: unknown): void {
  const errorDetails =
    error instanceof Error ? `${error.message} (stack: ${error.stack ?? 'N/A'})` : String(error)
  console.error(`[session-storage:${operation}] ${message}: ${errorDetails}`, error)
}

// ============================================================================
// Unsent Messages Management
// ============================================================================

export interface UnsentMessage {
  conversationId: number
  content: string
  timestamp: number
}

/**
 * Save unsent message to localStorage
 */
export function saveUnsentMessage(conversationId: number, content: string): void {
  if (typeof window === 'undefined' || !content.trim()) return

  try {
    const messages = getUnsentMessages()
    
    // Remove existing message for this conversation
    const filtered = messages.filter((m) => m.conversationId !== conversationId)
    
    // Add new message
    filtered.push({
      conversationId,
      content,
      timestamp: Date.now(),
    })

    localStorage.setItem(UNSENT_MESSAGES_KEY, JSON.stringify(filtered))
  } catch (error) {
    logLocalStorageError('saveUnsentMessage', 'Failed to save unsent message', error)
  }
}

/**
 * Get all unsent messages
 */
export function getUnsentMessages(): UnsentMessage[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(UNSENT_MESSAGES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    logLocalStorageError('getUnsentMessages', 'Failed to get unsent messages', error)
    return []
  }
}

/**
 * Get unsent message for specific conversation
 */
export function getUnsentMessage(conversationId: number): string | null {
  const messages = getUnsentMessages()
  const message = messages.find((m) => m.conversationId === conversationId)
  return message?.content || null
}

/**
 * Remove unsent message
 */
export function removeUnsentMessage(conversationId: number): void {
  if (typeof window === 'undefined') return

  try {
    const messages = getUnsentMessages()
    const filtered = messages.filter((m) => m.conversationId !== conversationId)
    localStorage.setItem(UNSENT_MESSAGES_KEY, JSON.stringify(filtered))
  } catch (error) {
    logLocalStorageError('removeUnsentMessage', 'Failed to remove unsent message', error)
  }
}

/**
 * Clear all unsent messages
 */
export function clearUnsentMessages(): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(UNSENT_MESSAGES_KEY)
  } catch (error) {
    logLocalStorageError('clearUnsentMessages', 'Failed to clear unsent messages', error)
  }
}

// ============================================================================
// Draft Messages Management
// ============================================================================

export interface DraftMessage {
  conversationId: number
  content: string
  timestamp: number
}

/**
 * Save draft message
 */
export function saveDraftMessage(conversationId: number, content: string): void {
  if (typeof window === 'undefined') return

  try {
    const drafts = getDraftMessages()
    
    // Remove existing draft for this conversation
    const filtered = drafts.filter((d) => d.conversationId !== conversationId)
    
    // Add new draft if content is not empty
    if (content.trim()) {
      filtered.push({
        conversationId,
        content,
        timestamp: Date.now(),
      })
    }

    localStorage.setItem(DRAFT_MESSAGES_KEY, JSON.stringify(filtered))
  } catch (error) {
    logLocalStorageError('saveDraftMessage', 'Failed to save draft message', error)
  }
}

/**
 * Get all draft messages
 */
export function getDraftMessages(): DraftMessage[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(DRAFT_MESSAGES_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    logLocalStorageError('getDraftMessages', 'Failed to get draft messages', error)
    return []
  }
}

/**
 * Get draft message for specific conversation
 */
export function getDraftMessage(conversationId: number): string | null {
  const drafts = getDraftMessages()
  const draft = drafts.find((d) => d.conversationId === conversationId)
  return draft?.content || null
}

/**
 * Remove draft message
 */
export function removeDraftMessage(conversationId: number): void {
  if (typeof window === 'undefined') return

  try {
    const drafts = getDraftMessages()
    const filtered = drafts.filter((d) => d.conversationId !== conversationId)
    localStorage.setItem(DRAFT_MESSAGES_KEY, JSON.stringify(filtered))
  } catch (error) {
    logLocalStorageError('removeDraftMessage', 'Failed to remove draft message', error)
  }
}

// ============================================================================
// Form Data Preservation
// ============================================================================

/**
 * Save form data to localStorage
 */
export function saveFormData(formId: string, data: Record<string, any>): void {
  if (typeof window === 'undefined') return

  try {
    const allFormData = getAllFormData()
    allFormData[formId] = {
      data,
      timestamp: Date.now(),
    }
    localStorage.setItem(FORM_DATA_KEY, JSON.stringify(allFormData))
  } catch (error) {
    logLocalStorageError('saveFormData', 'Failed to save form data', error)
  }
}

/**
 * Get form data from localStorage
 */
export function getFormData(formId: string): Record<string, any> | null {
  if (typeof window === 'undefined') return null

  try {
    const allFormData = getAllFormData()
    return allFormData[formId]?.data || null
  } catch (error) {
    logLocalStorageError('getFormData', 'Failed to get form data', error)
    return null
  }
}

/**
 * Remove form data
 */
export function removeFormData(formId: string): void {
  if (typeof window === 'undefined') return

  try {
    const allFormData = getAllFormData()
    delete allFormData[formId]
    localStorage.setItem(FORM_DATA_KEY, JSON.stringify(allFormData))
  } catch (error) {
    logLocalStorageError('removeFormData', 'Failed to remove form data', error)
  }
}

/**
 * Get all form data
 */
function getAllFormData(): Record<string, { data: Record<string, any>; timestamp: number }> {
  if (typeof window === 'undefined') return {}

  try {
    const stored = localStorage.getItem(FORM_DATA_KEY)
    return stored ? JSON.parse(stored) : {}
  } catch (error) {
    logLocalStorageError('getAllFormData', 'Failed to get all form data', error)
    return {}
  }
}

// ============================================================================
// Session Expiration Handling
// ============================================================================

/**
 * Handle session expiration gracefully
 * Saves current state and redirects to login
 */
export async function handleSessionExpiration(options?: {
  saveCurrentMessage?: boolean
  conversationId?: number
  messageContent?: string
  redirectUrl?: string
}): Promise<void> {
  // Save unsent message if provided
  if (options?.saveCurrentMessage && options.conversationId && options.messageContent) {
    saveUnsentMessage(options.conversationId, options.messageContent)
  }

  // Save redirect URL
  if (options?.redirectUrl) {
    if (typeof window !== 'undefined') {
      sessionStorage.setItem('inbox-redirect-after-login', options.redirectUrl)
    }
  }

  // Sign out and redirect to login
  await signOut({
    callbackUrl: '/auth/login',
    redirect: true,
  })
}

/**
 * Get redirect URL after login
 */
export function getRedirectAfterLogin(): string | null {
  if (typeof window === 'undefined') return null

  try {
    const url = sessionStorage.getItem('inbox-redirect-after-login')
    if (url) {
      sessionStorage.removeItem('inbox-redirect-after-login')
    }
    return url
  } catch (error) {
    logLocalStorageError('getRedirectAfterLogin', 'Failed to get redirect URL', error)
    return null
  }
}

/**
 * Check if session is expired based on token
 */
export function isSessionExpired(expiresAt?: number | string): boolean {
  if (!expiresAt) return false

  const expiryTime = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt
  return Date.now() >= expiryTime
}

/**
 * Get time until session expires (in milliseconds)
 */
export function getTimeUntilExpiry(expiresAt?: number | string): number {
  if (!expiresAt) return 0

  const expiryTime = typeof expiresAt === 'string' ? new Date(expiresAt).getTime() : expiresAt
  return Math.max(0, expiryTime - Date.now())
}

/**
 * Format time until expiry as human-readable string
 */
export function formatTimeUntilExpiry(expiresAt?: number | string): string {
  const ms = getTimeUntilExpiry(expiresAt)
  
  if (ms === 0) return 'Expired'

  const minutes = Math.floor(ms / 60000)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (days > 0) return `${days} day${days > 1 ? 's' : ''}`
  if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''}`
  if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''}`
  
  return 'Less than a minute'
}

// ============================================================================
// Cleanup Old Data
// ============================================================================

/**
 * Clean up old unsent messages and drafts (older than 7 days)
 */
export function cleanupOldData(): void {
  if (typeof window === 'undefined') return

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  try {
    // Clean up unsent messages
    const unsentMessages = getUnsentMessages()
    const recentUnsent = unsentMessages.filter((m) => m.timestamp > sevenDaysAgo)
    localStorage.setItem(UNSENT_MESSAGES_KEY, JSON.stringify(recentUnsent))

    // Clean up draft messages
    const draftMessages = getDraftMessages()
    const recentDrafts = draftMessages.filter((d) => d.timestamp > sevenDaysAgo)
    localStorage.setItem(DRAFT_MESSAGES_KEY, JSON.stringify(recentDrafts))

    // Clean up form data
    const allFormData = getAllFormData()
    const recentFormData: typeof allFormData = {}
    Object.entries(allFormData).forEach(([key, value]) => {
      if (value.timestamp > sevenDaysAgo) {
        recentFormData[key] = value
      }
    })
    localStorage.setItem(FORM_DATA_KEY, JSON.stringify(recentFormData))
  } catch (error) {
    logLocalStorageError('cleanupOldData', 'Failed to cleanup old data', error)
  }
}

// Run cleanup on load
if (typeof window !== 'undefined') {
  cleanupOldData()
}
