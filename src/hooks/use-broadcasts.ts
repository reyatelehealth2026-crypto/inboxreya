'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Broadcast, BroadcastTemplate, CreateBroadcastInput, BroadcastStats, FlexMessage } from '@/types/broadcast'

export interface BroadcastTemplateMutationInput {
  name: string
  templateType: 'text' | 'image' | 'flex' | 'video'
  categoryLabel?: string
  content?: string
  mediaUrl?: string
  flexContent?: FlexMessage
}

const API_BASE = '/api/inbox'

interface BroadcastRecipientEstimateInput {
  targetSegmentId?: number
  targetCustomerIds?: number[]
  targetTagIds?: number[]
}

// Fetch all broadcasts
export function useBroadcasts(params?: { page?: number; limit?: number; status?: string }) {
  const { page = 1, limit = 20, status } = params || {}
  
  return useQuery({
    queryKey: ['broadcasts', { page, limit, status }],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      searchParams.set('page', page.toString())
      searchParams.set('limit', limit.toString())
      if (status) searchParams.set('status', status)
      
      const res = await fetch(`${API_BASE}/broadcasts?${searchParams}`)
      if (!res.ok) throw new Error('Failed to fetch broadcasts')
      return res.json()
    },
  })
}

// Fetch broadcast templates
export function useBroadcastTemplates(params?: { search?: string }) {
  const search = params?.search?.trim() || ''

  return useQuery({
    queryKey: ['broadcast-templates', { search }],
    queryFn: async () => {
      const searchParams = new URLSearchParams()
      if (search) searchParams.set('search', search)
      const suffix = searchParams.toString() ? `?${searchParams}` : ''
      const res = await fetch(`${API_BASE}/broadcasts/templates${suffix}`)
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json()
    },
  })
}

export function useBroadcastRecipientEstimate(
  input: BroadcastRecipientEstimateInput,
  options?: { enabled?: boolean }
) {
  const enabled = options?.enabled ?? true
  const targetCustomerIds = [...(input.targetCustomerIds || [])].sort((a, b) => a - b)
  const targetTagIds = [...(input.targetTagIds || [])].sort((a, b) => a - b)

  return useQuery({
    queryKey: [
      'broadcast-recipient-estimate',
      {
        targetSegmentId: input.targetSegmentId ?? null,
        targetCustomerIds,
        targetTagIds,
      },
    ],
    enabled,
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/broadcasts/estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetSegmentId: input.targetSegmentId,
          targetCustomerIds,
          targetTagIds,
        }),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to estimate broadcast recipients')
      }

      return res.json()
    },
  })
}

function invalidateBroadcastTemplateQueries(queryClient: ReturnType<typeof useQueryClient>) {
  queryClient.invalidateQueries({ queryKey: ['broadcast-templates'] })
}

export function useCreateBroadcastTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: BroadcastTemplateMutationInput) => {
      const res = await fetch(`${API_BASE}/broadcasts/templates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to create broadcast template')
      }

      return res.json()
    },
    onSuccess: () => {
      invalidateBroadcastTemplateQueries(queryClient)
    },
  })
}

export function useUpdateBroadcastTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sourceTable,
      sourceId,
      data,
    }: {
      sourceTable: 'templates' | 'flex_templates'
      sourceId: number
      data: BroadcastTemplateMutationInput
    }) => {
      const res = await fetch(`${API_BASE}/broadcasts/templates/${sourceTable}/${sourceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to update broadcast template')
      }

      return res.json()
    },
    onSuccess: () => {
      invalidateBroadcastTemplateQueries(queryClient)
    },
  })
}

export function useDeleteBroadcastTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      sourceTable,
      sourceId,
    }: {
      sourceTable: 'templates' | 'flex_templates'
      sourceId: number
    }) => {
      const res = await fetch(`${API_BASE}/broadcasts/templates/${sourceTable}/${sourceId}`, {
        method: 'DELETE',
      })

      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(error.error || 'Failed to delete broadcast template')
      }

      return res.json()
    },
    onSuccess: () => {
      invalidateBroadcastTemplateQueries(queryClient)
    },
  })
}

// Fetch single broadcast
export function useBroadcast(id: number) {
  return useQuery({
    queryKey: ['broadcast', id],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/broadcasts/${id}`)
      if (!res.ok) throw new Error('Failed to fetch broadcast')
      return res.json()
    },
    enabled: !!id,
  })
}

// Create broadcast
export function useCreateBroadcast() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (data: CreateBroadcastInput) => {
      const res = await fetch(`${API_BASE}/broadcasts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Failed to create broadcast')
      }
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

// Cancel broadcast
export function useCancelBroadcast() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/broadcasts/${id}`, {
        method: 'DELETE',
      })
      if (!res.ok) throw new Error('Failed to cancel broadcast')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}

// Fetch broadcast stats
export function useBroadcastStats() {
  return useQuery({
    queryKey: ['broadcast-stats'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/broadcasts/stats`)
      if (!res.ok) throw new Error('Failed to fetch stats')
      return res.json()
    },
  })
}

export interface SendProgress {
  sent: number
  total: number
  success: number
  failed: number
}

// Send broadcast immediately — streams progress via SSE
export function useSendBroadcast() {
  const queryClient = useQueryClient()
  const [isPending, setIsPending] = useState(false)
  const [progress, setProgress] = useState<SendProgress | null>(null)

  const mutateAsync = async (id: number): Promise<any> => {
    setIsPending(true)
    setProgress(null)

    try {
      const res = await fetch(`${API_BASE}/broadcasts/${id}/send`, { method: 'POST' })

      // Fallback for non-streaming response (error before stream starts)
      if (!res.body || !res.headers.get('content-type')?.includes('text/event-stream')) {
        const data = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(data.error || 'Failed to send broadcast')
        return data
      }

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let result: any = null

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const text = decoder.decode(value, { stream: true })
        for (const line of text.split('\n')) {
          if (!line.startsWith('data:')) continue
          let event: any
          try { event = JSON.parse(line.slice(5).trim()) } catch { continue }

          if (event.type === 'start') {
            setProgress({ sent: 0, total: event.total, success: 0, failed: 0 })
          } else if (event.type === 'progress') {
            setProgress({ sent: event.sent, total: event.total, success: event.success, failed: event.failed })
          } else if (event.type === 'complete') {
            result = event
            setProgress({ sent: event.totalRecipients, total: event.totalRecipients, success: event.successCount, failed: event.failedCount })
          } else if (event.type === 'error') {
            throw new Error(event.error || 'Failed to send broadcast')
          }
        }
      }

      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
      return result
    } finally {
      setIsPending(false)
    }
  }

  return { mutateAsync, isPending, progress }
}
