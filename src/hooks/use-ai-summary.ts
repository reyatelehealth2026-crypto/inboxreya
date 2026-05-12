"use client"

import { useMutation } from '@tanstack/react-query'

export interface SummaryResult {
  summary: string
  degraded: string[]
}

export function useAiSummary() {
  return useMutation<SummaryResult, Error, { userId: number | string; messageCount?: number }>({
    mutationFn: async ({ userId, messageCount }) => {
      const res = await fetch('/api/inbox/ai/summarize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, messageCount }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || data.error || 'Failed to summarize')
      return data as SummaryResult
    },
  })
}
