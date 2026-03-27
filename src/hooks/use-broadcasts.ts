'use client'

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Broadcast, BroadcastTemplate, CreateBroadcastInput, BroadcastStats } from '@/types/broadcast'

const API_BASE = '/api/inbox'

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
export function useBroadcastTemplates() {
  return useQuery({
    queryKey: ['broadcast-templates'],
    queryFn: async () => {
      const res = await fetch(`${API_BASE}/broadcasts/templates`)
      if (!res.ok) throw new Error('Failed to fetch templates')
      return res.json()
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

// Send broadcast immediately
export function useSendBroadcast() {
  const queryClient = useQueryClient()
  
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`${API_BASE}/broadcasts/${id}/send`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error('Failed to send broadcast')
      return res.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['broadcasts'] })
    },
  })
}
