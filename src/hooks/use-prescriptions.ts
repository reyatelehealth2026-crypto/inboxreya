/**
 * Prescriptions Hook
 * Manages prescription data fetching and updates
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useToast } from './use-toast'

interface Prescription {
  id: string
  userId: string
  prescriptionNumber?: string
  prescribedDate?: string
  expiresAt?: string
  status: 'pending' | 'verified' | 'dispensed' | 'cancelled'
  prescribedBy?: string
  imageUrl?: string
  medications?: Array<string | { name: string; dosage?: string; frequency?: string }>
  notes?: string
  requiresVerification?: boolean
  verifiedAt?: string | null
  isExpired?: boolean
  isExpiringSoon?: boolean
  createdAt: string
  updatedAt: string
}

/**
 * Fetch prescriptions for a user
 */
export function usePrescriptions(userId: string) {
  return useQuery({
    queryKey: ['prescriptions', userId],
    queryFn: async () => {
      const response = await fetch(`/api/inbox/customers/${userId}/prescriptions`)
      if (!response.ok) {
        throw new Error('Failed to fetch prescriptions')
      }
      const data = await response.json()
      return data.data as Prescription[]
    },
    enabled: !!userId,
  })
}

/**
 * Update prescription status
 */
export function useUpdatePrescription() {
  const queryClient = useQueryClient()
  const { toast } = useToast()

  return useMutation({
    mutationFn: async ({
      prescriptionId,
      status,
    }: {
      prescriptionId: string
      status: string
    }) => {
      const response = await fetch(`/api/inbox/prescriptions/${prescriptionId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status }),
      })

      if (!response.ok) {
        throw new Error('Failed to update prescription')
      }

      return response.json()
    },
    onSuccess: (data, variables) => {
      // Invalidate prescriptions query to refetch
      queryClient.invalidateQueries({ queryKey: ['prescriptions'] })

      toast({
        title: 'Success',
        description: 'Prescription updated successfully',
      })
    },
    onError: (error) => {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update prescription',
        variant: 'destructive',
      })
    },
  })
}
