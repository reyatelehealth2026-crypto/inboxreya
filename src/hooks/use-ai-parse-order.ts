"use client"

import { useMutation } from '@tanstack/react-query'

export interface ParsedOrderItem {
  sku: string
  name: string
  qty: number
  price: number
  confidence: number
}

export interface ParseOrderResult {
  items: ParsedOrderItem[]
  degraded: string[]
  parseError?: string
}

export function useAiParseOrder() {
  return useMutation<
    ParseOrderResult,
    Error,
    { userId: number | string; text: string; messageId?: number | string }
  >({
    mutationFn: async ({ userId, text, messageId }) => {
      const res = await fetch('/api/inbox/ai/parse-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, text, messageId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to parse order')
      return data as ParseOrderResult
    },
  })
}
