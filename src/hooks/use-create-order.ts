"use client"

import { useMutation } from '@tanstack/react-query'

export interface CreateOrderItem {
  sku: string
  name: string
  qty: number
  price?: number
}

export interface CreateOrderResult {
  orderId: number
  orderNumber: string
}

export function useCreateOrder() {
  return useMutation<
    CreateOrderResult,
    Error,
    { userId: number | string; items: CreateOrderItem[] }
  >({
    mutationFn: async ({ userId, items }) => {
      const res = await fetch('/api/inbox/orders/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, items }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create order')
      return data as CreateOrderResult
    },
  })
}
