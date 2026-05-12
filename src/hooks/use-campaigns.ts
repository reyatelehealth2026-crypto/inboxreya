'use client'

import { useQuery } from '@tanstack/react-query'

const API_BASE = '/api/inbox'

export type CampaignStatus =
  | 'draft'
  | 'scheduled'
  | 'sending'
  | 'sent'
  | 'failed'
  | 'cancelled'

export interface CampaignTag {
  id: number
  name: string
  color: string
}

export interface Campaign {
  id: number
  title: string
  messageType: 'text' | 'image' | 'video' | 'flex' | 'multi'
  messageCount: number
  messages: unknown[]
  tags: CampaignTag[]
  tagIds: number[]
  targetMode: 'all' | 'tags' | 'segment' | 'customers'
  status: CampaignStatus
  scheduledAt: string | null
  sentAt: string | null
  totalRecipients: number
  deliveredCount: number
  readCount: number
  mediaUrl: string | null
  createdAt: string
  createdBy: number
}

export interface CampaignsResponse {
  success: boolean
  data: {
    campaigns: Campaign[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  error?: string
}

export interface UseCampaignsParams {
  page?: number
  limit?: number
  status?: string
  search?: string
}

export function useCampaigns(params?: UseCampaignsParams) {
  const { page = 1, limit = 20, status = '', search = '' } = params || {}

  return useQuery<CampaignsResponse>({
    queryKey: ['campaigns', { page, limit, status, search }],
    queryFn: async () => {
      const sp = new URLSearchParams()
      sp.set('page', String(page))
      sp.set('limit', String(limit))
      if (status) sp.set('status', status)
      if (search) sp.set('search', search)

      const res = await fetch(`${API_BASE}/broadcasts/campaigns?${sp.toString()}`)
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || 'Failed to fetch campaigns')
      }
      return res.json()
    },
    placeholderData: (previous) => previous,
  })
}
