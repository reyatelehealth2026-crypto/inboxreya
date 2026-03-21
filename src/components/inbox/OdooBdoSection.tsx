"use client"

import { useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import {
  FileCheck, Calendar, AlertCircle, Paperclip, Clock, CheckCircle2,
  Upload, XCircle, ExternalLink, ChevronDown, Eye, FileText, Truck, Send, Loader2,
} from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { useToast } from '@/hooks/use-toast'
import { SlipUploadModal } from './SlipUploadModal'
import { FlexPreview } from './FlexPreview'

const ODOO_BASE = 'https://erp.cnyrxapp.com'
const PAGE_SIZE = 5

interface OdooBdoSectionProps {
  userId: string
  memberId: string | null | undefined
}

export interface BdoOrderRecord {
  id: number
  bdo_id: number
  bdo_name: string | null
  order_id: number
  order_name: string | null
  amount_total: number | null
  payment_reference: string | null
  partner_id: number | null
  customer_name: string | null
  customer_ref?: string | null
  line_user_id: string | null
  payment_method: string | null
  payment_status: string
  slip_upload_id: number | null
  bdo_state: string | null
  bdo_date: string | null
  qr_data: string | null
  delivery_type?: string | null
  statement_pdf_path?: string | null
  created_at: string
  // slip info (joined from backend)
  slip_image_url?: string | null
  slip_amount?: number | null
  slip_transfer_date?: string | null
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
  const { toast } = useToast()
  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-bdos', userId],
    queryFn: () => fetchPendingBdos(userId),
    staleTime: 30 * 1000,
  })

  const [selectedBdo, setSelectedBdo] = useState<BdoOrderRecord | null>(null)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)
  const [unmatchingId, setUnmatchingId] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [sendingBdoId, setSendingBdoId] = useState<number | null>(null)
  const [previewBdo, setPreviewBdo] = useState<BdoOrderRecord | null>(null)
  const [previewFlex, setPreviewFlex] = useState<Record<string, any> | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [previewMeta, setPreviewMeta] = useState<{ bdo_ref: string; amount: number; has_qr: boolean } | null>(null)

  const handleOpenPreview = async (bdo: BdoOrderRecord) => {
    setPreviewBdo(bdo)
    setPreviewFlex(null)
    setPreviewMeta(null)
    setPreviewLoading(true)
    try {
      const res = await fetch('/api/odoo-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'preview_bdo_payment_notification',
          bdo_id: bdo.bdo_id,
          partner_id: bdo.partner_id || '',
        }),
      })
      const json = await res.json()
      if (json.success && json.data?.flex_message) {
        setPreviewFlex(json.data.flex_message.contents)
        setPreviewMeta({ bdo_ref: json.data.bdo_ref, amount: json.data.amount, has_qr: json.data.has_qr })
      } else {
        toast({ title: 'ไม่สามารถโหลด preview ได้', description: json.error || 'ลองอีกครั้ง', variant: 'destructive' })
        setPreviewBdo(null)
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
      setPreviewBdo(null)
    } finally {
      setPreviewLoading(false)
    }
  }

  const handleConfirmSend = async () => {
    if (!previewBdo) return
    const bdo = previewBdo
    setPreviewBdo(null)
    setPreviewFlex(null)
    setSendingBdoId(bdo.bdo_id)
    try {
      const res = await fetch('/api/odoo-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'send_bdo_payment_notification',
          bdo_id: bdo.bdo_id,
          partner_id: bdo.partner_id || '',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: '✅ ส่งแจ้งยอดสำเร็จ', description: `ส่ง ${bdo.bdo_name || 'BDO-' + bdo.bdo_id} ไปยัง LINE แล้ว` })
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: json.error || 'ไม่สามารถส่งแจ้งเตือนได้', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setSendingBdoId(null)
    }
  }

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ['customer-bdos', userId] })
    queryClient.invalidateQueries({ queryKey: ['customer-slips', userId] })
  }

  const handleUnmatch = async (slipUploadId: number, bdoId: number) => {
    if (!confirm('ยกเลิกการจับคู่สลิปกับ BDO นี้ ใช่ไหม?')) return
    setUnmatchingId(bdoId)
    try {
      const res = await fetch('/api/odoo-dashboard', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'odoo_slip_unmatch_api',
          local_slip_id: slipUploadId,
          bdo_id: bdoId,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'ยกเลิกการจับคู่เรียบร้อย' })
        refreshAll()
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: json.error || 'ไม่สามารถยกเลิกได้', variant: 'destructive' })
      }
    } catch {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setUnmatchingId(null)
    }
  }

  if (isLoading) return <BdosSkeleton />

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">ไม่สามารถโหลดข้อมูล BDO ได้</AlertDescription>
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

  const visible = data.bdo_orders.slice(0, visibleCount)
  const hasMore = data.bdo_orders.length > visibleCount

  return (
    <>
      <div className="space-y-3">
        {visible.map((bdo) => (
          <BdoCard
            key={bdo.id}
            bdo={bdo}
            onAttachSlip={() => setSelectedBdo(bdo)}
            onUnmatch={handleUnmatch}
            unmatchingId={unmatchingId}
            onPreviewSlip={setPreviewUrl}
            onSendNotification={() => handleOpenPreview(bdo)}
            sendingBdoId={sendingBdoId}
          />
        ))}

        {hasMore && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-gray-500 hover:text-gray-700"
            onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
          >
            <ChevronDown className="h-3 w-3 mr-1" />
            โหลดเพิ่ม ({data.bdo_orders.length - visibleCount} รายการ)
          </Button>
        )}
      </div>

      {selectedBdo && (
        <SlipUploadModal
          open={!!selectedBdo}
          onClose={() => setSelectedBdo(null)}
          bdo={selectedBdo}
          userId={userId}
          onSuccess={() => {
            setSelectedBdo(null)
            refreshAll()
          }}
        />
      )}

      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg p-2">
          {previewUrl && (
            <Image src={previewUrl} alt="สลิป" width={800} height={1200} className="w-full h-auto rounded-lg" unoptimized />
          )}
        </DialogContent>
      </Dialog>

      {/* BDO Payment Notification Preview Modal */}
      <Dialog open={!!previewBdo} onOpenChange={(open) => { if (!open) { setPreviewBdo(null); setPreviewFlex(null) } }}>
        <DialogContent className="max-w-sm sm:max-w-md p-0 overflow-hidden">
          <div className="px-4 pt-4 pb-2">
            <h3 className="text-sm font-semibold text-gray-800">
              ตัวอย่างข้อความที่จะส่งให้ลูกค้า
            </h3>
            {previewMeta && (
              <p className="text-xs text-gray-500 mt-0.5">
                {previewMeta.bdo_ref} &middot; ฿{previewMeta.amount?.toLocaleString('th-TH', { minimumFractionDigits: 2 })}
                {previewMeta.has_qr && ' &middot; มี QR พร้อมเพย์'}
              </p>
            )}
          </div>
          <div className="px-4 pb-3 max-h-[65vh] overflow-y-auto">
            {previewLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
                <span className="ml-2 text-sm text-gray-500">กำลังโหลด preview...</span>
              </div>
            ) : previewFlex ? (
              <FlexPreview flex={previewFlex} />
            ) : (
              <div className="text-center py-8 text-sm text-gray-400">ไม่สามารถแสดง preview ได้</div>
            )}
          </div>
          <div className="flex items-center gap-2 px-4 py-3 border-t bg-gray-50">
            <Button
              variant="outline"
              size="sm"
              className="flex-1 h-9"
              onClick={() => { setPreviewBdo(null); setPreviewFlex(null) }}
            >
              ยกเลิก
            </Button>
            <Button
              size="sm"
              className="flex-1 h-9 bg-[#06C755] hover:bg-[#05a547] text-white gap-1"
              disabled={previewLoading || !previewFlex}
              onClick={handleConfirmSend}
            >
              <Send className="h-3.5 w-3.5" />
              ส่งให้ลูกค้าเลย
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}

