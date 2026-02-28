"use client"

import { useQuery } from '@tanstack/react-query'

// Types
export interface OdooPartnerData {
  partnerId: number | null
  partnerName: string | null
  customerCode: string | null
}

export interface ActiveOrder {
  id: number
  orderId: number
  orderName: string | null
  lineUserId: string | null
  odooPartnerId: number | null
  customerName: string | null
  customerRef: string | null
  latestEventType: string | null
  latestState: string | null
  latestStateDisplay: string | null
  amountTotal: number | null
  currency: string
  lastWebhookAt: string | null
  updatedAt: string | null
}

export interface ActiveOrdersData {
  active: ActiveOrder[]
  completed: ActiveOrder[]
}

/**
 * Hook to resolve Odoo partner_id for a customer.
 * Uses "API Once & Local Sync" pattern via odoo_line_users table.
 */
export function useOdooPartner(userId: string | null) {
  return useQuery({
    queryKey: ['odoo-partner', userId],
    queryFn: async () => {
      const response = await fetch(`/api/inbox/customers/${userId}/odoo-partner`)
      if (!response.ok) throw new Error('Failed to fetch Odoo partner')
      const json = await response.json()
      return json.data as OdooPartnerData
    },
    enabled: !!userId,
    staleTime: 5 * 60 * 1000, // 5 minutes — partner rarely changes
  })
}

/**
 * Hook to fetch active and completed orders from odoo_order_projection.
 * Active = everything before invoice.paid
 * Completed = invoice.paid
 */
export function useActiveOrders(userId: string | null) {
  return useQuery({
    queryKey: ['active-orders', userId],
    queryFn: async () => {
      const response = await fetch(`/api/inbox/customers/${userId}/active-orders`)
      if (!response.ok) throw new Error('Failed to fetch active orders')
      const json = await response.json()
      return json.data as ActiveOrdersData
    },
    enabled: !!userId,
    staleTime: 30 * 1000, // 30 seconds — orders change frequently
  })
}
