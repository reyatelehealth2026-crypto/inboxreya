'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { prefersHighContrast } from '@/lib/accessibility'

/**
 * High contrast mode support
 */
export function HighContrastMode() {
  const highContrastMode = useSettingsStore((state) => state.highContrastMode)

  useEffect(() => {
    // Check system preference
    const systemPrefersHighContrast = prefersHighContrast()
    const shouldEnableHighContrast = highContrastMode || systemPrefersHighContrast

    if (shouldEnableHighContrast) {
      document.documentElement.classList.add('high-contrast')
    } else {
      document.documentElement.classList.remove('high-contrast')
    }
  }, [highContrastMode])

  return (
    <style jsx global>{`
      /* High contrast mode styles */
      .high-contrast {
        --color-text-primary: #000000;
        --color-text-secondary: #000000;
        --color-background: #ffffff;
        --color-border: #000000;
        --color-focus: #0000ff;
      }

      .high-contrast * {
        border-color: var(--color-border) !important;
      }

      .high-contrast button,
      .high-contrast a,
      .high-contrast input,
      .high-contrast textarea,
      .high-contrast select {
        border: 2px solid var(--color-border) !important;
      }

      .high-contrast button:focus,
      .high-contrast a:focus,
      .high-contrast input:focus,
      .high-contrast textarea:focus,
      .high-contrast select:focus {
        outline: 3px solid var(--color-focus) !important;
        outline-offset: 2px !important;
      }

      /* Ensure sufficient contrast for text */
      .high-contrast .text-gray-500,
      .high-contrast .text-gray-600,
      .high-contrast .text-gray-700 {
        color: var(--color-text-primary) !important;
      }

      /* Ensure backgrounds are white */
      .high-contrast .bg-gray-50,
      .high-contrast .bg-gray-100,
      .high-contrast .bg-gray-200 {
        background-color: var(--color-background) !important;
      }

      /* Make hover states more visible */
      .high-contrast button:hover,
      .high-contrast a:hover {
        background-color: #e0e0e0 !important;
      }

      /* Ensure icons are visible */
      .high-contrast svg {
        stroke: var(--color-text-primary) !important;
        fill: var(--color-text-primary) !important;
      }

      /* Status colors with high contrast */
      .high-contrast .text-green-600,
      .high-contrast .text-blue-600,
      .high-contrast .text-red-600,
      .high-contrast .text-yellow-600 {
        color: var(--color-text-primary) !important;
        font-weight: 700 !important;
      }

      /* Add patterns for status indicators */
      .high-contrast .bg-green-100 {
        background-image: repeating-linear-gradient(
          45deg,
          transparent,
          transparent 10px,
          rgba(0, 0, 0, 0.1) 10px,
          rgba(0, 0, 0, 0.1) 20px
        ) !important;
      }

      .high-contrast .bg-red-100 {
        background-image: repeating-linear-gradient(
          -45deg,
          transparent,
          transparent 10px,
          rgba(0, 0, 0, 0.1) 10px,
          rgba(0, 0, 0, 0.1) 20px
        ) !important;
      }

      .high-contrast .bg-blue-100 {
        background-image: repeating-linear-gradient(
          90deg,
          transparent,
          transparent 10px,
          rgba(0, 0, 0, 0.1) 10px,
          rgba(0, 0, 0, 0.1) 20px
        ) !important;
      }
    `}</style>
  )
}