function BdoCard({
  bdo, onAttachSlip, onUnmatch, unmatchingId, onPreviewSlip, onSendNotification, sendingBdoId,
}: {
  bdo: BdoOrderRecord
  onAttachSlip: () => void
  onUnmatch: (slipUploadId: number, bdoId: number) => void
  unmatchingId: number | null
  onPreviewSlip: (url: string) => void
  onSendNotification: () => void
  sendingBdoId: number | null
}) {
  const statusConfig: Record<string, { color: string; label: string; icon: any }> = {
    pending: { color: 'bg-amber-100 text-amber-700', label: 'รอชำระ', icon: Clock },
    slip_uploaded: { color: 'bg-blue-100 text-blue-700', label: 'อัพสลิปแล้ว', icon: Upload },
    matched: { color: 'bg-green-100 text-green-700', label: 'จับคู่แล้ว', icon: CheckCircle2 },
    paid: { color: 'bg-green-100 text-green-700', label: 'ชำระแล้ว', icon: CheckCircle2 },
  }

  const config = statusConfig[bdo.payment_status] || statusConfig.pending
  const StatusIcon = config.icon
  const isPending = bdo.payment_status === 'pending'
  const isMatched = bdo.payment_status === 'matched' || bdo.payment_status === 'slip_uploaded'

  const bdoDate = bdo.bdo_date || bdo.created_at
  const dateStr = bdoDate ? new Date(bdoDate).toLocaleDateString('th-TH', {
    day: '2-digit', month: 'short', year: 'numeric',
  }) : '-'

  const paymentLabel = bdo.payment_method === 'promptpay' ? 'พร้อมเพย์' :
    bdo.payment_method === 'bank_transfer' ? 'โอนเงิน' : bdo.payment_method || ''

  const odooUrl = `${ODOO_BASE}/web#id=${bdo.bdo_id}&model=cny.bill.invoice.before.delivery&view_type=form`
  const soUrl = bdo.order_id ? `${ODOO_BASE}/web#id=${bdo.order_id}&model=sale.order&view_type=form` : null
  const phpBase = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
  const statementUrl = `${phpBase.replace(/\/$/, '')}/api/odoo-dashboard-api.php?action=statement_pdf&bdo_id=${bdo.bdo_id}`
  const bdoRefLabel = bdo.bdo_name || `BDO-${bdo.bdo_id}`
  const customerLabel = bdo.customer_name || bdo.customer_ref || null
  const deliveryTypeLabel = bdo.delivery_type === 'company'
    ? 'สายส่ง'
    : bdo.delivery_type === 'private'
      ? 'ขนส่งเอกชน'
      : null

  return (
    <div className={cn(
      "border rounded-xl p-3 transition-colors",
      isPending && "border-amber-200 bg-amber-50/30",
      isMatched && "border-green-200 bg-green-50/20",
      !isPending && !isMatched && "bg-white",
    )}>
      {/* Row 1: Name + Badge + BDO ID + Odoo link */}
      <div className="flex items-start justify-between mb-1.5">
        <div className="flex-1 min-w-0">
          <p className="text-[10px] uppercase tracking-wide text-gray-400 mb-0.5">เลข BDO</p>
          <div className="flex items-center gap-1.5 flex-wrap">
            <p className="font-semibold text-sm">{bdoRefLabel}</p>
            <Badge className={cn('text-[10px] h-[18px] gap-0.5 px-1.5', config.color)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {config.label}
            </Badge>
            {deliveryTypeLabel && (
              <Badge variant="outline" className="text-[10px] h-[18px] gap-0.5 px-1.5 border-sky-200 text-sky-700 bg-sky-50">
                <Truck className="h-2.5 w-2.5" />
                {deliveryTypeLabel}
              </Badge>
            )}
          </div>
          <div className="mt-1 space-y-0.5">
            <p className="text-[10px] text-gray-400">Odoo ID: #{bdo.bdo_id}</p>
            {customerLabel && (
              <p className="text-[11px] text-gray-500">ลูกค้า: {customerLabel}</p>
            )}
          </div>
        </div>
        <a
          href={odooUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0 ml-1"
          title="เปิดใน Odoo"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>

      {/* Row 2: SO + Date + Payment */}
      <div className="flex items-center gap-2 flex-wrap text-xs text-gray-500 mb-2">
        {bdo.order_name && (
          soUrl ? (
            <a href={soUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">
              {bdo.order_name}
            </a>
          ) : (
            <span className="text-blue-600 font-medium">{bdo.order_name}</span>
          )
        )}
        <span className="flex items-center gap-0.5">
          <Calendar className="h-3 w-3" /> {dateStr}
        </span>
        {paymentLabel && <span>ชำระ: {paymentLabel}</span>}
        {bdo.statement_pdf_path && (
          <a
            href={statementUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sky-700 hover:underline"
          >
            <FileText className="h-3 w-3" />
            Statement PDF
          </a>
        )}
      </div>

      {/* Row 3: Amount + Action */}
      <div className="flex items-center justify-between">
        <span className="font-bold text-base text-gray-900">
          ฿{bdo.amount_total?.toLocaleString('th-TH', { minimumFractionDigits: 0 }) || '0'}
        </span>
        <div className="flex gap-1.5">
          {isPending && (
            <>
              <Button
                size="sm"
                className="h-7 text-xs gap-1 bg-[#06C755] hover:bg-[#05a547] text-white"
                disabled={sendingBdoId === bdo.bdo_id}
                onClick={onSendNotification}
              >
                <Send className="h-3 w-3" />
                {sendingBdoId === bdo.bdo_id ? 'กำลังส่ง...' : 'ส่งแจ้งยอดผ่าน LINE'}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1 border-teal-300 text-teal-700 hover:bg-teal-50"
                onClick={onAttachSlip}
              >
                <Paperclip className="h-3 w-3" />
                แนบสลิป
              </Button>
            </>
          )}
          {isMatched && bdo.slip_upload_id && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs gap-1 text-gray-500 hover:text-red-600"
              disabled={unmatchingId === bdo.bdo_id}
              onClick={() => onUnmatch(bdo.slip_upload_id!, bdo.bdo_id)}
            >
              <XCircle className="h-3 w-3" />
              {unmatchingId === bdo.bdo_id ? 'กำลัง...' : 'ยกเลิก'}
            </Button>
          )}
        </div>
      </div>

      {/* Row 4: Slip thumbnail (if attached) */}
      {bdo.slip_image_url && (
        <div className="mt-2 flex items-center gap-2 p-1.5 bg-green-50 rounded-lg border border-green-100">
          <button
            type="button"
            className="flex-shrink-0 rounded overflow-hidden border border-green-200 hover:opacity-80 transition-opacity"
            onClick={() => onPreviewSlip(bdo.slip_image_url!)}
          >
            <Image
              src={bdo.slip_image_url}
              alt="สลิป"
              width={36}
              height={44}
              className="w-9 h-11 object-cover"
              unoptimized
            />
          </button>
          <div className="flex-1 min-w-0 text-xs">
            <span className="text-green-700 font-medium">✓ สลิปแนบแล้ว</span>
            {bdo.slip_amount != null && (
              <span className="text-gray-500 ml-1">฿{Number(bdo.slip_amount).toLocaleString()}</span>
            )}
            {bdo.slip_transfer_date && (
              <span className="text-gray-400 ml-1">
                {new Date(bdo.slip_transfer_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            size="sm"
            className="h-6 w-6 p-0 flex-shrink-0"
            onClick={() => onPreviewSlip(bdo.slip_image_url!)}
            title="ดูสลิป"
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  )
}

function BdosSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="border rounded-xl p-3">
          <Skeleton className="h-4 w-36 mb-2" />
          <Skeleton className="h-3 w-24 mb-1" />
          <Skeleton className="h-3 w-40 mb-2" />
          <div className="flex justify-between">
            <Skeleton className="h-5 w-20" />
            <Skeleton className="h-7 w-24" />
          </div>
        </div>
      ))}
    </div>
  )
}
