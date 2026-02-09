"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CustomerNote } from '@/types'
import { queryKeys } from '@/lib/query-keys'

export function useNotes(userId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.notes(userId || ''),
    queryFn: async () => {
      if (!userId) return []
      const response = await fetch(`/api/inbox/notes?userId=${userId}`)
      if (!response.ok) throw new Error('Failed to fetch notes')
      const data = await response.json()
      return data.data as CustomerNote[]
    },
    enabled: !!userId,
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { userId: string; content: string; isPinned?: boolean }) => {
      const response = await fetch('/api/inbox/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to create note')
      return response.json() as Promise<CustomerNote>
    },
    // Optimistic update - แสดงโน้ตใหม่ทันที
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes(variables.userId) })
      
      const previousNotes = queryClient.getQueryData<CustomerNote[]>(
        queryKeys.notes(variables.userId)
      )
      
      // สร้าง temporary note
      const tempNote: CustomerNote = {
        id: `temp-${Date.now()}`,
        userId: variables.userId,
        adminId: '',
        content: variables.content,
        isPinned: variables.isPinned || false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }
      
      queryClient.setQueryData<CustomerNote[]>(
        queryKeys.notes(variables.userId),
        (old) => [tempNote, ...(old || [])]
      )
      
      return { previousNotes }
    },
    onError: (_err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(queryKeys.notes(variables.userId), context.previousNotes)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes(variables.userId) })
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; content?: string; isPinned?: boolean; userId: string }) => {
      const response = await fetch('/api/inbox/notes', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
      })
      if (!response.ok) throw new Error('Failed to update note')
      return response.json() as Promise<CustomerNote>
    },
    // Optimistic update - อัพเดทโน้ตทันที
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes(variables.userId) })
      
      const previousNotes = queryClient.getQueryData<CustomerNote[]>(
        queryKeys.notes(variables.userId)
      )
      
      queryClient.setQueryData<CustomerNote[]>(
        queryKeys.notes(variables.userId),
        (old) => {
          if (!old) return old
          return old.map((note) =>
            note.id === variables.id
              ? {
                  ...note,
                  ...(variables.content !== undefined && { content: variables.content }),
                  ...(variables.isPinned !== undefined && { isPinned: variables.isPinned }),
                  updatedAt: new Date().toISOString(),
                }
              : note
          )
        }
      )
      
      return { previousNotes }
    },
    onError: (_err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(queryKeys.notes(variables.userId), context.previousNotes)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes(variables.userId) })
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: { id: string; userId: string }) => {
      const response = await fetch(`/api/inbox/notes?id=${params.id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete note')
      return response.json()
    },
    // Optimistic update - ลบโน้ตออกทันที
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.notes(variables.userId) })
      
      const previousNotes = queryClient.getQueryData<CustomerNote[]>(
        queryKeys.notes(variables.userId)
      )
      
      queryClient.setQueryData<CustomerNote[]>(
        queryKeys.notes(variables.userId),
        (old) => (old || []).filter((note) => note.id !== variables.id)
      )
      
      return { previousNotes }
    },
    onError: (_err, variables, context) => {
      if (context?.previousNotes) {
        queryClient.setQueryData(queryKeys.notes(variables.userId), context.previousNotes)
      }
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes(variables.userId) })
    },
  })
}
