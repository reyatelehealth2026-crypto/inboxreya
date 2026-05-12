"use client"

import { useCallback, useState } from 'react'
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

export interface UseAiDraftRunPayload {
  userId: string
  tone?: string
  instruction?: string
}

export interface UseAiDraftRunOptions {
  onChunk?: (chunk: string) => void
}

/**
 * Streaming GhostDraft consumer. Reads the plain-text body of
 * `/api/inbox/ai/draft` chunk-by-chunk, exposes the running `partial` text,
 * and resolves with the full text once the stream closes.
 *
 * Replaces the previous `useMutation`-style hook so the UI can render tokens
 * as they arrive. `useAiReply` / `useAiAnalyzeImage` remain non-streaming.
 */
export function useAiDraft() {
  const [isPending, setIsPending] = useState(false)
  const [partial, setPartial] = useState('')
  const [error, setError] = useState<Error | null>(null)
  const [degraded, setDegraded] = useState<string[]>([])

  const run = useCallback(
    async (payload: UseAiDraftRunPayload, opts?: UseAiDraftRunOptions): Promise<string> => {
      setIsPending(true)
      setPartial('')
      setError(null)
      setDegraded([])
      try {
        const response = await fetch('/api/inbox/ai/draft', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        if (!response.ok) {
          const errData = await response.json().catch(() => ({}))
          throw new Error(errData?.error || `Draft failed (${response.status})`)
        }
        const deg = response.headers.get('X-Ai-Context-Degraded')
        if (deg) setDegraded(deg.split(',').filter(Boolean))

        const reader = response.body?.getReader()
        if (!reader) throw new Error('AI response has no body')
        const decoder = new TextDecoder()
        let full = ''
        while (true) {
          const { done, value } = await reader.read()
          if (done) break
          const chunk = decoder.decode(value, { stream: true })
          if (!chunk) continue
          full += chunk
          setPartial(full)
          opts?.onChunk?.(chunk)
        }
        return full
      } catch (e) {
        const err = e instanceof Error ? e : new Error(String(e))
        setError(err)
        throw err
      } finally {
        setIsPending(false)
      }
    },
    [],
  )

  const reset = useCallback(() => {
    setIsPending(false)
    setPartial('')
    setError(null)
    setDegraded([])
  }, [])

  return { run, reset, isPending, partial, error, degraded }
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
