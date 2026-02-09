/**
 * Accessibility utilities for screen readers and ARIA support
 */

/**
 * Announce a message to screen readers
 */
export function announceToScreenReader(message: string, priority: 'polite' | 'assertive' = 'polite') {
  // Create or get the live region element
  let liveRegion = document.getElementById('screen-reader-announcements')
  
  if (!liveRegion) {
    liveRegion = document.createElement('div')
    liveRegion.id = 'screen-reader-announcements'
    liveRegion.setAttribute('role', 'status')
    liveRegion.setAttribute('aria-live', priority)
    liveRegion.setAttribute('aria-atomic', 'true')
    liveRegion.className = 'sr-only'
    document.body.appendChild(liveRegion)
  }

  // Update the aria-live priority if needed
  if (liveRegion.getAttribute('aria-live') !== priority) {
    liveRegion.setAttribute('aria-live', priority)
  }

  // Clear and set new message
  liveRegion.textContent = ''
  setTimeout(() => {
    liveRegion!.textContent = message
  }, 100)
}

/**
 * Generate ARIA label for conversation item
 */
export function getConversationAriaLabel(conversation: {
  customer?: { displayName?: string }
  unreadCount?: number
  status?: string
  lastMessage?: { content?: string }
  lastMessageAt?: Date | string
}): string {
  const parts: string[] = []

  // Customer name
  if (conversation.customer?.displayName) {
    parts.push(`Conversation with ${conversation.customer.displayName}`)
  } else {
    parts.push('Conversation')
  }

  // Unread count
  if (conversation.unreadCount && conversation.unreadCount > 0) {
    parts.push(`${conversation.unreadCount} unread message${conversation.unreadCount > 1 ? 's' : ''}`)
  }

  // Status
  if (conversation.status) {
    parts.push(`Status: ${conversation.status}`)
  }

  // Last message preview
  if (conversation.lastMessage?.content) {
    const preview = conversation.lastMessage.content.slice(0, 50)
    parts.push(`Last message: ${preview}`)
  }

  return parts.join(', ')
}

/**
 * Generate ARIA label for message
 */
export function getMessageAriaLabel(message: {
  sender?: { name?: string }
  direction?: 'incoming' | 'outgoing'
  content?: string
  type?: string
  createdAt?: Date | string
}): string {
  const parts: string[] = []

  // Sender
  if (message.direction === 'incoming') {
    parts.push(`Message from ${message.sender?.name || 'customer'}`)
  } else {
    parts.push(`Message from ${message.sender?.name || 'you'}`)
  }

  // Content
  if (message.type === 'text' && message.content) {
    parts.push(message.content)
  } else if (message.type === 'image') {
    parts.push('Image message')
  } else if (message.type === 'file') {
    parts.push('File attachment')
  }

  // Time
  if (message.createdAt) {
    const date = new Date(message.createdAt)
    parts.push(`sent at ${date.toLocaleTimeString()}`)
  }

  return parts.join(', ')
}

/**
 * Generate ARIA label for button with icon
 */
export function getIconButtonAriaLabel(action: string, context?: string): string {
  if (context) {
    return `${action} ${context}`
  }
  return action
}

/**
 * Check if user prefers reduced motion
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

/**
 * Check if user prefers high contrast
 */
export function prefersHighContrast(): boolean {
  if (typeof window === 'undefined') return false
  return window.matchMedia('(prefers-contrast: high)').matches
}

/**
 * Get appropriate focus ring classes based on user preferences
 */
export function getFocusRingClasses(): string {
  const baseClasses = 'focus:outline-none focus:ring-2 focus:ring-offset-2'
  
  if (prefersHighContrast()) {
    return `${baseClasses} focus:ring-black focus:ring-offset-white`
  }
  
  return `${baseClasses} focus:ring-blue-500 focus:ring-offset-white`
}

/**
 * Get appropriate transition classes based on user preferences
 */
export function getTransitionClasses(defaultClasses: string = 'transition-all duration-200'): string {
  if (prefersReducedMotion()) {
    return 'transition-none'
  }
  return defaultClasses
}

/**
 * ARIA roles for common inbox components
 */
export const ARIA_ROLES = {
  conversationList: 'list',
  conversationItem: 'listitem',
  messageList: 'log',
  message: 'article',
  searchBox: 'searchbox',
  navigation: 'navigation',
  main: 'main',
  complementary: 'complementary',
  dialog: 'dialog',
  alertdialog: 'alertdialog',
  status: 'status',
  alert: 'alert',
} as const

/**
 * ARIA live region priorities
 */
export const ARIA_LIVE = {
  polite: 'polite',
  assertive: 'assertive',
  off: 'off',
} as const

/**
 * Common ARIA labels
 */
export const ARIA_LABELS = {
  closeDialog: 'Close dialog',
  openMenu: 'Open menu',
  search: 'Search conversations',
  sendMessage: 'Send message',
  attachFile: 'Attach file',
  openEmoji: 'Open emoji picker',
  markAsRead: 'Mark as read',
  markAsUnread: 'Mark as unread',
  deleteMessage: 'Delete message',
  editMessage: 'Edit message',
  replyToMessage: 'Reply to message',
  loadMore: 'Load more messages',
  previousConversation: 'Previous conversation',
  nextConversation: 'Next conversation',
} as const
