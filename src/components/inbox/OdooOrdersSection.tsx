"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Package, Calendar, DollarSign, AlertCircle, ChevronRight, ExternalLink } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface OdooOrdersSectionProps {
  userId: string
  memberId: string | null | undefined
}

// Mock function - replace with actual API call
async function fetchCustomerOrders(memberId: string) {
  // For now, return empty array. You'll need to implement an API endpoint
  // that fetches orders from Odoo by partner_code
  return []
}

export function OdooOrdersSection({ userId, memberId }: OdooOrdersSectionProps) {
  const { data: orders, isLoading, error } = useQuery({
    queryKey: ['odoo-orders', memberId],
    queryFn: () => fetchCustomerOrders(memberId!),
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })

  if (!memberId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ไม่มีเลขสมาชิก
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return <OrdersSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ไม่สามารถโหลดข้อมูลคำสั่งซื้อได้
        </AlertDescription>
      </Alert>
    )
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Package className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ยังไม่มีคำสั่งซื้อ</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3 pr-4">
        {orders.map((order: any) => (
          <OrderItem key={order.id} order={order} />
        ))}
      </div>
    </ScrollArea>
  )
}

function OrderItem({ order }: { order: any }) {
  const stateColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    sent: 'bg-blue-100 text-blue-700',
    sale: 'bg-green-100 text-green-700',
    done: 'bg-purple-100 text-purple-700',
    cancel: 'bg-red-100 text-red-700',
  }

  const stateLabels: Record<string, string> = {
    draft: 'ร่าง',
    sent: 'ส่งแล้ว',
    sale: 'ขาย',
    done: 'เสร็จสิ้น',
    cancel: 'ยกเลิก',
  }

  return (
    <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">{order.name}</p>
            <Badge className={cn('text-xs h-5', stateColors[order.state] || stateColors.draft)}>
              {stateLabels[order.state] || order.state}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            <Calendar className="h-3 w-3 inline mr-1" />
            {new Date(order.date_order).toLocaleDateString('th-TH')}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {order.order_line?.length || 0} รายการ
        </span>
        <span className="font-semibold text-gray-900">
          ฿{order.amount_total?.toLocaleString() || '0'}
        </span>
      </div>
    </div>
  )
}

function OrdersSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-3">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24 mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-3 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
