"use client"

import { useMutation } from '@tanstack/react-query'

interface AiResponse {
  text: string
}

export function useAiReply() {
  return useMutation({
    mutationFn: async (payload: { userId: string; tone?: string }) => {
      const response = await fetch('/api/inbox/ai/reply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate AI reply')
      return data as AiResponse
    },
  })
}

export function useAiDraft() {
  return useMutation({
    mutationFn: async (payload: { userId: string; tone?: string }) => {
      const response = await fetch('/api/inbox/ai/draft', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to generate AI draft')
      return data as AiResponse
    },
  })
}

export function useAiAnalyzeImage() {
  return useMutation({
    mutationFn: async (payload: { userId: string; imageUrl: string }) => {
      const response = await fetch('/api/inbox/ai/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await response.json()
      if (!response.ok) throw new Error(data.error || 'Failed to analyze image')
      return data as AiResponse
    },
  })
}
