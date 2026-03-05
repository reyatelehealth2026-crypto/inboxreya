"use client"

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileCheck, Calendar, AlertCircle, Paperclip, Clock, CheckCircle2, Upload } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { SlipUploadModal } from './SlipUploadModal'

interface OdooBdoSectionProps {
  userId: string
  memberId: string | null | undefined
}

interface BdoOrderRecord {
  id: number
  bdo_id: number
  bdo_name: string | null
  order_id: number
  order_name: string | null
  amount_total: number | null
  payment_reference: string | null
  partner_id: number | null
  customer_name: string | null
  line_user_id: string | null
  payment_method: string | null
  payment_status: string
  bdo_state: string | null
  bdo_date: string | null
  qr_data: string | null
  created_at: string
}

async function fetchPendingBdos(userId: string): Promise<{ bdo_orders: BdoOrderRecord[]; total: number }> {
  const res = await fetch(`/api/inbox/customers/${userId}/bdos`)
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch BDOs')
  }
  return json.data
}

export function OdooBdoSection({ userId, memberId }: OdooBdoSectionProps) {
  const queryClient = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-bdos', userId],
    queryFn: () => fetchPendingBdos(userId),
    staleTime: 30 * 1000,
  })

  const [selectedBdo, setSelectedBdo] = useState<BdoOrderRecord | null>(null)

  if (isLoading) {
    return <BdosSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ไม่สามารถโหลดข้อมูล BDO ได้
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.bdo_orders.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <FileCheck className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ไม่มี BDO ที่รอชำระเงิน</p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-[350px]">
        <div className="space-y-3 pr-4">
          {data.bdo_orders.map((bdo) => (
            <BdoItem
              key={bdo.id}
              bdo={bdo}
              onAttachSlip={() => setSelectedBdo(bdo)}
            />
          ))}
        </div>
      </ScrollArea>

      {selectedBdo && (
        <SlipUploadModal
          open={!!selectedBdo}
          onClose={() => setSelectedBdo(null)}
          bdo={selectedBdo}
          userId={userId}
          onSuccess={() => {
            setSelectedBdo(null)
            queryClient.invalidateQueries({ queryKey: ['customer-bdos', userId] })
            queryClient.invalidateQueries({ queryKey: ['customer-slips', userId] })
          }}
        />
      )}
    </>
  )
}

function BdoItem({ bdo, onAttachSlip }: { bdo: BdoOrderRecord; onAttachSlip: () => void }) {
  const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
    pending: { color: 'bg-amber-100 text-amber-700', label: 'รอชำระ', icon: Clock },
    slip_uploaded: { color: 'bg-blue-100 text-blue-700', label: 'อัพสลิปแล้ว', icon: Upload },
    matched: { color: 'bg-green-100 text-green-700', label: 'จับคู่แล้ว', icon: CheckCircle2 },
    paid: { color: 'bg-green-100 text-green-700', label: 'ชำระแล้ว', icon: CheckCircle2 },
  }

  const config = statusConfig[bdo.payment_status] || statusConfig.pending
  const StatusIcon = config.icon
  const isPending = bdo.payment_status === 'pending'

  const bdoDate = bdo.bdo_date || bdo.created_at
  const dateStr = bdoDate ? new Date(bdoDate).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '-'

  const paymentLabel = bdo.payment_method === 'promptpay' ? 'พร้อมเพย์' :
    bdo.payment_method === 'bank_transfer' ? 'โอนเงิน' : bdo.payment_method || '-'

  return (
    <div className={cn(
      "border rounded-lg p-3 hover:bg-gray-50 transition-colors",
      isPending && "border-amber-200 bg-amber-50/30"
    )}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="font-semibold text-sm">{bdo.bdo_name || `BDO-${bdo.bdo_id}`}</p>
            <Badge className={cn('text-xs h-5 gap-1', config.color)}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
          </div>
          {bdo.order_name && (
            <p className="text-xs text-blue-600 mb-0.5">
              {bdo.order_name}
            </p>
          )}
          <p className="text-xs text-gray-500">
            <Calendar className="h-3 w-3 inline mr-1" />
            {dateStr}
          </p>
          {bdo.payment_method && (
            <p className="text-xs text-gray-400 mt-0.5">
              ชำระ: {paymentLabel}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <span className="font-semibold text-gray-900 text-sm">
          ฿{bdo.amount_total?.toLocaleString('th-TH', { minimumFractionDigits: 0 }) || '0'}
        </span>
        {isPending && (
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 border-teal-300 text-teal-700 hover:bg-teal-50"
            onClick={onAttachSlip}
          >
            <Paperclip className="h-3 w-3" />
            แนบสลิป
          </Button>
        )}
      </div>
    </div>
  )
}

function BdosSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-3">
          <Skeleton className="h-4 w-32 mb-2" />
          <Skeleton className="h-3 w-24 mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      ))}
    </div>
  )
}
