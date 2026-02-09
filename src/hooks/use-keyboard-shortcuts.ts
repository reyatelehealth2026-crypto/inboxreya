import { useEffect, useCallback, useRef } from 'react'
import { useSettingsStore, KeyboardShortcut } from '@/stores/settings'
import { useInboxStore } from '@/stores/inbox'
import { useChatStore } from '@/stores/chat'

interface KeyboardShortcutHandler {
  action: string
  handler: () => void
  enabled?: boolean
}

/**
 * Check if a keyboard event matches a shortcut definition
 */
function matchesShortcut(event: KeyboardEvent, shortcut: KeyboardShortcut): boolean {
  // Check key match (case-insensitive for letters)
  const keyMatch = event.key.toLowerCase() === shortcut.key.toLowerCase()

  // Check modifiers
  // We treat Meta (Cmd) and Ctrl as equivalent for the "ctrl" property
  // to support both Windows/Linux and Mac conventions
  const isCtrlPressed = event.ctrlKey || event.metaKey
  const ctrlMatch = shortcut.ctrl ? isCtrlPressed : !isCtrlPressed

  const shiftMatch = shortcut.shift ? event.shiftKey : !event.shiftKey
  const altMatch = shortcut.alt ? event.altKey : !event.altKey

  // Explicit meta check if needed
  const metaMatch = shortcut.meta ? event.metaKey : true

  return keyMatch && ctrlMatch && shiftMatch && altMatch && metaMatch
}

/**
 * Hook for managing keyboard shortcuts in the inbox
 */
export function useKeyboardShortcuts(handlers: KeyboardShortcutHandler[]) {
  const shortcuts = useSettingsStore((state) => state.shortcuts)
  const handlersRef = useRef(handlers)

  // Update handlers ref when they change
  useEffect(() => {
    handlersRef.current = handlers
  }, [handlers])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in input fields (except for specific shortcuts)
      const target = event.target as HTMLElement
      const isInputField =
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable

      // Check each handler
      for (const handler of handlersRef.current) {
        // Skip if handler is disabled
        if (handler.enabled === false) continue

        // Get the shortcut definition
        const shortcutKey = handler.action as keyof typeof shortcuts
        const shortcut = shortcuts[shortcutKey]

        if (!shortcut) continue

        // Check if event matches shortcut
        if (matchesShortcut(event, shortcut)) {
          // Special handling for input-specific shortcuts
          const isInputSpecificShortcut = [
            'sendMessage',
          ].includes(handler.action)

          // Allow input-specific shortcuts in input fields
          // Block other shortcuts in input fields
          if (isInputField && !isInputSpecificShortcut) {
            continue
          }

          // Prevent default behavior
          event.preventDefault()
          event.stopPropagation()

          // Execute handler
          handler.handler()
          break
        }
      }
    }

    // Add event listener
    document.addEventListener('keydown', handleKeyDown)

    // Cleanup
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [shortcuts])
}

/**
 * Hook for inbox-specific keyboard shortcuts
 */
export function useInboxKeyboardShortcuts(options: {
  onSendMessage?: () => void
  onSearchConversations?: () => void
  onOpenTemplatePicker?: () => void
  onMarkAsResolved?: () => void
  onShowShortcutsHelp?: () => void
  onNavigateUp?: () => void
  onNavigateDown?: () => void
  onOpenEmojiPicker?: () => void
  enabled?: boolean
}) {
  const handlers: KeyboardShortcutHandler[] = [
    {
      action: 'sendMessage',
      handler: () => options.onSendMessage?.(),
      enabled: options.enabled !== false && !!options.onSendMessage,
    },
    {
      action: 'searchConversations',
      handler: () => options.onSearchConversations?.(),
      enabled: options.enabled !== false && !!options.onSearchConversations,
    },
    {
      action: 'openTemplatePicker',
      handler: () => options.onOpenTemplatePicker?.(),
      enabled: options.enabled !== false && !!options.onOpenTemplatePicker,
    },
    {
      action: 'markAsResolved',
      handler: () => options.onMarkAsResolved?.(),
      enabled: options.enabled !== false && !!options.onMarkAsResolved,
    },
    {
      action: 'showShortcutsHelp',
      handler: () => options.onShowShortcutsHelp?.(),
      enabled: options.enabled !== false && !!options.onShowShortcutsHelp,
    },
    {
      action: 'navigateUp',
      handler: () => options.onNavigateUp?.(),
      enabled: options.enabled !== false && !!options.onNavigateUp,
    },
    {
      action: 'navigateDown',
      handler: () => options.onNavigateDown?.(),
      enabled: options.enabled !== false && !!options.onNavigateDown,
    },
    {
      action: 'openEmojiPicker',
      handler: () => options.onOpenEmojiPicker?.(),
      enabled: options.enabled !== false && !!options.onOpenEmojiPicker,
    },
  ]

  useKeyboardShortcuts(handlers)
}

/**
 * Hook for text expansion in message input
 */
export function useTextExpansion(
  value: string,
  onChange: (value: string) => void
) {
  const textExpansions = useSettingsStore((state) => state.textExpansions)
  const lastValueRef = useRef(value)

  useEffect(() => {
    // Check if value changed (user typed something)
    if (value === lastValueRef.current) return
    lastValueRef.current = value

    // Check for text expansion triggers
    for (const expansion of textExpansions) {
      if (value.endsWith(expansion.trigger)) {
        // Replace trigger with expansion
        const newValue = value.slice(0, -expansion.trigger.length) + expansion.replacement
        onChange(newValue)
        break
      }
    }
  }, [value, textExpansions, onChange])
}

/**
 * Format shortcut for display
 */
export function formatShortcut(shortcut: KeyboardShortcut): string {
  const parts: string[] = []

  if (shortcut.ctrl) parts.push('Ctrl')
  if (shortcut.shift) parts.push('Shift')
  if (shortcut.alt) parts.push('Alt')
  if (shortcut.meta) parts.push('⌘')

  // Format key name
  let keyName = shortcut.key
  if (keyName === 'ArrowUp') keyName = '↑'
  else if (keyName === 'ArrowDown') keyName = '↓'
  else if (keyName === 'ArrowLeft') keyName = '←'
  else if (keyName === 'ArrowRight') keyName = '→'
  else if (keyName === 'Enter') keyName = '↵'
  else if (keyName === ' ') keyName = 'Space'
  else keyName = keyName.toUpperCase()

  parts.push(keyName)

  return parts.join('+')
}
