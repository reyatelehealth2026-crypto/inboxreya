"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { Receipt, Calendar, DollarSign, AlertCircle, Eye, Clock, CheckCircle2, XCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

interface OdooSlipsSectionProps {
  userId: string
}

interface SlipRecord {
  id: number
  line_user_id: string
  amount: number | null
  transfer_date: string | null
  image_path: string | null
  image_full_url: string | null
  uploaded_by: string | null
  status: string
  match_reason: string | null
  uploaded_at: string
  matched_at: string | null
  odoo_slip_id: number | null
  invoice_id: number | null
  order_id: number | null
}

async function fetchCustomerSlips(userId: string): Promise<{ slips: SlipRecord[]; total: number }> {
  const res = await fetch(`/api/inbox/customers/${userId}/slips`)
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to fetch slips')
  }
  return json.data
}

export function OdooSlipsSection({ userId }: OdooSlipsSectionProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-slips', userId],
    queryFn: () => fetchCustomerSlips(userId),
    staleTime: 30 * 1000, // 30 seconds
  })

  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  if (isLoading) {
    return <SlipsSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ไม่สามารถโหลดข้อมูลสลิปได้
        </AlertDescription>
      </Alert>
    )
  }

  if (!data || data.slips.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ยังไม่มีสลิปการชำระเงิน</p>
      </div>
    )
  }

  return (
    <>
      <ScrollArea className="h-[400px]">
        <div className="space-y-3 pr-4">
          {data.slips.map((slip) => (
            <SlipItem key={slip.id} slip={slip} onPreview={setPreviewUrl} />
          ))}
        </div>
      </ScrollArea>

      {/* Image preview dialog */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg p-2">
          {previewUrl && (
            <Image
              src={previewUrl}
              alt="สลิปการชำระเงิน"
              width={800}
              height={1200}
              className="w-full h-auto rounded-lg"
              unoptimized
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function SlipItem({ slip, onPreview }: { slip: SlipRecord; onPreview: (url: string) => void }) {
  const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
    pending: { color: 'bg-yellow-100 text-yellow-700', label: 'รอตรวจสอบ', icon: Clock },
    matched: { color: 'bg-green-100 text-green-700', label: 'จับคู่แล้ว', icon: CheckCircle2 },
    failed: { color: 'bg-red-100 text-red-700', label: 'ไม่สำเร็จ', icon: XCircle },
  }

  const config = statusConfig[slip.status] || statusConfig.pending
  const StatusIcon = config.icon

  return (
    <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex gap-3">
        {/* Thumbnail */}
        {slip.image_full_url && (
          <button
            type="button"
            onClick={() => onPreview(slip.image_full_url!)}
            className="flex-shrink-0 rounded-md overflow-hidden border hover:opacity-80 transition-opacity focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            <Image
              src={slip.image_full_url}
              alt="สลิป"
              width={64}
              height={80}
              className="w-16 h-20 object-cover"
              unoptimized
            />
          </button>
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Badge className={cn('text-xs h-5 gap-1', config.color)}>
              <StatusIcon className="h-3 w-3" />
              {config.label}
            </Badge>
            {slip.odoo_slip_id && (
              <Badge variant="outline" className="text-xs h-5">
                Odoo #{slip.odoo_slip_id}
              </Badge>
            )}
          </div>

          <div className="space-y-0.5">
            {slip.amount !== null && (
              <p className="text-sm font-semibold text-gray-900">
                <DollarSign className="h-3 w-3 inline mr-0.5" />
                ฿{slip.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
              </p>
            )}
            <p className="text-xs text-gray-500">
              <Calendar className="h-3 w-3 inline mr-1" />
              {new Date(slip.uploaded_at).toLocaleString('th-TH', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </p>
            {slip.uploaded_by && (
              <p className="text-xs text-gray-400">
                โดย: {slip.uploaded_by}
              </p>
            )}
            {slip.transfer_date && (
              <p className="text-xs text-gray-400">
                วันโอน: {new Date(slip.transfer_date).toLocaleDateString('th-TH')}
              </p>
            )}
          </div>
        </div>

        {/* Preview button */}
        {slip.image_full_url && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 w-7 p-0 flex-shrink-0 self-center"
            onClick={() => onPreview(slip.image_full_url!)}
            title="ดูสลิป"
          >
            <Eye className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  )
}

function SlipsSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-lg p-3 flex gap-3">
          <Skeleton className="w-16 h-20 rounded-md flex-shrink-0" />
          <div className="flex-1">
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-4 w-24 mb-1" />
            <Skeleton className="h-3 w-32" />
          </div>
        </div>
      ))}
    </div>
  )
}
