"use client"

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import {
  Receipt, Clock, CheckCircle2, XCircle,
  ExternalLink, Truck, Calendar, Link2, AlertCircle, Loader2, RefreshCw,
  ArrowLeftRight, X, ChevronDown, ChevronUp, MessageCircle, Pencil, Save,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { type SlipCenterSlip, type SlipCenterBdo, normalizeBdoPaymentStatus } from './SlipCenterClient'

const ODOO_BASE = 'https://erp.cnyrxapp.com'

interface CustomerSlipDetailProps {
  customerRef: string
  customerName: string
  partnerId: string
  lineUserId: string
  onBack: () => void
  onRefreshParent: () => void
}

interface CustomerDetailData {
  bdoOrders: SlipCenterBdo[]    // active (non-paid) BDOs
  paidBdos: SlipCenterBdo[]     // paid BDOs (filtered by API)
  pendingSlips: SlipCenterSlip[]
  allSlips: SlipCenterSlip[]
  matchedToday: SlipCenterSlip[]
  stats: {
    totalBdos: number
    totalPaidBdos: number
    totalPendingSlips: number
    totalMatchedToday: number
  }
}

interface BdoDetailData {
  bdo: any
  sale_orders: any[]
  outstanding_invoices: any[]
  credit_notes: any[]
  deposits: any[]
  slips: any[]
  summary: any
  odoo_url: string | null
  statement_pdf_url: string | null
  source: string
  stale_warning: string | null
}

async function fetchBdoDetail(bdoId: number, lineUserId: string): Promise<BdoDetailData> {
  const params = new URLSearchParams({ bdoId: String(bdoId), lineUserId })
  const res = await fetch(`/api/slip-center/bdo-detail?${params}`)
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load BDO detail')
  return json.data
}

async function fetchCustomerDetail(ref: string, partnerId: string, lineUserId: string): Promise<CustomerDetailData> {
  const params = new URLSearchParams()
  if (ref) params.set('ref', ref)
  if (partnerId) params.set('partnerId', partnerId)
  if (lineUserId) params.set('lineUserId', lineUserId)
  const res = await fetch(`/api/slip-center/customer-detail?${params}`)
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load')
  return json.data
}

/** Compact inline summary for each BDO card — auto-fetches from Odoo API */
function BdoCardInlineSummary({ bdoId, lineUserId, localSummary }: {
  bdoId: number
  lineUserId: string
  localSummary?: SlipCenterBdo['financial_summary']
}) {
  const { data, isLoading } = useQuery<BdoDetailData>({
    queryKey: ['bdo-detail', bdoId, lineUserId],
    queryFn: () => fetchBdoDetail(bdoId, lineUserId),
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  })

  // Use local financial_summary from DB context if API hasn't loaded yet
  const summary = data?.summary || localSummary
  const bdo = data?.bdo
  const soCount = data?.sale_orders?.length ?? 0
  const invCount = data?.outstanding_invoices?.length ?? 0
  const cnCount = data?.credit_notes?.length ?? 0

  if (isLoading) {
    return (
      <div className="mt-1.5 space-y-1">
        <div className="grid grid-cols-3 gap-1">
          <Skeleton className="h-9 rounded" />
          <Skeleton className="h-9 rounded" />
          <Skeleton className="h-9 rounded" />
        </div>
      </div>
    )
  }

  if (!summary && !bdo) return null

  const fmtBaht = (val?: number | null) =>
    val != null && !isNaN(Number(val)) ? `฿${Number(val).toLocaleString()}` : '-'

  return (
    <div className="mt-1.5 space-y-1.5">
      {/* BDO enriched info from Odoo */}
      {bdo && (
        <div className="flex items-center gap-1.5 text-[10px] text-gray-500 flex-wrap">
          {bdo.delivery_type && (
            <span className={cn(
              "px-1.5 py-0.5 rounded border text-[9px] font-medium",
              bdo.delivery_type === 'company' ? 'bg-sky-50 text-sky-600 border-sky-200' : 'bg-orange-50 text-orange-600 border-orange-200'
            )}>
              <Truck className="inline h-2 w-2 mr-0.5" />
              {bdo.delivery_type === 'company' ? 'สายส่ง' : bdo.delivery_type === 'private' ? 'ขนส่งเอกชน' : bdo.delivery_type}
            </span>
          )}
          {bdo.state_display && (
            <span className="text-[9px] text-gray-400">{bdo.state_display}</span>
          )}
        </div>
      )}

      {/* Financial Summary — compact grid */}
      {summary && (
        <div className="grid grid-cols-3 gap-1">
          <div className="bg-blue-50/70 rounded px-1.5 py-1 text-center border border-blue-100">
            <div className="text-[8px] text-blue-400 leading-tight">SO รอบนี้</div>
            <div className="text-[10px] font-bold text-blue-700">{fmtBaht(summary.so_amount)}</div>
          </div>
          {(summary.outstanding_amount ?? 0) > 0 ? (
            <div className="bg-amber-50/70 rounded px-1.5 py-1 text-center border border-amber-100">
              <div className="text-[8px] text-amber-400 leading-tight">ค้างชำระ</div>
              <div className="text-[10px] font-bold text-amber-700">{fmtBaht(summary.outstanding_amount)}</div>
            </div>
          ) : (
            <div className="bg-gray-50/70 rounded px-1.5 py-1 text-center border border-gray-100">
              <div className="text-[8px] text-gray-400 leading-tight">ค้างชำระ</div>
              <div className="text-[10px] font-semibold text-gray-500">-</div>
            </div>
          )}
          <div className="bg-emerald-50/70 rounded px-1.5 py-1 text-center border border-emerald-200">
            <div className="text-[8px] text-emerald-400 leading-tight">Net to Pay</div>
            <div className="text-[10px] font-bold text-emerald-700">{fmtBaht(summary.net_to_pay)}</div>
          </div>
        </div>
      )}

      {/* SO / Invoice / CN counts */}
      {(soCount > 0 || invCount > 0 || cnCount > 0) && (
        <div className="flex items-center gap-2 text-[9px] text-gray-400">
          {soCount > 0 && <span>📦 {soCount} SO</span>}
          {invCount > 0 && <span>📄 {invCount} INV ค้าง</span>}
          {cnCount > 0 && <span>💳 {cnCount} CN</span>}
        </div>
      )}
    </div>
  )
}

export function CustomerSlipDetail({
  customerRef, customerName, partnerId, lineUserId, onBack, onRefreshParent,
}: CustomerSlipDetailProps) {
  const { toast } = useToast()
  const qc = useQueryClient()
  const router = useRouter()

  const { data, isLoading, isFetching } = useQuery<CustomerDetailData>({
    queryKey: ['slip-center-detail', customerRef, partnerId],
    queryFn: () => fetchCustomerDetail(customerRef, partnerId, lineUserId),
    staleTime: 20000,
  })

  // Selection state for manual matching
  const [selectedSlipId, setSelectedSlipId] = useState<number | null>(null)
  const [selectedBdoId, setSelectedBdoId] = useState<number | null>(null)
  const [matchNote, setMatchNote] = useState('')
  const [isMatching, setIsMatching] = useState(false)
  const [isUnmatching, setIsUnmatching] = useState<number | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  // Inline slip edit state
  const [editingSlipId, setEditingSlipId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<{ amount: string; transferDate: string; note: string }>({ amount: '', transferDate: '', note: '' })
  const [isSavingEdit, setIsSavingEdit] = useState(false)

  // Paid BDO section toggle
  const [showPaidBdos, setShowPaidBdos] = useState(false)

  // BDO detail modal
  const [bdoDetailId, setBdoDetailId] = useState<number | null>(null)
  const [bdoDetailData, setBdoDetailData] = useState<BdoDetailData | null>(null)
  const [bdoDetailLoading, setBdoDetailLoading] = useState(false)
  const [bdoDetailError, setBdoDetailError] = useState<string | null>(null)

  const openBdoDetail = useCallback(async (bdoId: number) => {
    setBdoDetailId(bdoId)
    setBdoDetailError(null)
    // Check if inline summary already cached this data
    const cached = qc.getQueryData<BdoDetailData>(['bdo-detail', bdoId, lineUserId])
    if (cached) {
      setBdoDetailData(cached)
      setBdoDetailLoading(false)
      return
    }
    setBdoDetailData(null)
    setBdoDetailLoading(true)
    try {
      const d = await fetchBdoDetail(bdoId, lineUserId)
      setBdoDetailData(d)
      // Also populate the cache for inline summary
      qc.setQueryData(['bdo-detail', bdoId, lineUserId], d)
    } catch (e) {
      setBdoDetailError(e instanceof Error ? e.message : 'เกิดข้อผิดพลาด')
    } finally {
      setBdoDetailLoading(false)
    }
  }, [lineUserId, qc])

  const selectedSlip = useMemo(() =>
    data?.pendingSlips.find(s => s.id === selectedSlipId), [data, selectedSlipId])
  const selectedBdo = useMemo(() =>
    data?.bdoOrders.find(b => b.bdo_id === selectedBdoId), [data, selectedBdoId])

  const canMatch = selectedSlipId !== null && selectedBdoId !== null

  // Auto-suggest: 3-pass matching algorithm (mirrors computeSmartMatches in odoo-dashboard.js)
  const suggestions = useMemo(() => {
    if (!data) return []
    const pairs: { slip: SlipCenterSlip; bdo: SlipCenterBdo; confidence: string; diff: number }[] = []
    const usedSlips = new Set<number>()
    const usedBdos = new Set<number>()

    const pendingSlips = data.pendingSlips
    const pendingBdos = data.bdoOrders

    // Pass 0: bdo_id direct match — highest confidence
    pendingSlips.forEach(slip => {
      if (usedSlips.has(slip.id) || !slip.bdo_id) return
      pendingBdos.forEach(bdo => {
        if (usedBdos.has(bdo.bdo_id)) return
        if (String(slip.bdo_id) !== String(bdo.bdo_id)) return
        const slipAmt = parseFloat(String(slip.amount || 0))
        const bdoAmt = parseFloat(String(bdo.amount_total || bdo.amount_net_to_pay || 0))
        const diff = slipAmt - bdoAmt
        pairs.push({ slip, bdo, confidence: 'exact_bdo', diff })
        usedSlips.add(slip.id)
        usedBdos.add(bdo.bdo_id)
      })
    })

    // Pass 1: exact amount match (unique candidate only, ≤1 THB tolerance)
    pendingSlips.forEach(slip => {
      if (usedSlips.has(slip.id)) return
      const slipAmt = parseFloat(String(slip.amount || 0))
      if (slipAmt <= 0) return
      const candidates = pendingBdos.filter(bdo => {
        if (usedBdos.has(bdo.bdo_id)) return false
        const bdoAmt = parseFloat(String(bdo.amount_total || bdo.amount_net_to_pay || 0))
        return Math.abs(slipAmt - bdoAmt) <= 1
      })
      if (candidates.length === 1) {
        const bdo = candidates[0]
        const bdoAmt = parseFloat(String(bdo.amount_total || bdo.amount_net_to_pay || 0))
        pairs.push({ slip, bdo, confidence: 'exact_amount', diff: slipAmt - bdoAmt })
        usedSlips.add(slip.id)
        usedBdos.add(bdo.bdo_id)
      }
    })

    // Pass 2: ±5% amount match (unique candidate only)
    pendingSlips.forEach(slip => {
      if (usedSlips.has(slip.id)) return
      const slipAmt = parseFloat(String(slip.amount || 0))
      if (slipAmt <= 0) return
      const candidates = pendingBdos.filter(bdo => {
        if (usedBdos.has(bdo.bdo_id)) return false
        const bdoAmt = parseFloat(String(bdo.amount_total || bdo.amount_net_to_pay || 0))
        if (bdoAmt <= 0) return false
        return Math.abs(slipAmt - bdoAmt) / bdoAmt <= 0.05
      })
      if (candidates.length === 1) {
        const bdo = candidates[0]
        const bdoAmt = parseFloat(String(bdo.amount_total || bdo.amount_net_to_pay || 0))
        pairs.push({ slip, bdo, confidence: 'partial', diff: slipAmt - bdoAmt })
        usedSlips.add(slip.id)
        usedBdos.add(bdo.bdo_id)
      }
    })

    return pairs
  }, [data])

  const refreshDetail = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['slip-center-detail', customerRef, partnerId] })
  }, [qc, customerRef, partnerId])

  // Use API-filtered lists directly (customer-detail route already splits them)
  const activeBdos = data?.bdoOrders ?? []
  const paidBdos   = data?.paidBdos  ?? []

  const handleOpenEdit = useCallback((slip: SlipCenterSlip) => {
    setEditingSlipId(slip.id)
    setEditForm({
      amount: slip.amount != null ? String(slip.amount) : '',
      transferDate: slip.transfer_date ? String(slip.transfer_date).slice(0, 10) : '',
      note: slip.match_reason || '',
    })
  }, [])

  const handleSaveEdit = useCallback(async () => {
    if (!editingSlipId) return
    setIsSavingEdit(true)
    try {
      const res = await fetch('/api/slip-center/edit', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          localSlipId: editingSlipId,
          amount: editForm.amount !== '' ? Number(editForm.amount) : undefined,
          transferDate: editForm.transferDate || undefined,
          note: editForm.note || undefined,
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'บันทึกสำเร็จ', description: `อัปเดตสลิป #${editingSlipId}` })
        setEditingSlipId(null)
        // Optimistic update in cache
        qc.setQueryData<CustomerDetailData>(
          ['slip-center-detail', customerRef, partnerId],
          old => {
            if (!old) return old
            const update = (slips: SlipCenterSlip[]) =>
              slips.map(s => s.id === editingSlipId ? {
                ...s,
                amount: editForm.amount !== '' ? Number(editForm.amount) : s.amount,
                transfer_date: editForm.transferDate || s.transfer_date,
              } : s)
            return {
              ...old,
              pendingSlips: update(old.pendingSlips),
              allSlips: update(old.allSlips),
            }
          }
        )
        refreshDetail()
      } else {
        toast({ title: 'บันทึกไม่สำเร็จ', description: json.error || 'เกิดข้อผิดพลาด', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Network error', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsSavingEdit(false)
    }
  }, [editingSlipId, editForm, customerRef, partnerId, qc, refreshDetail, toast])

  const handleMatch = useCallback(async (slipId: number, bdoId: number, note?: string) => {
    setIsMatching(true)
    try {
      const slip = data?.pendingSlips.find(s => s.id === slipId) || data?.allSlips.find(s => s.id === slipId)
      const bdo = data?.bdoOrders.find(b => b.bdo_id === bdoId)

      const res = await fetch('/api/slip-center/match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipInboxId: slip?.slip_inbox_id || slip?.odoo_slip_id || 0,
          lineUserId: slip?.line_user_id || lineUserId,
          lineAccountId: slip?.line_account_id || 0,
          localSlipId: slipId,
          matches: [{ bdo_id: bdoId, amount: parseFloat(String(bdo?.amount_total || 0)) }],
          note: note || matchNote || 'Matched from Slip Center',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'จับคู่สำเร็จ', description: `สลิป #${slipId} ↔ BDO #${bdoId}` })
        setSelectedSlipId(null)
        setSelectedBdoId(null)
        setMatchNote('')
        // Optimistic update: remove matched slip from pending list immediately
        qc.setQueryData<CustomerDetailData>(
          ['slip-center-detail', customerRef, partnerId],
          old => old ? {
            ...old,
            pendingSlips: old.pendingSlips.filter(s => s.id !== slipId),
            stats: { ...old.stats, totalPendingSlips: Math.max(0, old.stats.totalPendingSlips - 1) },
          } : old
        )
        // Background revalidation
        refreshDetail()
        onRefreshParent()
      } else {
        toast({ title: 'จับคู่ไม่สำเร็จ', description: json.error || 'เกิดข้อผิดพลาด', variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Network error', description: err instanceof Error ? err.message : '', variant: 'destructive' })
    } finally {
      setIsMatching(false)
    }
  }, [data, lineUserId, matchNote, customerRef, partnerId, qc, refreshDetail, onRefreshParent, toast])

  const handleUnmatch = useCallback(async (slip: SlipCenterSlip) => {
    if (!confirm('ยกเลิกการจับคู่สลิปนี้ ใช่ไหม?')) return
    setIsUnmatching(slip.id)
    try {
      const res = await fetch('/api/slip-center/unmatch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slipInboxId: slip.slip_inbox_id || slip.odoo_slip_id || 0,
          lineUserId: slip.line_user_id || lineUserId,
          localSlipId: slip.id,
          reason: 'Unmatched from Slip Center',
        }),
      })
      const json = await res.json()
      if (json.success) {
        toast({ title: 'ยกเลิกการจับคู่เรียบร้อย' })
        refreshDetail()
        onRefreshParent()
      } else {
        toast({ title: 'เกิดข้อผิดพลาด', description: json.error, variant: 'destructive' })
      }
    } catch (err) {
      toast({ title: 'Network error', variant: 'destructive' })
    } finally {
      setIsUnmatching(null)
    }
  }, [lineUserId, refreshDetail, onRefreshParent, toast])

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Skeleton className="h-64 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    )
  }

  const pendingSlips = data?.pendingSlips || []
  const matchedToday = data?.matchedToday || []

  return (
    <div className="space-y-4">
      {/* Customer Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <h2 className="font-bold text-base text-gray-900 truncate">{customerRef}</h2>
            <p className="text-sm text-gray-500 truncate">{customerName}</p>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            {/* Chat button */}
            {lineUserId && (
              <Button
                size="sm"
                onClick={() => router.push(`/inbox?userId=${encodeURIComponent(lineUserId)}`)}
                className="h-8 gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                แชท
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={refreshDetail} disabled={isFetching} className="h-8 gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </div>
        <div className="flex gap-1.5 mt-3 flex-wrap">
          <Badge variant="outline" className={cn(
            "text-[10px] gap-0.5 font-semibold",
            pendingSlips.length > 0 ? "border-amber-300 text-amber-700 bg-amber-50" : "border-gray-200 text-gray-400"
          )}>
            <Receipt className="h-2.5 w-2.5" /> สลิปรอจับคู่ {pendingSlips.length}
          </Badge>
          <Badge variant="outline" className={cn(
            "text-[10px] gap-0.5 font-semibold",
            activeBdos.length > 0 ? "border-violet-300 text-violet-700 bg-violet-50" : "border-gray-200 text-gray-400"
          )}>
            <AlertCircle className="h-2.5 w-2.5" /> BDO ค้างชำระ {activeBdos.length}
          </Badge>
          {paidBdos.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-0.5 border-green-300 text-green-700 bg-green-50 font-semibold">
              <CheckCircle2 className="h-2.5 w-2.5" /> BDO จ่ายแล้ว {paidBdos.length}
            </Badge>
          )}
          {matchedToday.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-0.5 border-blue-300 text-blue-700 bg-blue-50 font-semibold">
              <Link2 className="h-2.5 w-2.5" /> จับคู่วันนี้ {matchedToday.length}
            </Badge>
          )}
        </div>
      </div>

      {/* Auto-Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-violet-50 rounded-xl border border-violet-200 p-4">
          <h3 className="text-sm font-semibold text-violet-800 mb-2 flex items-center gap-1.5">
            <Link2 className="h-4 w-4" /> แนะนำจับคู่อัตโนมัติ ({suggestions.length})
          </h3>
          <div className="space-y-2">
            {suggestions.map((sg, i) => (
              <div key={i} className="flex items-center gap-3 bg-white rounded-lg p-2.5 border border-violet-100">
                {/* Slip side */}
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  {sg.slip.image_full_url && (
                    <button type="button" onClick={() => setPreviewUrl(sg.slip.image_full_url!)}>
                      <Image src={sg.slip.image_full_url} alt="" width={32} height={40} className="w-8 h-10 object-cover rounded border" unoptimized />
                    </button>
                  )}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-gray-800 truncate">สลิป #{sg.slip.id}</p>
                    <p className="text-xs text-emerald-600 font-bold">
                      ฿{Number(sg.slip.amount || 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <ArrowLeftRight className="h-4 w-4 text-violet-400 flex-shrink-0" />

                {/* BDO side */}
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-800 truncate">{sg.bdo.bdo_name || `BDO-${sg.bdo.bdo_id}`}</p>
                  <p className="text-xs text-violet-600 font-bold">
                    ฿{Number(sg.bdo.amount_total || 0).toLocaleString()}
                  </p>
                </div>

                <Badge className={cn(
                  "text-[9px] h-4 px-1.5",
                  sg.confidence === 'exact_bdo' ? 'bg-blue-100 text-blue-700' :
                  sg.confidence === 'exact_amount' ? 'bg-green-100 text-green-700' :
                  'bg-amber-100 text-amber-700'
                )}>
                  {sg.confidence === 'exact_bdo' ? 'bdo_id ตรง' :
                   sg.confidence === 'exact_amount' ? 'ยอดตรง' : '±5%'}
                </Badge>

                <Button
                  size="sm"
                  className="h-7 text-xs gap-1 bg-violet-600 hover:bg-violet-700"
                  onClick={() => handleMatch(sg.slip.id, sg.bdo.bdo_id, `Auto-suggest: ${sg.confidence}`)}
                  disabled={isMatching}
                >
                  {isMatching ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                  ยืนยัน
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Split View: BDOs ↔ Slips */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Left: Active (non-paid) BDOs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-violet-50/40">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <AlertCircle className="h-4 w-4 text-violet-500" />
              BDO ค้างชำระ
              <span className="ml-auto flex items-center gap-1">
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded-full",
                  activeBdos.length > 0 ? "bg-violet-100 text-violet-700" : "bg-gray-100 text-gray-400"
                )}>{activeBdos.length}</span>
              </span>
            </h3>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2 space-y-2.5">
            {activeBdos.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-400">ไม่มี BDO ค้างชำระ</p>
            ) : activeBdos.slice().sort((a, b) => {
              const rank: Record<string, number> = { pending: 0, partial: 1, slip_uploaded: 2, matched: 3, paid: 4 }
              return (rank[normalizeBdoPaymentStatus(a).key] ?? 99) - (rank[normalizeBdoPaymentStatus(b).key] ?? 99)
            }).map((bdo: SlipCenterBdo) => {
              const isSelected = selectedBdoId === bdo.bdo_id
              const ps = normalizeBdoPaymentStatus(bdo)
              const isPending = ps.key === 'pending' || ps.key === 'partial'
              const isMatched = ps.key === 'matched' || ps.key === 'slip_uploaded'
              const deliveryLabel = bdo.delivery_type === 'company' ? 'สายส่ง (จ่ายทีหลัง)' : bdo.delivery_type === 'private' ? 'ขนส่งเอกชน (จ่ายก่อนส่ง)' : null
              const fmtDate = (raw?: string | null) => {
                if (!raw) return '-'
                const dt = new Date(raw)
                return isNaN(dt.getTime()) ? String(raw).slice(0, 10) : dt.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short', year: '2-digit' })
              }
              const payMethodLabel = bdo.payment_method === 'promptpay' ? 'พร้อมเพย์' : bdo.payment_method === 'bank_transfer' ? 'โอนเงิน' : bdo.payment_method || ''
              const linkedSlip = data?.allSlips?.find(s => s.bdo_id && String(s.bdo_id) === String(bdo.bdo_id))

              return (
                <div
                  key={bdo.bdo_id}
                  className={cn(
                    "rounded-xl border-[1.5px] p-3 transition-all",
                    isSelected
                      ? "border-violet-400 ring-2 ring-violet-200"
                      : isPending
                      ? "border-amber-200 bg-amber-50/60"
                      : isMatched
                      ? "border-blue-200 bg-blue-50/40"
                      : "border-gray-200 bg-white"
                  )}
                >
                  {/* Row 1: BDO name + badges */}
                  <div className="flex items-start justify-between mb-1">
                    <div className="flex-1 min-w-0">
                      <p className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">เลข BDO</p>
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <button
                          type="button"
                          onClick={() => openBdoDetail(bdo.bdo_id)}
                          className="text-sm font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 transition-colors"
                          title="ดูรายละเอียด BDO"
                        >
                          {bdo.bdo_name || `BDO-${bdo.bdo_id}`}
                        </button>
                        <Badge className={cn(
                          "text-[9px] h-4 px-1.5 gap-0.5",
                          ps.key === 'pending' ? 'bg-amber-100 text-amber-700 border-amber-200' :
                          ps.key === 'partial' ? 'bg-orange-100 text-orange-700 border-orange-200' :
                          ps.key === 'slip_uploaded' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                          ps.key === 'matched' ? 'bg-green-100 text-green-700 border-green-200' :
                          'bg-gray-100 text-gray-500'
                        )}>
                          {ps.key === 'pending' && <Clock className="h-2 w-2" />}
                          {ps.key === 'partial' && <Clock className="h-2 w-2" />}
                          {ps.key === 'matched' && <CheckCircle2 className="h-2 w-2" />}
                          {ps.label}
                        </Badge>
                        {deliveryLabel && (
                          <Badge variant="outline" className="text-[9px] h-4 gap-0.5 px-1.5 border-sky-200 text-sky-600 bg-sky-50">
                            <Truck className="h-2 w-2" /> {deliveryLabel}
                          </Badge>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-0.5">Odoo ID: #{bdo.bdo_id}</p>
                    </div>
                    <a
                      href={`${ODOO_BASE}/web#id=${bdo.bdo_id}&model=cny.bill.invoice.before.delivery&view_type=form`}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      title="เปิดใน Odoo"
                      className="text-gray-300 hover:text-blue-500 transition-colors flex-shrink-0 ml-1.5"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  {/* Row 2: SO + date + payment method */}
                  <div className="flex items-center gap-2 flex-wrap text-[11px] text-gray-500 mb-1.5">
                    {bdo.order_id ? (
                      <a
                        href={`${ODOO_BASE}/web#id=${bdo.order_id}&model=sale.order&view_type=form`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-600 font-medium hover:underline"
                        onClick={e => e.stopPropagation()}
                      >
                        {bdo.order_name || '-'}
                      </a>
                    ) : bdo.order_name ? (
                      <span>{bdo.order_name}</span>
                    ) : null}
                    <span className="flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {fmtDate(bdo.bdo_date || bdo.created_at)}
                    </span>
                    {payMethodLabel && <span>ชำระ: {payMethodLabel}</span>}
                  </div>

                  {/* Row 2.5: Inline financial summary from Odoo */}
                  <BdoCardInlineSummary
                    bdoId={bdo.bdo_id}
                    lineUserId={lineUserId}
                    localSummary={bdo.financial_summary}
                  />

                  {/* Row 3: Amount + action buttons */}
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-base font-bold text-gray-900">
                      ฿{Number(bdo.amount_total || 0).toLocaleString()}
                    </span>
                    <div className="flex items-center gap-1.5">
                      {isPending && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); setSelectedBdoId(bdo.bdo_id) }}
                          className="flex items-center gap-1 bg-emerald-600 text-white border-none rounded-md px-2.5 py-1 text-[11px] font-medium hover:bg-emerald-700 transition-colors"
                        >
                          <Receipt className="h-3 w-3" /> แนบสลิป
                        </button>
                      )}
                      {isMatched && (
                        <span className="flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 rounded-md px-2 py-1 text-[10px] font-semibold">
                          <CheckCircle2 className="h-2.5 w-2.5" /> จับคู่แล้ว
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Row 4: Linked slip thumbnail */}
                  {linkedSlip && linkedSlip.image_full_url && (
                    <div className="mt-2 flex items-center gap-2 p-1.5 bg-emerald-50/60 rounded-lg border border-emerald-100">
                      <button type="button" onClick={() => setPreviewUrl(linkedSlip.image_full_url!)}>
                        <Image src={linkedSlip.image_full_url} alt="" width={36} height={44} className="w-9 h-11 object-cover rounded border border-emerald-200 cursor-pointer hover:opacity-80" unoptimized />
                      </button>
                      <div className="flex-1 text-xs">
                        <span className="text-emerald-600 font-medium">✔ สลิปแนบแล้ว</span>
                        {linkedSlip.amount != null && <span className="text-gray-500 ml-1.5">฿{Number(linkedSlip.amount).toLocaleString()}</span>}
                        {linkedSlip.transfer_date && <span className="text-gray-400 ml-1.5">{fmtDate(linkedSlip.transfer_date)}</span>}
                      </div>
                    </div>
                  )}

                  {isSelected && (
                    <p className="text-[9px] text-violet-600 font-semibold mt-1.5 bg-violet-50 rounded px-2 py-0.5">✓ เลือกแล้ว — เลือกสลิปทางขวาเพื่อจับคู่</p>
                  )}
                </div>
              )
            })}
          </div>

          {/* Paid BDOs collapsible */}
          {paidBdos.length > 0 && (
            <div className="border-t border-gray-100">
              <button
                type="button"
                onClick={() => setShowPaidBdos(v => !v)}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
              >
                {showPaidBdos ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
                <span className="font-medium">BDO จ่ายแล้ว</span>
                <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-1.5 py-0.5 rounded-full ml-1">{paidBdos.length}</span>
              </button>
              {showPaidBdos && (
                <div className="px-2 pb-2 space-y-1.5 max-h-[30vh] overflow-y-auto bg-emerald-50/30">
                  {paidBdos.map((bdo: SlipCenterBdo) => (
                    <div key={bdo.bdo_id} className="rounded-lg border border-emerald-100 bg-white p-2">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-gray-700 truncate">{bdo.bdo_name || `BDO-${bdo.bdo_id}`}</p>
                          {bdo.order_name && <p className="text-[10px] text-blue-500 truncate">{bdo.order_name}</p>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                          <span className="text-xs font-bold text-gray-800">฿{Number(bdo.amount_total || 0).toLocaleString()}</span>
                          <Badge className="text-[9px] h-4 px-1.5 bg-emerald-100 text-emerald-700">จ่ายแล้ว</Badge>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Pending Slips with inline edit */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-amber-50/40">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-amber-500" />
              สลิปรอจับคู่
              <span className="ml-auto flex items-center gap-1">
                <span className={cn(
                  "text-xs font-bold px-1.5 py-0.5 rounded-full",
                  pendingSlips.length > 0 ? "bg-amber-100 text-amber-700" : "bg-gray-100 text-gray-400"
                )}>{pendingSlips.length}</span>
              </span>
            </h3>
          </div>
          <div className="max-h-[60vh] overflow-y-auto p-2 space-y-2">
            {pendingSlips.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-400">ไม่มีสลิปรอจับคู่</p>
            ) : pendingSlips.map(slip => {
              const isSelected = selectedSlipId === slip.id
              const isEditing = editingSlipId === slip.id
              return (
                <div
                  key={slip.id}
                  className={cn(
                    "rounded-lg border transition-all",
                    isSelected
                      ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
                      : isEditing
                      ? "border-blue-300 bg-blue-50/40"
                      : "border-gray-100 bg-white"
                  )}
                >
                  {/* Main slip row */}
                  <div className="flex gap-2 p-2.5">
                    {slip.image_full_url ? (
                      <button
                        type="button"
                        className="flex-shrink-0"
                        onClick={e => { e.stopPropagation(); setPreviewUrl(slip.image_full_url!) }}
                      >
                        <Image src={slip.image_full_url} alt="" width={36} height={44} className="w-9 h-11 object-cover rounded border hover:opacity-80 transition-opacity" unoptimized />
                      </button>
                    ) : (
                      <div className="w-9 h-11 bg-gray-100 rounded border flex items-center justify-center flex-shrink-0">
                        <Receipt className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-gray-800">สลิป #{slip.id}</p>
                        <div className="flex items-center gap-1">
                          <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700">รอจับคู่</Badge>
                          {/* Edit toggle button */}
                          <button
                            type="button"
                            title="แก้ไขสลิป"
                            onClick={() => {
                              if (isEditing) {
                                setEditingSlipId(null)
                              } else {
                                handleOpenEdit(slip)
                                setSelectedSlipId(null)
                              }
                            }}
                            className={cn(
                              "p-0.5 rounded transition-colors",
                              isEditing ? "text-blue-600 bg-blue-100" : "text-gray-400 hover:text-blue-600 hover:bg-blue-50"
                            )}
                          >
                            <Pencil className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-sm font-bold text-emerald-600">
                        ฿{Number(slip.amount || 0).toLocaleString()}
                      </p>
                      {slip.transfer_date && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5 mt-0.5">
                          <Calendar className="h-2.5 w-2.5" />
                          {String(slip.transfer_date).slice(0, 10)}
                        </p>
                      )}
                      {slip.uploaded_at && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          อัพ: {new Date(slip.uploaded_at).toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: '2-digit', month: 'short' })}
                          {' '}{new Date(slip.uploaded_at).toLocaleTimeString('th-TH', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                    {/* Select for matching button */}
                    <button
                      type="button"
                      onClick={() => setSelectedSlipId(isSelected ? null : slip.id)}
                      className={cn(
                        "self-center flex-shrink-0 px-2 py-1 rounded-lg text-[10px] font-medium border transition-all",
                        isSelected
                          ? "bg-amber-500 border-amber-500 text-white"
                          : "bg-white border-gray-200 text-gray-500 hover:border-amber-300 hover:text-amber-700"
                      )}
                    >
                      {isSelected ? '✓' : 'เลือก'}
                    </button>
                  </div>

                  {/* Inline edit panel */}
                  {isEditing && (
                    <div className="border-t border-blue-200 bg-blue-50/60 p-2.5 space-y-2">
                      <p className="text-[10px] font-semibold text-blue-700 flex items-center gap-1">
                        <Pencil className="h-3 w-3" /> แก้ไขสลิป #{slip.id}
                      </p>
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">จำนวนเงิน (฿)</label>
                          <Input
                            type="number"
                            value={editForm.amount}
                            onChange={e => setEditForm(f => ({ ...f, amount: e.target.value }))}
                            placeholder="0.00"
                            className="h-7 text-xs"
                            step="0.01"
                            min="0"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] text-gray-500 block mb-0.5">วันที่โอน</label>
                          <Input
                            type="date"
                            value={editForm.transferDate}
                            onChange={e => setEditForm(f => ({ ...f, transferDate: e.target.value }))}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-gray-500 block mb-0.5">หมายเหตุ</label>
                        <Input
                          type="text"
                          value={editForm.note}
                          onChange={e => setEditForm(f => ({ ...f, note: e.target.value }))}
                          placeholder="หมายเหตุ..."
                          className="h-7 text-xs"
                        />
                      </div>
                      <div className="flex gap-1.5">
                        <Button
                          size="sm"
                          onClick={handleSaveEdit}
                          disabled={isSavingEdit}
                          className="h-7 text-xs gap-1 bg-blue-600 hover:bg-blue-700 flex-1"
                        >
                          {isSavingEdit ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                          บันทึก
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setEditingSlipId(null)}
                          className="h-7 text-xs"
                        >
                          ยกเลิก
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Manual Match Bar (sticky bottom) */}
      {(selectedSlipId !== null || selectedBdoId !== null) && (
        <div className="sticky bottom-0 bg-white border-t border-gray-200 rounded-t-xl shadow-lg p-3 -mx-4 sm:-mx-6 px-4 sm:px-6 z-20">
          <div className="max-w-7xl mx-auto flex items-center gap-3 flex-wrap">
            {/* Selected Slip */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">สลิป</span>
              {selectedSlip ? (
                <div className="flex items-center gap-1 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
                  <span className="text-xs font-bold text-amber-700">#{selectedSlip.id}</span>
                  <span className="text-xs text-emerald-600 font-semibold">฿{Number(selectedSlip.amount || 0).toLocaleString()}</span>
                  <button type="button" onClick={() => setSelectedSlipId(null)}>
                    <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-300">เลือกสลิป</span>
              )}
            </div>

            <ArrowLeftRight className="h-4 w-4 text-gray-300" />

            {/* Selected BDO */}
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-gray-400">BDO</span>
              {selectedBdo ? (
                <div className="flex items-center gap-1 bg-violet-50 border border-violet-200 rounded px-2 py-0.5">
                  <span className="text-xs font-bold text-violet-700">{selectedBdo.bdo_name || `#${selectedBdo.bdo_id}`}</span>
                  <span className="text-xs text-violet-600 font-semibold">฿{Number(selectedBdo.amount_total || 0).toLocaleString()}</span>
                  <button type="button" onClick={() => setSelectedBdoId(null)}>
                    <X className="h-3 w-3 text-gray-400 hover:text-gray-600" />
                  </button>
                </div>
              ) : (
                <span className="text-xs text-gray-300">เลือก BDO</span>
              )}
            </div>

            {/* Amount diff indicator */}
            {selectedSlip && selectedBdo && (() => {
              const slipAmt = Number(selectedSlip.amount || 0)
              const bdoAmt = Number(selectedBdo.amount_total || 0)
              const diff = slipAmt - bdoAmt
              const isExact = Math.abs(diff) < 0.01
              return (
                <Badge className={cn(
                  "text-[10px] h-5",
                  isExact ? 'bg-green-100 text-green-700' : Math.abs(diff) / bdoAmt <= 0.05 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700'
                )}>
                  {isExact ? '✓ ยอดตรง' : `ต่าง ${diff > 0 ? '+' : ''}฿${diff.toLocaleString()}`}
                </Badge>
              )
            })()}

            <div className="flex-1" />

            <Input
              value={matchNote}
              onChange={e => setMatchNote(e.target.value)}
              placeholder="หมายเหตุ..."
              className="h-8 text-xs max-w-[180px]"
            />

            <Button
              size="sm"
              disabled={!canMatch || isMatching}
              onClick={() => handleMatch(selectedSlipId!, selectedBdoId!)}
              className="h-8 text-xs gap-1 bg-emerald-600 hover:bg-emerald-700"
            >
              {isMatching ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
              ยืนยันจับคู่
            </Button>

            <Button
              variant="ghost"
              size="sm"
              onClick={() => { setSelectedSlipId(null); setSelectedBdoId(null); setMatchNote('') }}
              className="h-8 text-xs"
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      )}

      {/* Matched Today */}
      {matchedToday.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-green-50/50">
            <h3 className="text-sm font-semibold text-green-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" />
              จับคู่สำเร็จวันนี้
              <span className="text-xs text-gray-400 ml-auto">{matchedToday.length} รายการ</span>
            </h3>
          </div>
          <div className="p-2 space-y-1.5 max-h-[30vh] overflow-y-auto">
            {matchedToday.map(slip => (
              <div key={slip.id} className="flex items-center gap-2 p-2 rounded-lg border border-green-100 bg-green-50/30">
                {slip.image_full_url && (
                  <button type="button" onClick={() => setPreviewUrl(slip.image_full_url!)}>
                    <Image src={slip.image_full_url} alt="" width={28} height={34} className="w-7 h-8 object-cover rounded border" unoptimized />
                  </button>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-gray-700">สลิป #{slip.id}</span>
                    <span className="text-xs text-emerald-600 font-bold">฿{Number(slip.amount || 0).toLocaleString()}</span>
                    {slip.bdo_name && (
                      <span className="text-[10px] text-violet-600">→ {slip.bdo_name}</span>
                    )}
                    {slip.match_confidence && (
                      <Badge className="text-[9px] h-3.5 px-1 bg-green-100 text-green-700">{slip.match_confidence}</Badge>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-[10px] gap-0.5 text-gray-400 hover:text-red-600"
                  disabled={isUnmatching === slip.id}
                  onClick={() => handleUnmatch(slip)}
                >
                  <XCircle className="h-3 w-3" />
                  {isUnmatching === slip.id ? 'กำลัง...' : 'ยกเลิก'}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Slip Preview Modal */}
      <Dialog open={!!previewUrl} onOpenChange={() => setPreviewUrl(null)}>
        <DialogContent className="max-w-lg p-2">
          {previewUrl && (
            <Image src={previewUrl} alt="สลิป" width={800} height={1200} className="w-full h-auto rounded-lg" unoptimized />
          )}
        </DialogContent>
      </Dialog>

      {/* BDO Detail Modal */}
      <Dialog open={bdoDetailId !== null} onOpenChange={(open) => { if (!open) { setBdoDetailId(null); setBdoDetailData(null) } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto p-0">
          {/* Header */}
          <div className="sticky top-0 z-10 bg-white border-b border-gray-200 px-4 py-3 flex items-center justify-between">
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {bdoDetailData?.bdo?.name || `BDO #${bdoDetailId}`}
              </h2>
              {bdoDetailData?.bdo?.partner_name && (
                <p className="text-xs text-gray-500">{bdoDetailData.bdo.partner_name}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {bdoDetailData?.odoo_url && (
                <a href={bdoDetailData.odoo_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-600 hover:underline flex items-center gap-1">
                  <ExternalLink className="h-3 w-3" /> Odoo
                </a>
              )}
              {bdoDetailData?.statement_pdf_url && (
                <a href={`https://cny.re-ya.com${bdoDetailData.statement_pdf_url}`} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-gray-500 hover:underline flex items-center gap-1">
                  <Receipt className="h-3 w-3" /> PDF
                </a>
              )}
            </div>
          </div>

          <div className="p-4 space-y-4">
            {bdoDetailLoading && (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                <span className="ml-2 text-sm text-gray-500">กำลังโหลด...</span>
              </div>
            )}

            {bdoDetailError && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-4 text-sm text-red-700">
                {bdoDetailError}
              </div>
            )}

            {bdoDetailData && !bdoDetailLoading && (() => {
              const bdo = bdoDetailData.bdo
              const summary = bdoDetailData.summary
              return (
                <>
                  {bdoDetailData.stale_warning && (
                    <div className="rounded-lg bg-amber-50 border border-amber-200 p-2 text-xs text-amber-700 flex items-center gap-1.5">
                      <AlertCircle className="h-3.5 w-3.5 flex-shrink-0" />
                      {bdoDetailData.stale_warning}
                    </div>
                  )}

                  {/* BDO Summary */}
                  {bdo && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">ข้อมูล BDO</p>
                      </div>
                      <div className="p-3 grid grid-cols-2 gap-2 text-sm">
                        <div><span className="text-xs text-gray-400">วันที่</span><p className="font-medium">{bdo.doc_date || '-'}</p></div>
                        <div><span className="text-xs text-gray-400">สถานะ</span><p className="font-medium">{bdo.state_display || bdo.state || '-'}</p></div>
                        <div><span className="text-xs text-gray-400">ประเภทส่ง</span><p className="font-medium">{bdo.delivery_type || '-'}</p></div>
                        <div><span className="text-xs text-gray-400">ยอดสุทธิ</span><p className="font-bold text-blue-700">฿{Number(bdo.amount_net_to_pay ?? 0).toLocaleString()}</p></div>
                      </div>
                    </div>
                  )}

                  {/* Financial Summary */}
                  {summary && (
                    <div className="rounded-xl border border-blue-100 bg-blue-50/40 overflow-hidden">
                      <div className="bg-blue-50 px-3 py-2 border-b border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide">สรุปยอด</p>
                      </div>
                      <div className="p-3 space-y-1 text-sm">
                        <div className="flex justify-between"><span className="text-gray-500">ยอด SO</span><span>฿{Number(summary.so_amount ?? 0).toLocaleString()}</span></div>
                        {summary.credit_note_amount !== 0 && <div className="flex justify-between"><span className="text-gray-500">เครดิตโน้ต</span><span className="text-green-600">฿{Number(summary.credit_note_amount ?? 0).toLocaleString()}</span></div>}
                        {summary.deposit_amount !== 0 && <div className="flex justify-between"><span className="text-gray-500">มัดจำ</span><span className="text-green-600">฿{Number(summary.deposit_amount ?? 0).toLocaleString()}</span></div>}
                        <div className="flex justify-between font-bold border-t border-blue-200 pt-1"><span>ยอดสุทธิที่ต้องชำระ</span><span className="text-blue-700">฿{Number(summary.net_to_pay ?? 0).toLocaleString()}</span></div>
                      </div>
                    </div>
                  )}

                  {/* Sale Orders */}
                  {bdoDetailData.sale_orders.length > 0 && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">ใบสั่งขาย (SO)</p>
                        <span className="text-xs text-gray-400">{bdoDetailData.sale_orders.length} รายการ</span>
                      </div>
                      <div className="divide-y divide-gray-100">
                        {bdoDetailData.sale_orders.map((so: any) => (
                          <div key={so.id} className="p-3">
                            <div className="flex items-center justify-between mb-2">
                              <a href={so.odoo_url} target="_blank" rel="noopener noreferrer"
                                className="text-sm font-semibold text-blue-600 hover:underline flex items-center gap-1">
                                {so.name} <ExternalLink className="h-3 w-3" />
                              </a>
                              <span className="text-sm font-bold">฿{Number(so.amount_total ?? 0).toLocaleString()}</span>
                            </div>
                            {so.lines?.length > 0 && (
                              <table className="w-full text-xs">
                                <thead><tr className="text-gray-400"><th className="text-left pb-1">สินค้า</th><th className="text-right pb-1">จำนวน</th><th className="text-right pb-1">ราคา</th><th className="text-right pb-1">รวม</th></tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                  {so.lines.map((line: any, i: number) => (
                                    <tr key={i}>
                                      <td className="py-0.5 pr-2">
                                        <p className="font-medium text-gray-800 leading-tight">{line.product_name}</p>
                                        {line.product_code && <p className="text-gray-400">{line.product_code}</p>}
                                      </td>
                                      <td className="text-right py-0.5 whitespace-nowrap">{line.quantity} {line.uom}</td>
                                      <td className="text-right py-0.5 whitespace-nowrap">฿{Number(line.unit_price ?? 0).toLocaleString()}</td>
                                      <td className="text-right py-0.5 font-medium whitespace-nowrap">฿{Number(line.subtotal ?? 0).toLocaleString()}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Outstanding Invoices */}
                  {bdoDetailData.outstanding_invoices.length > 0 && (
                    <div className="rounded-xl border border-gray-200 overflow-hidden">
                      <div className="bg-gray-50 px-3 py-2 border-b border-gray-200 flex items-center justify-between">
                        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">ใบแจ้งหนี้ค้างชำระ</p>
                        <span className="text-xs text-gray-400">{bdoDetailData.outstanding_invoices.length} รายการ</span>
                      </div>
                      <div className="max-h-48 overflow-y-auto">
                        <table className="w-full text-xs">
                          <thead className="sticky top-0 bg-gray-50"><tr className="text-gray-400">
                            <th className="text-left px-3 py-1.5">เลขที่</th>
                            <th className="text-left px-2 py-1.5">วันที่</th>
                            <th className="text-right px-3 py-1.5">ยอด</th>
                            <th className="text-right px-3 py-1.5">คงเหลือ</th>
                          </tr></thead>
                          <tbody className="divide-y divide-gray-100">
                            {bdoDetailData.outstanding_invoices.map((inv: any) => (
                              <tr key={inv.id} className={cn(inv.selected ? 'bg-green-50/30' : '')}>
                                <td className="px-3 py-1.5">
                                  {inv.odoo_url
                                    ? <a href={inv.odoo_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline font-medium">{inv.number}</a>
                                    : <span className="font-medium">{inv.number}</span>}
                                  {inv.selected && <span className="ml-1 text-green-600">✔</span>}
                                </td>
                                <td className="px-2 py-1.5 text-gray-500">{inv.date}</td>
                                <td className="px-3 py-1.5 text-right">฿{Number(inv.amount_total ?? 0).toLocaleString()}</td>
                                <td className="px-3 py-1.5 text-right font-medium">{Number(inv.residual ?? 0) === 0 ? <span className="text-green-600">ชำระแล้ว</span> : `฿${Number(inv.residual).toLocaleString()}`}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  {/* Credit Notes */}
                  {bdoDetailData.credit_notes.length > 0 && (
                    <div className="rounded-xl border border-green-100 overflow-hidden">
                      <div className="bg-green-50 px-3 py-2 border-b border-green-100">
                        <p className="text-xs font-semibold text-green-700 uppercase tracking-wide">เครดิตโน้ต ({bdoDetailData.credit_notes.length})</p>
                      </div>
                      <div className="divide-y divide-green-50">
                        {bdoDetailData.credit_notes.map((cn: any) => (
                          <div key={cn.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                            <span className="font-medium text-gray-700">{cn.number}</span>
                            <span className="text-green-600 font-bold">-฿{Number(cn.amount_total ?? 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Slips */}
                  {bdoDetailData.slips.length > 0 && (
                    <div className="rounded-xl border border-violet-100 overflow-hidden">
                      <div className="bg-violet-50 px-3 py-2 border-b border-violet-100">
                        <p className="text-xs font-semibold text-violet-700 uppercase tracking-wide">สลิปที่แนบ ({bdoDetailData.slips.length})</p>
                      </div>
                      <div className="p-2 flex flex-wrap gap-2">
                        {bdoDetailData.slips.map((slip: any, i: number) => (
                          <div key={i} className="text-xs text-gray-600 bg-violet-50/60 rounded px-2 py-1 border border-violet-100">
                            สลิป #{slip.id || i+1} — ฿{Number(slip.amount ?? 0).toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
