"use client"

import { useState, useCallback, useMemo } from 'react'
import { useQuery, useQueryClient, QueryClient, QueryClientProvider } from '@tanstack/react-query'
import Link from 'next/link'
import {
  Receipt, ArrowLeft, RefreshCw, LayoutGrid, Inbox,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Toaster } from '@/components/ui/toaster'
import { SlipCenterKPI } from './SlipCenterKPI'
import { CustomerGrid } from './CustomerGrid'
import { CustomerSlipDetail } from './CustomerSlipDetail'

// Types
export interface SlipCenterCustomer {
  customer_ref?: string
  ref?: string
  customer_name?: string
  name?: string
  partner_id?: number
  customer_id?: number
  odoo_id?: number
  salesperson_id?: string
  salesperson_name?: string
  line_user_id?: string
}

export interface SlipCenterSlip {
  id: number
  line_user_id?: string
  line_account_id?: number
  customer_name?: string
  customer_ref?: string
  amount?: number | null
  transfer_date?: string | null
  image_path?: string | null
  image_full_url?: string | null
  uploaded_by?: string | null
  status?: string
  match_reason?: string | null
  uploaded_at?: string
  matched_at?: string | null
  odoo_slip_id?: number | null
  slip_inbox_id?: number | null
  slip_inbox_name?: string | null
  bdo_id?: number | null
  bdo_name?: string | null
  invoice_id?: number | null
  order_id?: number | null
  match_confidence?: string | null
  delivery_type?: string | null
  bdo_amount?: number | null
}

export interface SlipCenterBdo {
  id?: number
  bdo_id: number
  bdo_name?: string | null
  order_id?: number
  order_name?: string | null
  amount_total?: number | null
  amount_net_to_pay?: number | null
  payment_status?: string
  status?: string
  payment_method?: string | null
  payment_reference?: string | null
  partner_id?: number | null
  customer_name?: string | null
  customer_ref?: string | null
  line_user_id?: string | null
  delivery_type?: string | null
  paid_amount_total?: number
  matched_amount_total?: number
  linked_slips?: any[]
  slips?: any[]
  bdo_state?: string | null
  bdo_date?: string | null
  qr_data?: string | null
  statement_pdf_path?: string | null
  created_at?: string
  slip_upload_id?: number | null
  slip_image_url?: string | null
  slip_amount?: number | null
  slip_transfer_date?: string | null
}

interface SlipCenterData {
  customers: SlipCenterCustomer[]
  pendingSlips: SlipCenterSlip[]
  pendingBdos: SlipCenterBdo[]
  allBdos: SlipCenterBdo[]
  stats: {
    totalCustomers: number
    totalPendingSlips: number
    totalPendingBdos: number
    totalAllBdos: number
  }
}

async function fetchSlipCenterData(): Promise<SlipCenterData> {
  const res = await fetch('/api/slip-center')
  const json = await res.json()
  if (!res.ok || !json.success) {
    throw new Error(json.error || 'Failed to load Slip Center data')
  }
  return json.data
}

// Utility: normalize customer ref for grouping
export function normalizeRef(ref?: string | null): string {
  return String(ref || '').trim().toUpperCase()
}

export function getSlipCustomerRef(s: SlipCenterSlip): string {
  return normalizeRef(s.customer_ref || s.line_user_id)
}

export function getBdoCustomerRef(b: SlipCenterBdo): string {
  return normalizeRef(b.customer_ref || b.line_user_id)
}

export function normalizeBdoPaymentStatus(bdo: SlipCenterBdo): { key: string; label: string } {
  const rawStatus = String(bdo?.payment_status || bdo?.status || '').toLowerCase().trim()
  const paidAmount = parseFloat(String(bdo?.paid_amount_total ?? bdo?.matched_amount_total ?? 0)) || 0
  const totalAmount = parseFloat(String(bdo?.amount_total ?? bdo?.amount_net_to_pay ?? 0)) || 0
  const linkedSlipCount = Array.isArray(bdo?.linked_slips) ? bdo.linked_slips.length : (Array.isArray(bdo?.slips) ? bdo.slips.length : 0)

  if (rawStatus === 'paid' || rawStatus === 'fully_paid' || rawStatus === 'done') return { key: 'paid', label: 'ชำระแล้ว' }
  if (rawStatus === 'matched' || rawStatus === 'reconciled') return { key: 'matched', label: 'จับคู่แล้ว' }
  if (rawStatus === 'partial' || rawStatus === 'partially_paid') return { key: 'partial', label: 'ชำระบางส่วน' }
  if (rawStatus === 'slip_uploaded' || rawStatus === 'uploaded') return { key: 'slip_uploaded', label: 'แนบสลิปแล้ว' }
  if (totalAmount > 0 && paidAmount >= totalAmount) return { key: 'paid', label: 'ชำระแล้ว' }
  if (paidAmount > 0 && totalAmount > 0 && paidAmount < totalAmount) return { key: 'partial', label: 'ชำระบางส่วน' }
  if (linkedSlipCount > 0) return { key: 'slip_uploaded', label: 'แนบสลิปแล้ว' }
  return { key: 'pending', label: 'รอชำระ' }
}

