'use client'

import { useEffect } from 'react'
import { useSettingsStore } from '@/stores/settings'
import { useQueryClient } from '@tanstack/react-query'

export function useAutoRefresh() {
    const { autoRefresh, refreshInterval } = useSettingsStore()
    const queryClient = useQueryClient()

    useEffect(() => {
        if (!autoRefresh) return

        const intervalMs = refreshInterval * 1000

        const interval = setInterval(() => {
            // Invalidate all queries to trigger refresh
            queryClient.invalidateQueries()
        }, intervalMs)

        return () => clearInterval(interval)
    }, [autoRefresh, refreshInterval, queryClient])

    return {
        autoRefresh,
        refreshInterval,
    }
}
