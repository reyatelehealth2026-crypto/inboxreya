import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from '@/hooks/use-toast'

interface UpdateStatusParams {
  conversationId: string
  status: string
}

interface BulkUpdateStatusParams {
  conversationIds: string[]
  status: string
}

export function useConversationStatus() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  const updateStatus = useMutation({
    mutationFn: async ({ conversationId, status }: UpdateStatusParams) => {
      const response = await fetch(`/api/inbox/conversations/${conversationId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
      
      // Invalidate specific conversation
      queryClient.invalidateQueries({ 
        queryKey: ['conversation', variables.conversationId] 
      })

      toast({
        title: 'Status updated',
        description: `Conversation status changed to ${variables.status}`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const bulkUpdateStatus = useMutation({
    mutationFn: async ({ conversationIds, status }: BulkUpdateStatusParams) => {
      const response = await fetch('/api/inbox/conversations/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationIds, status }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to bulk update status')
      }

      return response.json()
    },
    onSuccess: (data) => {
      // Invalidate conversations list
      queryClient.invalidateQueries({ queryKey: ['conversations'] })

      toast({
        title: 'Bulk update successful',
        description: `Updated ${data.data.updatedCount} conversations`,
      })
    },
    onError: (error: Error) => {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  return {
    updateStatus: updateStatus.mutate,
    bulkUpdateStatus: bulkUpdateStatus.mutate,
    isUpdating: updateStatus.isPending || bulkUpdateStatus.isPending,
  }
}
