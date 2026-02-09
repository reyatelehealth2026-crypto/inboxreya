'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'

export function useTheme() {
    const { theme, updateSettings } = useSettingsStore()

    useEffect(() => {
        const applyTheme = (themeValue: 'light' | 'dark' | 'auto') => {
            const root = document.documentElement

            if (themeValue === 'auto') {
                // Check system preference
                const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
                if (prefersDark) {
                    root.classList.add('dark')
                } else {
                    root.classList.remove('dark')
                }
            } else if (themeValue === 'dark') {
                root.classList.add('dark')
            } else {
                root.classList.remove('dark')
            }
        }

        // Apply theme on mount and when it changes
        applyTheme(theme)

        // Listen for system theme changes if auto mode
        if (theme === 'auto') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
            const handleChange = () => applyTheme('auto')

            mediaQuery.addEventListener('change', handleChange)
            return () => mediaQuery.removeEventListener('change', handleChange)
        }
    }, [theme])

    const setTheme = (newTheme: 'light' | 'dark' | 'auto') => {
        updateSettings({ theme: newTheme })
    }

    return { theme, setTheme }
}
