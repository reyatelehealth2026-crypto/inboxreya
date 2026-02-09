'use client'

import { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'

/**
 * Global focus indicator styles
 * Adds visible focus rings when navigating with keyboard
 */
export function FocusIndicator() {
  const [isKeyboardUser, setIsKeyboardUser] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        setIsKeyboardUser(true)
      }
    }

    const handleMouseDown = () => {
      setIsKeyboardUser(false)
    }

    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('mousedown', handleMouseDown)

    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('mousedown', handleMouseDown)
    }
  }, [])

  useEffect(() => {
    if (isKeyboardUser) {
      document.body.classList.add('keyboard-user')
    } else {
      document.body.classList.remove('keyboard-user')
    }
  }, [isKeyboardUser])

  return (
    <style jsx global>{`
      /* Hide focus indicators by default */
      *:focus {
        outline: none;
      }

      /* Show focus indicators for keyboard users */
      .keyboard-user *:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
      }

      /* Enhanced focus for interactive elements */
      .keyboard-user button:focus,
      .keyboard-user a:focus,
      .keyboard-user input:focus,
      .keyboard-user textarea:focus,
      .keyboard-user select:focus {
        outline: 2px solid #3b82f6;
        outline-offset: 2px;
        box-shadow: 0 0 0 4px rgba(59, 130, 246, 0.1);
      }

      /* High contrast mode support */
      @media (prefers-contrast: high) {
        .keyboard-user *:focus {
          outline: 3px solid currentColor;
          outline-offset: 3px;
        }
      }

      /* Skip link styles */
      .skip-navigation a:focus {
        position: fixed;
        top: 1rem;
        left: 1rem;
        z-index: 9999;
      }
    `}</style>
  )
}
