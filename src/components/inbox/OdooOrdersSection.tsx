"use client"

import { useQuery } from '@tanstack/react-query'
import { Package, Calendar, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface OdooOrdersSectionProps {
  userId: string
  memberId: string | null | undefined
}

async function fetchCustomerOrders(memberId: string) {
  // Fetch orders from PHP backend via NextJS proxy
  // memberId is the Odoo partner_code / customer_ref
  const res = await fetch('/api/odoo-dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'odoo_orders',
      customer_ref: memberId,
      limit: 20,
      offset: 0,
    }),
  })
  const json = await res.json()
  if (!json.success) return []
  const orders = json.data?.orders || []
  // Filter to last 7 days only
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  return orders.filter((o: any) => {
    const d = new Date(o.date_order || o.updated_at || o.synced_at || 0)
    return !isNaN(d.getTime()) ? d >= sevenDaysAgo : true
  })
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
  const isPaid = order.is_paid || order.payment_status === 'paid'
  const isDelivered = order.is_delivered || order.delivery_status === 'delivered'
  const state = String(order.state || '').toLowerCase()

  let badgeClass = 'bg-gray-100 text-gray-700'
  let badgeLabel = order.state_display || order.state || '-'

  if (isPaid) {
    badgeClass = 'bg-green-100 text-green-700'
    badgeLabel = 'ชำระแล้ว'
  } else if (isDelivered) {
    badgeClass = 'bg-blue-100 text-blue-700'
    badgeLabel = 'จัดส่งแล้ว'
  } else if (state === 'cancel' || state === 'cancelled') {
    badgeClass = 'bg-red-100 text-red-700'
    badgeLabel = 'ยกเลิก'
  } else if (state === 'draft') {
    badgeClass = 'bg-gray-100 text-gray-700'
  } else if (badgeLabel && badgeLabel !== '-') {
    badgeClass = 'bg-amber-100 text-amber-700'
  }

  const orderDate = order.date_order || order.updated_at || order.synced_at
  const dateStr = orderDate ? new Date(orderDate).toLocaleDateString('th-TH') : '-'

  return (
    <div className={cn("border rounded-lg p-3 hover:bg-gray-50 transition-colors", isPaid && "bg-green-50/50")}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">{order.order_name || order.name || '-'}</p>
            <Badge className={cn('text-xs h-5', badgeClass)}>
              {badgeLabel}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            <Calendar className="h-3 w-3 inline mr-1" />
            {dateStr}
          </p>
        </div>
      </div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600">
          {order.items_count || 0} รายการ
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
