import { useEffect, useRef, useCallback } from 'react'

/**
 * Hook for managing focus trap in modals/dialogs
 */
export function useFocusTrap(isActive: boolean) {
  const containerRef = useRef<HTMLElement>(null)

  useEffect(() => {
    if (!isActive || !containerRef.current) return

    const container = containerRef.current
    const focusableElements = container.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    )

    const firstElement = focusableElements[0]
    const lastElement = focusableElements[focusableElements.length - 1]

    // Focus first element when trap activates
    firstElement?.focus()

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault()
          lastElement?.focus()
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault()
          firstElement?.focus()
        }
      }
    }

    container.addEventListener('keydown', handleTabKey)

    return () => {
      container.removeEventListener('keydown', handleTabKey)
    }
  }, [isActive])

  return containerRef
}

/**
 * Hook for managing focus restoration
 */
export function useFocusRestore() {
  const previousActiveElement = useRef<HTMLElement | null>(null)

  const saveFocus = useCallback(() => {
    previousActiveElement.current = document.activeElement as HTMLElement
  }, [])

  const restoreFocus = useCallback(() => {
    if (previousActiveElement.current) {
      previousActiveElement.current.focus()
      previousActiveElement.current = null
    }
  }, [])

  return { saveFocus, restoreFocus }
}

/**
 * Hook for managing roving tabindex in lists
 */
export function useRovingTabIndex<T extends HTMLElement>(
  items: T[],
  activeIndex: number,
  onIndexChange: (index: number) => void
) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!items.length) return

      switch (e.key) {
        case 'ArrowDown':
        case 'ArrowRight':
          e.preventDefault()
          onIndexChange(Math.min(activeIndex + 1, items.length - 1))
          break

        case 'ArrowUp':
        case 'ArrowLeft':
          e.preventDefault()
          onIndexChange(Math.max(activeIndex - 1, 0))
          break

        case 'Home':
          e.preventDefault()
          onIndexChange(0)
          break

        case 'End':
          e.preventDefault()
          onIndexChange(items.length - 1)
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [items, activeIndex, onIndexChange])

  // Update tabindex for all items
  useEffect(() => {
    items.forEach((item, index) => {
      if (index === activeIndex) {
        item.setAttribute('tabindex', '0')
        item.focus()
      } else {
        item.setAttribute('tabindex', '-1')
      }
    })
  }, [items, activeIndex])
}

/**
 * Hook for auto-focusing an element
 */
export function useAutoFocus<T extends HTMLElement>(shouldFocus: boolean = true) {
  const ref = useRef<T>(null)

  useEffect(() => {
    if (shouldFocus && ref.current) {
      // Small delay to ensure element is rendered
      const timeoutId = setTimeout(() => {
        ref.current?.focus()
      }, 100)

      return () => clearTimeout(timeoutId)
    }
  }, [shouldFocus])

  return ref
}

/**
 * Hook for managing focus visible state
 */
export function useFocusVisible() {
  const [isFocusVisible, setIsFocusVisible] = useState(false)

  useEffect(() => {
    let hadKeyboardEvent = false

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        hadKeyboardEvent = true
        setIsFocusVisible(true)
      }
    }

    const handleMouseDown = () => {
      hadKeyboardEvent = false
      setIsFocusVisible(false)
    }

    const handleFocus = () => {
      if (hadKeyboardEvent) {
        setIsFocusVisible(true)
      }
    }

    const handleBlur = () => {
      setIsFocusVisible(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)
    document.addEventListener('focus', handleFocus, true)
    document.addEventListener('blur', handleBlur, true)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
      document.removeEventListener('focus', handleFocus, true)
      document.removeEventListener('blur', handleBlur, true)
    }
  }, [])

  return isFocusVisible
}

// Import useState
import { useState } from 'react'