// Create a query client for the Slip Center
const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30000, retry: 1 },
  },
})

function SlipCenterInner() {
  const qc = useQueryClient()

  const { data, isLoading, error, isFetching } = useQuery<SlipCenterData>({
    queryKey: ['slip-center'],
    queryFn: fetchSlipCenterData,
    staleTime: 30000,
  })

  // Zone state
  const [selectedCustomer, setSelectedCustomer] = useState<{
    ref: string
    name: string
    partnerId: string
    lineUserId: string
  } | null>(null)

  const handleSelectCustomer = useCallback((ref: string, name: string, partnerId: string, lineUserId: string) => {
    setSelectedCustomer({ ref, name, partnerId, lineUserId })
  }, [])

  const handleBack = useCallback(() => {
    setSelectedCustomer(null)
  }, [])

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['slip-center'] })
  }, [qc])

  // Build slip/BDO count maps for the customer grid — memoized on data only
  const slipCountByRef = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    if (!data) return map
    data.pendingSlips.forEach(s => {
      const ref = getSlipCustomerRef(s)
      if (ref) map[ref] = (map[ref] || 0) + 1
    })
    return map
  }, [data])

  const bdoCountByRef = useMemo<Record<string, number>>(() => {
    const map: Record<string, number> = {}
    if (!data) return map
    data.pendingBdos.forEach(b => {
      const ps = normalizeBdoPaymentStatus(b)
      if (ps.key === 'pending' || ps.key === 'partial') {
        const ref = getBdoCustomerRef(b)
        if (ref) map[ref] = (map[ref] || 0) + 1
      }
    })
    return map
  }, [data])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-violet-50/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {selectedCustomer ? (
                <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-gray-600">
                  <ArrowLeft className="h-4 w-4" />
                  กลับ
                </Button>
              ) : (
                <Link href="/inbox" className="text-gray-500 hover:text-gray-700 transition-colors">
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              )}
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-gradient-to-br from-violet-500 to-indigo-600 rounded-lg">
                  <Receipt className="h-4 w-4 text-white" />
                </div>
                <div>
                  <h1 className="text-sm font-bold text-gray-900">
                    Slip Center
                  </h1>
                  <p className="text-[10px] text-gray-400">
                    {selectedCustomer ? selectedCustomer.name : 'จัดการสลิปและจับคู่ BDO'}
                  </p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {selectedCustomer && (
                <Button variant="ghost" size="sm" onClick={handleBack} className="gap-1.5 text-xs text-gray-500">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  ดูทั้งหมด
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isFetching}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
                รีเฟรช
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
        {error ? (
          <div className="text-center py-12">
            <Inbox className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p className="text-gray-500 text-sm mb-3">ไม่สามารถโหลดข้อมูลได้</p>
            <p className="text-xs text-red-500 mb-4">{error instanceof Error ? error.message : 'Unknown error'}</p>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> ลองใหม่
            </Button>
          </div>
        ) : !selectedCustomer ? (
          /* Zone A: Customer Grid */
          <>
            <SlipCenterKPI
              stats={data?.stats}
              isLoading={isLoading}
            />
            <CustomerGrid
              customers={data?.customers || []}
              slipCountByRef={slipCountByRef}
              bdoCountByRef={bdoCountByRef}
              isLoading={isLoading}
              onSelectCustomer={handleSelectCustomer}
            />
          </>
        ) : (
          /* Zone B: Customer Slip Detail */
          <CustomerSlipDetail
            customerRef={selectedCustomer.ref}
            customerName={selectedCustomer.name}
            partnerId={selectedCustomer.partnerId}
            lineUserId={selectedCustomer.lineUserId}
            onBack={handleBack}
            onRefreshParent={handleRefresh}
          />
        )}
      </main>
      <Toaster />
    </div>
  )
}

export function SlipCenterClient() {
  return (
    <QueryClientProvider client={queryClient}>
      <SlipCenterInner />
    </QueryClientProvider>
  )
}
