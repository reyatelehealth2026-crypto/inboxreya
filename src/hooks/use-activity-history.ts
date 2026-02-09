"use client"

import { useQuery } from '@tanstack/react-query'
import type { ActivityLog } from '@/types'

export function useActivityHistory(userId: string | null) {
  return useQuery({
    queryKey: ['activity-history', userId],
    queryFn: async () => {
      const response = await fetch(`/api/inbox/customers/${userId}/activity`)
      if (!response.ok) throw new Error('Failed to fetch activity history')
      const data = await response.json()
      return data.data as ActivityLog[]
    },
    enabled: !!userId,
    staleTime: 60 * 1000, // 1 minute
  })
}
