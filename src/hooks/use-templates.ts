"use client"

import { useQuery } from '@tanstack/react-query'
import type { QuickReplyTemplate } from '@/types'
import { queryKeys } from '@/lib/query-keys'

export function useTemplates(search?: string, category?: string) {
  return useQuery({
    queryKey: queryKeys.templates(search, category),
    queryFn: async () => {
      const params = new URLSearchParams()
      if (search) params.append('search', search)
      if (category) params.append('category', category)
      params.append('limit', '50')

      const response = await fetch(`/api/inbox/templates?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch templates')
      }

      const data = await response.json()
      if (!data.success) {
        throw new Error(data.error || 'Failed to fetch templates')
      }

      return (data.data || []) as QuickReplyTemplate[]
    },
    staleTime: 30 * 1000,
  })
}
