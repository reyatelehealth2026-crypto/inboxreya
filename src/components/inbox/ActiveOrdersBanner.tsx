"use client"

import { useState } from 'react'
import { Package, Truck, CheckCircle2, Clock, ChevronDown, ChevronUp, AlertCircle } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useActiveOrders, type ActiveOrder } from '@/hooks/use-active-orders'

interface ActiveOrdersBannerProps {
  userId: string
}

// Status label mapping
const stateConfig: Record<string, { label: string; color: string; icon: typeof Package }> = {
  'order.validated':       { label: 'ยืนยันออเดอร์',         color: 'bg-blue-100 text-blue-700',    icon: Package },
  'order.picker_assigned': { label: 'กำลังดำเนินการ',        color: 'bg-amber-100 text-amber-700',  icon: Clock },
  'order.picking':         { label: 'กำลังดำเนินการ',        color: 'bg-amber-100 text-amber-700',  icon: Clock },
  'order.picked':          { label: 'กำลังดำเนินการ',        color: 'bg-amber-100 text-amber-700',  icon: Clock },
  'order.packing':         { label: 'กำลังแพ็ค',             color: 'bg-amber-100 text-amber-700',  icon: Package },
  'order.packed':          { label: 'แพ็คเสร็จแล้ว',         color: 'bg-amber-100 text-amber-700',  icon: Package },
  'order.reserved':        { label: 'จองสินค้าแล้ว',         color: 'bg-blue-100 text-blue-700',    icon: Package },
  'order.awaiting_payment': { label: 'รอชำระเงิน',           color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  'order.paid':            { label: 'ชำระเงินแล้ว',          color: 'bg-green-100 text-green-700',  icon: CheckCircle2 },
  'order.to_delivery':     { label: 'เตรียมนำส่ง',           color: 'bg-orange-100 text-orange-700', icon: Truck },
  'order.in_delivery':     { label: 'ส่งมอบให้ขนส่งแล้ว',    color: 'bg-blue-100 text-blue-700',    icon: Truck },
  'order.delivered':       { label: 'ส่งมอบให้ขนส่งแล้ว',    color: 'bg-blue-100 text-blue-700',    icon: Truck },
  'delivery.departed':     { label: 'อยู่ระหว่างขนส่ง',      color: 'bg-blue-100 text-blue-700',    icon: Truck },
  'delivery.completed':    { label: 'ได้รับสินค้าเรียบร้อย',  color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
  'invoice.paid':          { label: 'ชำระเงินแล้ว',          color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle2 },
}

function getStateConfig(state: string | null) {
  if (!state) return { label: 'รอดำเนินการ', color: 'bg-gray-100 text-gray-600', icon: Clock }
  return stateConfig[state] || { label: 'กำลังดำเนินการ', color: 'bg-amber-100 text-amber-700', icon: Clock }
}

function formatCurrency(amount: number | null) {
  if (amount === null || amount === undefined) return '—'
  return `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '—'
  return new Date(dateStr).toLocaleDateString('th-TH', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function OrderCard({ order, isCompleted }: { order: ActiveOrder; isCompleted?: boolean }) {
  const config = getStateConfig(order.latestState)
  const StatusIcon = config.icon

  return (
    <div className={cn(
      'flex items-start gap-2.5 p-2.5 rounded-lg border transition-colors',
      isCompleted
        ? 'bg-emerald-50/50 border-emerald-100'
        : 'bg-white border-gray-200 hover:border-gray-300'
    )}>
      <div className={cn(
        'w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5',
        isCompleted ? 'bg-emerald-100' : 'bg-amber-100'
      )}>
        <StatusIcon className={cn(
          'h-3.5 w-3.5',
          isCompleted ? 'text-emerald-600' : 'text-amber-600'
        )} />
      </div>
      <div className="flex-1 min-w-0">
        {/* Header: Order ID */}
        <div className="flex items-center justify-between gap-2 mb-0.5">
          <span className="text-sm font-bold text-gray-900 truncate">
            {order.orderName || `Order #${order.orderId}`}
          </span>
          <span className="text-xs font-semibold text-gray-900 flex-shrink-0">
            {formatCurrency(order.amountTotal)}
          </span>
        </div>
        {/* Body: Status badge */}
        <div className="flex items-center justify-between gap-2">
          <Badge className={cn('text-[10px] h-5 gap-0.5 font-semibold', config.color)}>
            {isCompleted && '✅ '}{config.label}
          </Badge>
          <span className="text-[10px] text-gray-400 flex-shrink-0">
            {formatDate(order.lastWebhookAt || order.updatedAt)}
          </span>
        </div>
      </div>
    </div>
  )
}

export function ActiveOrdersBanner({ userId }: ActiveOrdersBannerProps) {
  const { data, isLoading, error } = useActiveOrders(userId)
  const [showCompleted, setShowCompleted] = useState(false)

  if (isLoading) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2 mb-2">
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-16 w-full rounded-lg" />
      </Card>
    )
  }

  if (error) {
    return (
      <Card className="p-3">
        <div className="flex items-center gap-2 text-gray-400 text-xs">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>ไม่สามารถโหลดสถานะออเดอร์ได้</span>
        </div>
      </Card>
    )
  }

  const activeOrders = data?.active || []
  const completedOrders = data?.completed || []

  if (activeOrders.length === 0 && completedOrders.length === 0) {
    return null // Don't show anything if no orders
  }

  return (
    <Card className="p-3 border-0 shadow-sm">
      {/* Active Orders */}
      {activeOrders.length > 0 && (
        <div>
          <div className="flex items-center gap-1.5 mb-2">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">
              ออเดอร์ค้างดำเนินการ ({activeOrders.length})
            </span>
          </div>
          <div className="space-y-1.5">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      )}

      {/* Completed Orders (collapsed by default) */}
      {completedOrders.length > 0 && (
        <div className={cn(activeOrders.length > 0 && 'mt-3 pt-3 border-t border-gray-100')}>
          <button
            onClick={() => setShowCompleted(!showCompleted)}
            className="flex items-center justify-between w-full text-left"
          >
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
              <span className="text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                สำเร็จแล้ว ({completedOrders.length})
              </span>
            </div>
            {showCompleted ? (
              <ChevronUp className="h-3.5 w-3.5 text-gray-400" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            )}
          </button>
          {showCompleted && (
            <div className="space-y-1.5 mt-2">
              {completedOrders.map((order) => (
                <OrderCard key={order.id} order={order} isCompleted />
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
