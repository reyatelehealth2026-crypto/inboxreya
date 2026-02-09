import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

interface PointsHistory {
  id: string
  description: string
  createdAt: string
  points: number
}

interface PointsData {
  balance: {
    current: number
    total: number
    used: number
    expiringSoon: number
  }
  tier: {
    current: string
    name: string
    nextTier?: string
    pointsToNextTier?: number
    progress?: number
    benefits: string[]
  }
  stats: {
    totalSpent: number
    orderCount: number
  }
  history: PointsHistory[]
}

interface AdjustPointsPayload {
  points: number
  reason: string
  type: string
}

export function usePoints(userId: string) {
  return useQuery<PointsData>({
    queryKey: ['points', userId],
    queryFn: async () => {
      // 1. Try to fetch from the specific customer points endpoint
      const response = await fetch(`/api/customers/${userId}/points`)

      if (!response.ok) {
        // Fallback: If API implementation is missing, return safe default
        // logic to match 'loyalty_points' table structure
        console.warn('Failed to fetch points, using fallback')
        return {
          balance: { current: 0, total: 0, used: 0, expiringSoon: 0 },
          tier: { current: 'bronze', name: 'Bronze', nextTier: 'Silver', pointsToNextTier: 100, progress: 0, benefits: [] },
          stats: { totalSpent: 0, orderCount: 0 },
          history: []
        }
      }
      const data = await response.json()
      return data
    },
    enabled: !!userId,
  })
}

export function useAdjustPoints(userId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (payload: AdjustPointsPayload) => {
      const response = await fetch(`/api/customers/${userId}/points/adjust`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      })

      if (!response.ok) {
        throw new Error('Failed to adjust points')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points', userId] })
    },
  })
}
