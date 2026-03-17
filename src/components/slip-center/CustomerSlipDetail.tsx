"use client"

import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import Image from 'next/image'
import {
  Receipt, FileCheck, Clock, CheckCircle2, Upload, XCircle, Eye,
  ExternalLink, Truck, Calendar, Link2, AlertCircle, Loader2, RefreshCw,
  ArrowLeftRight, Paperclip, X, ChevronDown,
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
  bdoOrders: SlipCenterBdo[]
  pendingSlips: SlipCenterSlip[]
  allSlips: SlipCenterSlip[]
  matchedToday: SlipCenterSlip[]
  stats: {
    totalBdos: number
    totalPendingSlips: number
    totalMatchedToday: number
  }
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

export function CustomerSlipDetail({
  customerRef, customerName, partnerId, lineUserId, onBack, onRefreshParent,
}: CustomerSlipDetailProps) {
  const { toast } = useToast()
  const qc = useQueryClient()

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

  const bdoOrders = data?.bdoOrders || []
  const pendingSlips = data?.pendingSlips || []
  const matchedToday = data?.matchedToday || []

  return (
    <div className="space-y-4">
      {/* Customer Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-base text-gray-900">{customerRef}</h2>
            <p className="text-sm text-gray-500">{customerName}</p>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <Button variant="outline" size="sm" onClick={refreshDetail} disabled={isFetching} className="gap-1.5 text-xs">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
              รีเฟรช
            </Button>
          </div>
        </div>
        <div className="flex gap-2 mt-2">
          <Badge variant="outline" className="text-[10px] gap-0.5 border-amber-300 text-amber-700 bg-amber-50">
            <Receipt className="h-2.5 w-2.5" /> สลิปรอ {pendingSlips.length}
          </Badge>
          <Badge variant="outline" className="text-[10px] gap-0.5 border-violet-300 text-violet-700 bg-violet-50">
            <FileCheck className="h-2.5 w-2.5" /> BDO รอ {bdoOrders.length}
          </Badge>
          {matchedToday.length > 0 && (
            <Badge variant="outline" className="text-[10px] gap-0.5 border-green-300 text-green-700 bg-green-50">
              <CheckCircle2 className="h-2.5 w-2.5" /> จับคู่วันนี้ {matchedToday.length}
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
        {/* Left: Pending BDOs */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <FileCheck className="h-4 w-4 text-violet-500" />
              BDO รอชำระ
              <span className="text-xs text-gray-400 ml-auto">{bdoOrders.length} รายการ</span>
            </h3>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2 space-y-2">
            {bdoOrders.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-400">ไม่มี BDO รอชำระ</p>
            ) : bdoOrders.map(bdo => {
              const isSelected = selectedBdoId === bdo.bdo_id
              const ps = normalizeBdoPaymentStatus(bdo)
              const deliveryLabel = bdo.delivery_type === 'company' ? 'สายส่ง' : bdo.delivery_type === 'private' ? 'ขนส่งเอกชน' : null
              return (
                <button
                  key={bdo.bdo_id}
                  type="button"
                  onClick={() => setSelectedBdoId(isSelected ? null : bdo.bdo_id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-2.5 transition-all",
                    isSelected
                      ? "border-violet-400 bg-violet-50 ring-1 ring-violet-200"
                      : "border-gray-100 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className="flex items-start justify-between mb-1">
                    <div>
                      <p className="text-xs font-bold text-gray-900">{bdo.bdo_name || `BDO-${bdo.bdo_id}`}</p>
                      {bdo.order_name && <p className="text-[10px] text-blue-600">{bdo.order_name}</p>}
                    </div>
                    <div className="flex items-center gap-1">
                      {deliveryLabel && (
                        <Badge variant="outline" className="text-[9px] h-4 gap-0.5 px-1 border-sky-200 text-sky-600">
                          <Truck className="h-2 w-2" /> {deliveryLabel}
                        </Badge>
                      )}
                      <a href={`${ODOO_BASE}/web#id=${bdo.bdo_id}&model=cny.bill.invoice.before.delivery&view_type=form`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}>
                        <ExternalLink className="h-3 w-3 text-gray-300 hover:text-blue-500" />
                      </a>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-900">
                      ฿{Number(bdo.amount_total || 0).toLocaleString()}
                    </p>
                    <Badge className={cn(
                      "text-[9px] h-4 px-1.5",
                      ps.key === 'pending' ? 'bg-amber-100 text-amber-700' :
                      ps.key === 'partial' ? 'bg-blue-100 text-blue-700' :
                      'bg-green-100 text-green-700'
                    )}>
                      {ps.label}
                    </Badge>
                  </div>
                  {bdo.bdo_date && (
                    <p className="text-[10px] text-gray-400 mt-1 flex items-center gap-0.5">
                      <Calendar className="h-2.5 w-2.5" />
                      {new Date(bdo.bdo_date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })}
                    </p>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Right: Pending Slips */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="p-3 border-b border-gray-100 bg-gray-50/50">
            <h3 className="text-sm font-semibold text-gray-700 flex items-center gap-1.5">
              <Receipt className="h-4 w-4 text-amber-500" />
              สลิปยังไม่จับคู่
              <span className="text-xs text-gray-400 ml-auto">{pendingSlips.length} รายการ</span>
            </h3>
          </div>
          <div className="max-h-[50vh] overflow-y-auto p-2 space-y-2">
            {pendingSlips.length === 0 ? (
              <p className="text-center py-6 text-sm text-gray-400">ไม่มีสลิปรอจับคู่</p>
            ) : pendingSlips.map(slip => {
              const isSelected = selectedSlipId === slip.id
              return (
                <button
                  key={slip.id}
                  type="button"
                  onClick={() => setSelectedSlipId(isSelected ? null : slip.id)}
                  className={cn(
                    "w-full text-left rounded-lg border p-2.5 transition-all",
                    isSelected
                      ? "border-amber-400 bg-amber-50 ring-1 ring-amber-200"
                      : "border-gray-100 hover:border-gray-300 bg-white"
                  )}
                >
                  <div className="flex gap-2">
                    {slip.image_full_url ? (
                      <button
                        type="button"
                        className="flex-shrink-0"
                        onClick={e => { e.stopPropagation(); setPreviewUrl(slip.image_full_url!) }}
                      >
                        <Image src={slip.image_full_url} alt="" width={36} height={44} className="w-9 h-11 object-cover rounded border" unoptimized />
                      </button>
                    ) : (
                      <div className="w-9 h-11 bg-gray-100 rounded border flex items-center justify-center flex-shrink-0">
                        <Receipt className="h-3.5 w-3.5 text-gray-300" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <p className="text-xs font-semibold text-gray-800">สลิป #{slip.id}</p>
                        <Badge className="text-[9px] h-4 px-1.5 bg-amber-100 text-amber-700">รอจับคู่</Badge>
                      </div>
                      <p className="text-sm font-bold text-emerald-600">
                        ฿{Number(slip.amount || 0).toLocaleString()}
                      </p>
                      {slip.uploaded_at && (
                        <p className="text-[10px] text-gray-400 flex items-center gap-0.5">
                          <Clock className="h-2.5 w-2.5" />
                          {new Date(slip.uploaded_at).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' })}
                          {' '}
                          {new Date(slip.uploaded_at).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      )}
                    </div>
                  </div>
                </button>
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
    </div>
  )
}
