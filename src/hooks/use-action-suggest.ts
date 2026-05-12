"use client"

import { useQuery } from '@tanstack/react-query'

export interface SuggestedAction {
  label: string
  reason: string
  type: 'reply' | 'price_list' | 'follow_up' | 'order_check' | 'escalate'
  priority: 1 | 2 | 3
}

export interface SuggestResult {
  actions: SuggestedAction[]
  degraded: string[]
}

export function useActionSuggest(userId: number | null, opts?: { enabled?: boolean }) {
  return useQuery<SuggestResult, Error>({
    queryKey: ['ai', 'suggest', userId],
    enabled: opts?.enabled !== false && userId != null,
    staleTime: 30 * 60 * 1000,
    queryFn: async () => {
      const res = await fetch(`/api/inbox/ai/suggest-action?userId=${userId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to fetch suggestions')
      return data as SuggestResult
    },
  })
}
