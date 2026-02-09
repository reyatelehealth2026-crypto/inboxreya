'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'

export function useAccessibility() {
    const {
        fontSize,
        lineSpacing,
        highContrastMode,
        reducedMotion,
        focusIndicators,
        updateSettings,
    } = useSettingsStore()

    useEffect(() => {
        const root = document.documentElement

        // Apply font size
        root.setAttribute('data-font-size', fontSize)
        switch (fontSize) {
            case 'small':
                root.style.setProperty('--base-font-size', '14px')
                break
            case 'medium':
                root.style.setProperty('--base-font-size', '16px')
                break
            case 'large':
                root.style.setProperty('--base-font-size', '18px')
                break
            case 'xlarge':
                root.style.setProperty('--base-font-size', '20px')
                break
        }

        // Apply line spacing
        root.style.setProperty('--line-height', lineSpacing.toString())

        // Apply high contrast mode
        if (highContrastMode) {
            root.classList.add('high-contrast')
        } else {
            root.classList.remove('high-contrast')
        }

        // Apply reduced motion
        if (reducedMotion) {
            root.classList.add('reduce-motion')
        } else {
            root.classList.remove('reduce-motion')
        }

        // Apply focus indicators
        if (!focusIndicators) {
            root.classList.add('hide-focus')
        } else {
            root.classList.remove('hide-focus')
        }
    }, [fontSize, lineSpacing, highContrastMode, reducedMotion, focusIndicators])

    return {
        fontSize,
        lineSpacing,
        highContrastMode,
        reducedMotion,
        focusIndicators,
        setFontSize: (size: 'small' | 'medium' | 'large' | 'xlarge') =>
            updateSettings({ fontSize: size }),
        setLineSpacing: (spacing: number) =>
            updateSettings({ lineSpacing: spacing }),
        setHighContrastMode: (enabled: boolean) =>
            updateSettings({ highContrastMode: enabled }),
        setReducedMotion: (enabled: boolean) =>
            updateSettings({ reducedMotion: enabled }),
        setFocusIndicators: (enabled: boolean) =>
            updateSettings({ focusIndicators: enabled }),
    }
}
