"use client"

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import type { Conversation, PaginatedResponse, CustomerProfile, AdminUser } from '@/types'
import { useInboxStore } from '@/stores/inbox'
import { queryKeys } from '@/lib/query-keys'

async function fetchConversations(params: {
  page?: number
  limit?: number
  cursor?: string
  status?: string
  tagId?: string
  tagIds?: string[]
  search?: string
  assignedTo?: string
  assignedToIds?: string[]
  unreadOnly?: boolean
  startDate?: string
  endDate?: string
  platform?: string
}): Promise<PaginatedResponse<Conversation>> {
  const searchParams = new URLSearchParams()

  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.status && params.status !== 'all') searchParams.set('status', params.status)
  if (params.tagId) searchParams.set('tagId', params.tagId)
  if (params.tagIds && params.tagIds.length > 0) {
    searchParams.set('tagIds', params.tagIds.join(','))
  }
  if (params.search) searchParams.set('search', params.search)
  if (params.assignedTo) searchParams.set('assignedTo', params.assignedTo)
  if (params.assignedToIds && params.assignedToIds.length > 0) {
    searchParams.set('assignedToIds', params.assignedToIds.join(','))
  }
  if (params.unreadOnly) searchParams.set('unreadOnly', 'true')
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.platform && params.platform !== 'all') searchParams.set('platform', params.platform)

  const response = await fetch(`/api/inbox/conversations?${searchParams}`)

  if (!response.ok) {
    throw new Error('Failed to fetch conversations')
  }

  return response.json()
}

export function useConversations() {
  const filters = useInboxStore((state) => state.filters)

  return useQuery({
    queryKey: queryKeys.conversations(filters),
    queryFn: () => fetchConversations({
      status: filters.status,
      tagId: filters.tagId,
      tagIds: filters.tagIds,
      search: filters.search,
      assignedTo: filters.assignedTo,
      assignedToIds: filters.assignedToIds,
      unreadOnly: filters.unreadOnly,
      startDate: filters.startDate,
      endDate: filters.endDate,
      platform: filters.platform,
      limit: 1000, // No practical limit - show all conversations
    }),
    staleTime: 30 * 1000, // 30 seconds
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) => {
      // Don't retry on 4xx errors
      if (error.message.includes('401') || error.message.includes('403')) {
        return false
      }
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })
}

export function useInfiniteConversations() {
  const filters = useInboxStore((state) => state.filters)

  return useInfiniteQuery({
    queryKey: queryKeys.conversationsInfinite(filters),
    queryFn: ({ pageParam }) => fetchConversations({
      cursor: pageParam,
      status: filters.status,
      tagId: filters.tagId,
      tagIds: filters.tagIds,
      search: filters.search,
      assignedTo: filters.assignedTo,
      assignedToIds: filters.assignedToIds,
      unreadOnly: filters.unreadOnly,
      startDate: filters.startDate,
      endDate: filters.endDate,
      limit: 20,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.cursor || undefined,
    staleTime: 30 * 1000,
    refetchInterval: 15 * 1000,
    refetchIntervalInBackground: true,
    retry: (failureCount, error) => {
      if (error.message.includes('401') || error.message.includes('403')) {
        return false
      }
      return failureCount < 3
    },
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 10000),
  })
}

export function useConversation(id: string | null) {
  const queryClient = useQueryClient()

  return useQuery({
    queryKey: queryKeys.conversation(id),
    queryFn: async () => {
      // Try to get from cache first
      const cachedQueries = queryClient.getQueriesData<PaginatedResponse<Conversation>>({
        queryKey: queryKeys.conversationsRoot(),
      })
      for (const [, cached] of cachedQueries) {
        const conversation = cached?.data.find((c) => c.id === id)
        if (conversation) {
          return conversation
        }
      }

      // Fetch if not in cache
      const response = await fetch(`/api/inbox/conversations/${id}`)
      if (!response.ok) throw new Error('Failed to fetch conversation')
      const data = await response.json()
      return data.data as Conversation
    },
    enabled: !!id,
  })
}

export function useUpdateConversationStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, status }: { userId: string; status: string }) => {
      const response = await fetch(`/api/inbox/conversations/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chatStatus: status }),
      })
      if (!response.ok) throw new Error('Failed to update status')
      return response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}

export function useAssignConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, adminId }: { userId: string; adminId: string }) => {
      const response = await fetch(`/api/inbox/conversations/${userId}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminIds: [adminId] }),
      })
      if (!response.ok) throw new Error('Failed to assign conversation')
      return response.json()
    },
    // Optimistic update - เพิ่มผู้ดูแลใน UI ทันที
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
      
      const previousProfile = queryClient.getQueryData<CustomerProfile>(
        queryKeys.customerProfile(variables.userId)
      )
      const admins = queryClient.getQueryData<AdminUser[]>(queryKeys.admins())
      const adminToAdd = admins?.find(a => a.id === variables.adminId)
      
      if (previousProfile && adminToAdd) {
        queryClient.setQueryData<CustomerProfile>(
          queryKeys.customerProfile(variables.userId),
          {
            ...previousProfile,
            assignees: [...previousProfile.assignees, adminToAdd],
          }
        )
      }
      
      return { previousProfile }
    },
    onError: (_err, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.customerProfile(variables.userId),
          context.previousProfile
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(variables.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}

export function useUnassignConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, adminId }: { userId: string; adminId: string }) => {
      const response = await fetch(
        `/api/inbox/conversations/${userId}/assignees`,
        {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ adminIds: [adminId] }),
        }
      )
      if (!response.ok) throw new Error('Failed to unassign conversation')
      return response.json()
    },
    // Optimistic update - ลบผู้ดูแลออกจาก UI ทันที
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
            assignees: previousProfile.assignees.filter(a => a.id !== variables.adminId),
          }
        )
      }
      
      return { previousProfile }
    },
    onError: (_err, variables, context) => {
      if (context?.previousProfile) {
        queryClient.setQueryData(
          queryKeys.customerProfile(variables.userId),
          context.previousProfile
        )
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(variables.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}


export function useBulkAssignConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, adminIds }: { userId: string; adminIds: string[] }) => {
      const response = await fetch(`/api/inbox/conversations/${userId}/assignees`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminIds }),
      })
      if (!response.ok) throw new Error('Failed to assign conversation')
      return response.json()
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(variables.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}

export function useBulkUnassignConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({ userId, adminIds }: { userId: string; adminIds: string[] }) => {
      const response = await fetch(`/api/inbox/conversations/${userId}/assignees`, {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminIds }),
      })
      if (!response.ok) throw new Error('Failed to unassign conversation')
      return response.json()
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversation(variables.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
    },
  })
}

export function useGetAssignees(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.assignees(userId || ''),
    queryFn: async () => {
      if (!userId) return []
      const response = await fetch(`/api/inbox/conversations/${userId}/assignees`)
      if (!response.ok) throw new Error('Failed to fetch assignees')
      const data = await response.json()
      return data.data || []
    },
    enabled: !!userId,
  })
}
