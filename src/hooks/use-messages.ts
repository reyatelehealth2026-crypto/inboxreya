"use client"

import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from '@tanstack/react-query'
import type { Message, PaginatedResponse, MessageType } from '@/types'
import { queryKeys } from '@/lib/query-keys'

async function fetchMessages(params: {
  userId: string
  page?: number
  limit?: number
  cursor?: string
  startDate?: string
  endDate?: string
  markRead?: boolean
}): Promise<PaginatedResponse<Message>> {
  const searchParams = new URLSearchParams()

  searchParams.set('userId', params.userId)
  if (params.page) searchParams.set('page', params.page.toString())
  if (params.limit) searchParams.set('limit', params.limit.toString())
  if (params.cursor) searchParams.set('cursor', params.cursor)
  if (params.startDate) searchParams.set('startDate', params.startDate)
  if (params.endDate) searchParams.set('endDate', params.endDate)
  if (params.markRead === false) searchParams.set('markRead', 'false')

  const response = await fetch(`/api/inbox/messages?${searchParams}`)

  if (!response.ok) {
    throw new Error('Failed to fetch messages')
  }

  return response.json()
}

export function useMessages(
  userId: string | null,
  options?: { limit?: number; startDate?: string; endDate?: string; markRead?: boolean }
) {
  const optionsKey = {
    limit: options?.limit ?? 100,
    startDate: options?.startDate,
    endDate: options?.endDate,
    markRead: options?.markRead,
  }
  return useQuery({
    queryKey: queryKeys.messages(userId, optionsKey),
    queryFn: () =>
      fetchMessages({
        userId: userId!,
        limit: options?.limit ?? 100,
        startDate: options?.startDate,
        endDate: options?.endDate,
        markRead: options?.markRead,
      }),
    enabled: !!userId,
    staleTime: 5 * 1000, // 5 seconds
    refetchInterval: 10 * 1000, // 10s polling for near real-time
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useInfiniteMessages(
  userId: string | null,
  options?: { startDate?: string; endDate?: string; markRead?: boolean }
) {
  const optionsKey = {
    startDate: options?.startDate,
    endDate: options?.endDate,
    markRead: options?.markRead,
  }
  return useInfiniteQuery({
    queryKey: queryKeys.messagesInfinite(userId, optionsKey),
    queryFn: ({ pageParam }) => fetchMessages({
      userId: userId!,
      cursor: pageParam,
      limit: 50,
      startDate: options?.startDate,
      endDate: options?.endDate,
      markRead: options?.markRead,
    }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.pagination.cursor || undefined,
    enabled: !!userId,
    staleTime: 5 * 1000,
    refetchInterval: 10 * 1000,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: true,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      userId: string
      content: string
      messageType?: MessageType
      replyToId?: string | number | null
      mediaUrl?: string
      metadata?: Record<string, any>
    }) => {
      const response = await fetch('/api/inbox/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Failed to send message')
      }

      return response.json() as Promise<Message>
    },
    onMutate: async (newMessage) => {
      // Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.messagesForUser(newMessage.userId) })

      // Snapshot previous value
      const previousMessages = queryClient.getQueriesData<PaginatedResponse<Message>>({
        queryKey: queryKeys.messagesForUser(newMessage.userId),
      })

      // Optimistically update
      const optimisticMessage: Message = {
        id: `temp-${Date.now()}`,
        userId: newMessage.userId,
        direction: 'outgoing',
        messageType: newMessage.messageType || 'text',
        content: newMessage.content,
        mediaUrl: newMessage.mediaUrl || null,
        metadata: newMessage.metadata || null,
        isRead: false, // Default to false for new messages
        sentBy: null,
        replyToId: newMessage.replyToId ? String(newMessage.replyToId) : null,
        platform: 'line',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }

      previousMessages.forEach(([queryKey, data]) => {
        if (!data) return
        queryClient.setQueryData<PaginatedResponse<Message>>(queryKey, {
          ...data,
          data: [...data.data, optimisticMessage],
        })
      })

      return { previousMessages }
    },
    onError: (err, newMessage, context) => {
      // Rollback on error
      if (context?.previousMessages) {
        context.previousMessages.forEach(([queryKey, data]) => {
          if (!data) return
          queryClient.setQueryData(queryKey, data)
        })
      }
    },
    onSettled: (data, error, variables) => {
      // Refetch after mutation
      queryClient.invalidateQueries({ queryKey: queryKeys.messagesForUser(variables.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
    },
  })
}

export function useMarkAllMessagesRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async () => {
      const response = await fetch('/api/inbox/messages/read-all', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
      })
      if (!response.ok) throw new Error('Failed to mark all messages as read')
      return response.json() as Promise<{ success: boolean; updated: number; conversations: number }>
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messagesRoot() })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
    },
  })
}

export function useMarkMessagesRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (userId: string) => {
      const response = await fetch('/api/inbox/messages/read', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })
      if (!response.ok) throw new Error('Failed to mark messages as read')
      return response.json()
    },
    onSuccess: (_, userId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.messagesForUser(userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
    },
  })
}
