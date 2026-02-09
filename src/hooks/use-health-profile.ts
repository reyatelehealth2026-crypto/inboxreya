import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface HealthProfile {
  id: number | null
  userId: number
  age: number | null
  gender: string | null
  weight: number | null
  height: number | null
  bloodType: string | null
  medicalConditions: string[]
  allergies: string[]
  currentMedications: string[]
  communicationType: string | null
  confidence: number | null
  completeness: number
  updatedAt: string | null
}

export function useHealthProfile(userId: string) {
  return useQuery<HealthProfile>({
    queryKey: ['health-profile', userId],
    queryFn: async () => {
      const response = await fetch(`/api/inbox/customers/${userId}/health-profile`)
      if (!response.ok) {
        throw new Error('Failed to fetch health profile')
      }
      const json = await response.json()
      return json.data
    },
    enabled: !!userId,
  })
}

export function useUpdateHealthProfile(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (data: {
      age?: number
      gender?: string
      weight?: number
      height?: number
      bloodType?: string
      medicalConditions?: string[]
      allergies?: string[]
      currentMedications?: string[]
    }) => {
      const response = await fetch(`/api/inbox/customers/${userId}/health-profile`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        throw new Error('Failed to update health profile')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['health-profile', userId] })
      queryClient.invalidateQueries({ queryKey: ['customer', userId] })
    },
  })
}
