/**
 * Offline Support and Message Queue
 * Handles offline detection and queues messages for later sending
 */

export interface QueuedMessage {
  id: string
  conversationId: number
  content: string
  type: 'text' | 'image' | 'file'
  metadata?: Record<string, any>
  timestamp: number
  retryCount: number
}

const QUEUE_STORAGE_KEY = 'inbox-message-queue'
const MAX_RETRY_COUNT = 3

/**
 * Check if browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true
}

/**
 * Get queued messages from localStorage
 */
export function getQueuedMessages(): QueuedMessage[] {
  if (typeof window === 'undefined') return []

  try {
    const stored = localStorage.getItem(QUEUE_STORAGE_KEY)
    return stored ? JSON.parse(stored) : []
  } catch (error) {
    console.error('Failed to get queued messages:', error)
    return []
  }
}

/**
 * Save queued messages to localStorage
 */
export function saveQueuedMessages(messages: QueuedMessage[]): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(messages))
  } catch (error) {
    console.error('Failed to save queued messages:', error)
  }
}

/**
 * Add message to queue
 */
export function queueMessage(message: Omit<QueuedMessage, 'id' | 'timestamp' | 'retryCount'>): QueuedMessage {
  const queuedMessage: QueuedMessage = {
    ...message,
    id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    timestamp: Date.now(),
    retryCount: 0,
  }

  const messages = getQueuedMessages()
  messages.push(queuedMessage)
  saveQueuedMessages(messages)

  return queuedMessage
}

/**
 * Remove message from queue
 */
export function removeQueuedMessage(messageId: string): void {
  const messages = getQueuedMessages()
  const filtered = messages.filter((m) => m.id !== messageId)
  saveQueuedMessages(filtered)
}

/**
 * Update message retry count
 */
export function incrementRetryCount(messageId: string): void {
  const messages = getQueuedMessages()
  const updated = messages.map((m) =>
    m.id === messageId ? { ...m, retryCount: m.retryCount + 1 } : m
  )
  saveQueuedMessages(updated)
}

/**
 * Clear all queued messages
 */
export function clearQueue(): void {
  saveQueuedMessages([])
}

/**
 * Get messages that should be retried
 */
export function getRetryableMessages(): QueuedMessage[] {
  const messages = getQueuedMessages()
  return messages.filter((m) => m.retryCount < MAX_RETRY_COUNT)
}

/**
 * Get failed messages (exceeded retry count)
 */
export function getFailedMessages(): QueuedMessage[] {
  const messages = getQueuedMessages()
  return messages.filter((m) => m.retryCount >= MAX_RETRY_COUNT)
}

/**
 * Process queued messages
 * Returns array of successfully sent message IDs
 */
export async function processQueue(
  sendFunction: (message: QueuedMessage) => Promise<void>
): Promise<{ success: string[]; failed: string[] }> {
  const messages = getRetryableMessages()
  const success: string[] = []
  const failed: string[] = []

  for (const message of messages) {
    try {
      await sendFunction(message)
      removeQueuedMessage(message.id)
      success.push(message.id)
    } catch (error) {
      console.error('Failed to send queued message:', error)
      incrementRetryCount(message.id)
      failed.push(message.id)
    }
  }

  return { success, failed }
}

/**
 * Offline event listeners
 */
export type OfflineEventListener = (isOnline: boolean) => void

const listeners: Set<OfflineEventListener> = new Set()

/**
 * Subscribe to online/offline events
 */
export function subscribeToOnlineStatus(listener: OfflineEventListener): () => void {
  listeners.add(listener)

  // Set up browser event listeners if not already done
  if (typeof window !== 'undefined' && listeners.size === 1) {
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
  }

  // Return unsubscribe function
  return () => {
    listeners.delete(listener)

    // Clean up browser event listeners if no more subscribers
    if (listeners.size === 0 && typeof window !== 'undefined') {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }
}

function handleOnline() {
  listeners.forEach((listener) => listener(true))
}

function handleOffline() {
  listeners.forEach((listener) => listener(false))
}

/**
 * Network status monitor
 */
export class NetworkMonitor {
  private isOnline: boolean = true
  private listeners: Set<(isOnline: boolean) => void> = new Set()
  private checkInterval: NodeJS.Timeout | null = null

  constructor() {
    if (typeof window !== 'undefined') {
      this.isOnline = navigator.onLine
      this.startMonitoring()
    }
  }

  private startMonitoring() {
    // Listen to browser events
    window.addEventListener('online', this.handleOnline)
    window.addEventListener('offline', this.handleOffline)

    // Periodic connectivity check (every 30 seconds)
    this.checkInterval = setInterval(() => {
      this.checkConnectivity()
    }, 30000)
  }

  private handleOnline = () => {
    if (!this.isOnline) {
      this.isOnline = true
      this.notifyListeners()
    }
  }

  private handleOffline = () => {
    if (this.isOnline) {
      this.isOnline = false
      this.notifyListeners()
    }
  }

  private async checkConnectivity() {
    try {
      // Try to fetch a small resource to verify connectivity
      const response = await fetch('/api/health', {
        method: 'HEAD',
        cache: 'no-cache',
      })

      const wasOnline = this.isOnline
      this.isOnline = response.ok

      if (wasOnline !== this.isOnline) {
        this.notifyListeners()
      }
    } catch (error) {
      const wasOnline = this.isOnline
      this.isOnline = false

      if (wasOnline !== this.isOnline) {
        this.notifyListeners()
      }
    }
  }

  private notifyListeners() {
    this.listeners.forEach((listener) => listener(this.isOnline))
  }

  public subscribe(listener: (isOnline: boolean) => void): () => void {
    this.listeners.add(listener)

    // Immediately notify with current status
    listener(this.isOnline)

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener)
    }
  }

  public getStatus(): boolean {
    return this.isOnline
  }

  public destroy() {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline)
      window.removeEventListener('offline', this.handleOffline)
    }

    if (this.checkInterval) {
      clearInterval(this.checkInterval)
    }

    this.listeners.clear()
  }
}

// Singleton instance
let networkMonitor: NetworkMonitor | null = null

export function getNetworkMonitor(): NetworkMonitor {
  if (!networkMonitor) {
    networkMonitor = new NetworkMonitor()
  }
  return networkMonitor
}
