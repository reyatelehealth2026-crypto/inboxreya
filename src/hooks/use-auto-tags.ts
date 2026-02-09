"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { AutoTagRule, AutoTagCondition, AutoTagTriggerType } from '@/types'
import { queryKeys } from '@/lib/query-keys'

export function useAutoTagRules() {
  return useQuery({
    queryKey: queryKeys.autoTags(),
    queryFn: async () => {
      const response = await fetch('/api/inbox/auto-tags')
      if (!response.ok) throw new Error('Failed to fetch auto-tag rules')
      const data = await response.json()
      return data.data as AutoTagRule[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCreateAutoTagRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      tagId: string
      triggerType: AutoTagTriggerType
      conditions: AutoTagCondition[]
      priority?: number
      ruleName?: string
    }) => {
      const response = await fetch('/api/inbox/auto-tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to create auto-tag rule')
      return response.json() as Promise<AutoTagRule>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoTags() })
    },
  })
}

export function useUpdateAutoTagRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      id: string
      conditions?: AutoTagCondition[]
      isActive?: boolean
      priority?: number
    }) => {
      const response = await fetch('/api/inbox/auto-tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to update auto-tag rule')
      return response.json() as Promise<AutoTagRule>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoTags() })
    },
  })
}

export function useDeleteAutoTagRule() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (id: string) => {
      const response = await fetch(`/api/inbox/auto-tags?id=${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete auto-tag rule')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.autoTags() })
    },
  })
}
