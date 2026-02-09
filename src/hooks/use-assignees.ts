"use client"

import { useQuery } from '@tanstack/react-query'
import type { AdminUser } from '@/types'
import { queryKeys } from '@/lib/query-keys'

export function useAssignees() {
  return useQuery({
    queryKey: queryKeys.admins(),
    queryFn: async () => {
      const response = await fetch('/api/inbox/admins')
      if (!response.ok) {
        throw new Error('Failed to fetch assignees')
      }
      const data = await response.json()
      return data.data as AdminUser[]
    },
    staleTime: 5 * 60 * 1000,
  })
}
