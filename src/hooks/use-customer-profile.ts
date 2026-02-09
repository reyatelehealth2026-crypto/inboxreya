"use client"

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import type { CustomerProfile } from '@/types'
import { queryKeys } from '@/lib/query-keys'

export function useCustomerProfile(userId: string | null) {
  return useQuery({
    queryKey: queryKeys.customerProfile(userId),
    queryFn: async () => {
      const response = await fetch(`/api/inbox/customers/${userId}`)
      if (!response.ok) throw new Error('Failed to fetch customer profile')
      const data = await response.json()
      return data.data as CustomerProfile
    },
    enabled: !!userId,
    staleTime: 30 * 1000,
  })
}

export function useUpdateCustomerProfile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (params: {
      userId: string
      displayName?: string | null
      realName?: string | null
      memberId?: string | null
      phone?: string | null
      email?: string | null
      birthday?: string | null
      gender?: string | null
      address?: string | null
      district?: string | null
      province?: string | null
      postalCode?: string | null
      note?: string | null
    }) => {
      const response = await fetch(`/api/inbox/customers/${params.userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          displayName: params.displayName ?? null,
          realName: params.realName ?? null,
          memberId: params.memberId ?? null,
          phone: params.phone ?? null,
          email: params.email ?? null,
          birthday: params.birthday ?? null,
          gender: params.gender ?? null,
          address: params.address ?? null,
          district: params.district ?? null,
          province: params.province ?? null,
          postalCode: params.postalCode ?? null,
          note: params.note ?? null,
        }),
      })
      if (!response.ok) throw new Error('Failed to update customer profile')
      return response.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(variables.userId) })
      queryClient.invalidateQueries({ queryKey: queryKeys.conversationsRoot() })
    },
  })
}
