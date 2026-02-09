"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { UserTag, CustomerProfile } from '@/types'
import { queryKeys } from '@/lib/query-keys'

interface TagWithCount extends UserTag {
  usageCount: number
}

export function useTags() {
  return useQuery({
    queryKey: queryKeys.tags(),
    queryFn: async () => {
      const response = await fetch('/api/inbox/tags')
      if (!response.ok) throw new Error('Failed to fetch tags')
      const data = await response.json()
      return data.data as TagWithCount[]
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useCreateTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { name: string; color?: string; description?: string }) => {
      const response = await fetch('/api/inbox/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to create tag')
      const data = await response.json()
      return data as UserTag
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags() })
    },
  })
}

export function useDeleteTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (tagId: string) => {
      const response = await fetch(`/api/inbox/tags?tagId=${tagId}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete tag')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags() })
    },
  })
}

export function useAssignTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: string; tagId: string }) => {
      const response = await fetch('/api/inbox/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, action: 'assign' }),
      })
      if (!response.ok) throw new Error('Failed to assign tag')
      return response.json()
    },
    // Optimistic update - อัพเดท UI ทันที
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
      
      const previousProfile = queryClient.getQueryData<CustomerProfile>(
        queryKeys.customerProfile(variables.userId)
      )
      const allTags = queryClient.getQueryData<TagWithCount[]>(queryKeys.tags())
      const tagToAdd = allTags?.find(t => t.id === variables.tagId)
      
      if (previousProfile && tagToAdd) {
        queryClient.setQueryData<CustomerProfile>(
          queryKeys.customerProfile(variables.userId),
          {
            ...previousProfile,
            tags: [...previousProfile.tags, tagToAdd],
          }
        )
      }
      
      return { previousProfile }
    },
    onError: (_err, variables, context) => {
      // Rollback ถ้า error
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.customerProfile(variables.userId),
          context.previousProfile
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      // Sync กับ server หลัง mutation เสร็จ
      queryClient.invalidateQueries({ queryKey: queryKeys.tags() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}

export function useRemoveTag() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: string; tagId: string }) => {
      const response = await fetch('/api/inbox/tags', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...params, action: 'remove' }),
      })
      if (!response.ok) throw new Error('Failed to remove tag')
      return response.json()
    },
    // Optimistic update - ลบออกจาก UI ทันที
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
      
      const previousProfile = queryClient.getQueryData<CustomerProfile>(
        queryKeys.customerProfile(variables.userId)
      )
      
      if (previousProfile) {
        queryClient.setQueryData<CustomerProfile>(
          queryKeys.customerProfile(variables.userId),
          {
            ...previousProfile,
            tags: previousProfile.tags.filter(t => t.id !== variables.tagId),
          }
        )
      }
      
      return { previousProfile }
    },
    onError: (_err, variables, context) => {
      // Rollback ถ้า error
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.customerProfile(variables.userId),
          context.previousProfile
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      // Sync กับ server หลัง mutation เสร็จ
      queryClient.invalidateQueries({ queryKey: queryKeys.tags() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}
