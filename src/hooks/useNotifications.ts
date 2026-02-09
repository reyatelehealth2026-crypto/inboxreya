'use client'

import { useCallback, useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useToast } from './use-toast'

export function useNotifications() {
    const {
        notificationsEnabled,
        soundEnabled,
        notificationVolume,
        notificationPriority,
        quietHoursEnabled,
        quietHoursStart,
        quietHoursEnd,
        updateSettings,
    } = useSettingsStore()
    const { toast } = useToast()

    // Check if we're in quiet hours
    const isQuietHours = useCallback(() => {
        if (!quietHoursEnabled) return false

        const now = new Date()
        const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`

        // Handle cases where quiet hours span midnight
        if (quietHoursStart > quietHoursEnd) {
            return currentTime >= quietHoursStart || currentTime < quietHoursEnd
        }

        return currentTime >= quietHoursStart && currentTime < quietHoursEnd
    }, [quietHoursEnabled, quietHoursStart, quietHoursEnd])

    // Request notification permission
    const requestPermission = useCallback(async () => {
        if (!('Notification' in window)) {
            toast({
                title: 'ไม่รองรับการแจ้งเตือน',
                description: 'เบราว์เซอร์ของคุณไม่รองรับการแจ้งเตือนแบบเดสก์ท็อป',
                variant: 'destructive',
            })
            return false
        }

        if (Notification.permission === 'granted') {
            return true
        }

        if (Notification.permission !== 'denied') {
            const permission = await Notification.requestPermission()
            if (permission === 'granted') {
                toast({
                    title: 'อนุญาตการแจ้งเตือนแล้ว',
                    description: 'คุณจะได้รับการแจ้งเตือนเมื่อมีข้อความใหม่',
                })
                return true
            }
        }

        return false
    }, [toast])

    // Show browser notification
    const showNotification = useCallback(
        (title: string, options?: NotificationOptions) => {
            if (!notificationsEnabled || isQuietHours()) return

            if (Notification.permission === 'granted') {
                new Notification(title, {
                    icon: '/favicon.ico',
                    ...options,
                })
            }
        },
        [notificationsEnabled, isQuietHours]
    )

    // Play sound notification
    const playSound = useCallback(() => {
        if (!soundEnabled || isQuietHours()) return

        try {
            const audio = new Audio('/sounds/notification.mp3')
            audio.volume = notificationVolume / 100
            audio.play().catch((error) => {
                console.error('Failed to play notification sound:', error)
            })
        } catch (error) {
            console.error('Failed to create audio:', error)
        }
    }, [soundEnabled, notificationVolume, isQuietHours])

    // Notify based on priority
    const notify = useCallback(
        (options: {
            title: string
            body?: string
            priority?: 'all' | 'assigned' | 'mentions' | 'urgent'
            playSound?: boolean
        }) => {
            const { title, body, priority = 'all', playSound: shouldPlaySound = true } = options

            // Check priority filter
            if (notificationPriority !== 'all') {
                if (priority !== notificationPriority && priority !== 'urgent') {
                    return
                }
            }

            showNotification(title, { body })

            if (shouldPlaySound) {
                playSound()
            }
        },
        [notificationPriority, showNotification, playSound]
    )

    // Test notification
    const testNotification = useCallback(() => {
        toast({
            title: '🔔 ทดสอบการแจ้งเตือน',
            description: 'นี่คือตัวอย่างการแจ้งเตือน',
        })

        if (Notification.permission === 'granted') {
            showNotification('ทดสอบการแจ้งเตือน Inbox', {
                body: 'การแจ้งเตือนทำงานปกติ!',
            })
        }

        playSound()
    }, [toast, showNotification, playSound])

    return {
        notificationsEnabled,
        soundEnabled,
        notificationVolume,
        requestPermission,
        showNotification,
        playSound,
        notify,
        testNotification,
        isQuietHours: isQuietHours(),
        setNotificationsEnabled: (enabled: boolean) =>
            updateSettings({ notificationsEnabled: enabled }),
        setSoundEnabled: (enabled: boolean) =>
            updateSettings({ soundEnabled: enabled }),
        setVolume: (volume: number) =>
            updateSettings({ notificationVolume: volume }),
    }
}
