"use client"

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { ShoppingBag, FileText, Receipt, Eye, AlertCircle, Clock } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'
import { OdooSlipsSection } from './OdooSlipsSection'
import { OdooCreditCard } from './OdooCreditCard'
import { OdooOrderTimeline } from './OdooOrderTimeline'
import type { Customer360TimelineEvent, Customer360Credit } from '@/types/odoo'

interface OdooDashboardPanelProps {
  partnerId?: number | null
  customerRef?: string | null
  lineUserId?: string | null
  userId?: string | null
}

interface OdooOrderItem {
  id: number | null
  order_name: string | null
  state: string | null
  state_display: string | null
  amount_total: number | null
  date_order: string | null
  payment_date: string | null
  last_updated_at: string | null
  is_delivered?: boolean
  delivery_status?: string | null
}

interface OdooInvoiceItem {
  invoice_number: string | null
  name: string | null
  invoice_date: string | null
  due_date: string | null
  invoice_state: string | null
  state: string | null
  amount_total: number | null
  amount_residual: number | null
}

interface SlipItem {
  id: number
  amount: number | null
  transfer_date: string | null
  status: string
  image_full_url: string | null
  uploaded_by: string | null
  uploaded_at: string | null
}

async function fetchDashboardData(partnerId: number | null, customerRef: string | null, lineUserId: string | null) {
  const phpBase = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
  const apiUrl = `${phpBase}/api/odoo-webhooks-dashboard.php`

  const pid = partnerId && partnerId > 0 ? String(partnerId) : ''

  const [ordRes, invRes, slipRes, c360Res] = await Promise.all([
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'odoo_orders', limit: 100, offset: 0, partner_id: pid, customer_ref: customerRef || '' }),
    }).then(r => r.json()).catch(() => ({ success: false })),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'odoo_invoices', limit: 100, offset: 0, partner_id: pid, customer_ref: customerRef || '' }),
    }).then(r => r.json()).catch(() => ({ success: false })),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'odoo_slips', partner_id: pid, line_user_id: lineUserId || '' }),
    }).then(r => r.json()).catch(() => ({ success: false })),
    fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'customer_360', partner_id: pid, customer_ref: customerRef || '', line_user_id: lineUserId || '', orders_limit: 10, invoices_limit: 10, timeline_limit: 20 }),
    }).then(r => r.json()).catch(() => ({ success: false })),
  ])

  const c360Data = c360Res?.success ? c360Res.data : null

  return {
    orders: ordRes?.success ? (ordRes.data?.orders || []) as OdooOrderItem[] : [],
    ordersTotal: ordRes?.success ? (ordRes.data?.total || 0) : 0,
    invoices: invRes?.success ? (invRes.data?.invoices || []) as OdooInvoiceItem[] : [],
    invoicesTotal: invRes?.success ? (invRes.data?.total || 0) : 0,
    slips: slipRes?.success ? (slipRes.data?.slips || []) as SlipItem[] : [],
    slipsTotal: slipRes?.success ? (slipRes.data?.total || 0) : 0,
    credit: (c360Data?.credit || null) as Customer360Credit | null,
    timeline: (c360Data?.timeline || []) as Customer360TimelineEvent[],
    webhookSummary: c360Data?.webhook_summary || null,
  }
}

function fmtCurrency(amt: number | null) {
  if (amt === null || amt === undefined) return '—'
  return `฿${Number(amt).toLocaleString('th-TH', { minimumFractionDigits: 0 })}`
}

function fmtDate(raw: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw.slice(0, 10) || '—'
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

const orderStateColors: Record<string, { bg: string; text: string }> = {
  sale: { bg: '#dcfce7', text: '#16a34a' },
  done: { bg: '#dbeafe', text: '#1d4ed8' },
  cancel: { bg: '#f1f5f9', text: '#64748b' },
  draft: { bg: '#fef9c3', text: '#854d0e' },
  to_delivery: { bg: '#f3e8ff', text: '#7c3aed' },
  packed: { bg: '#cffafe', text: '#0891b2' },
  confirmed: { bg: '#dbeafe', text: '#0369a1' },
}

const invoiceStateMap: Record<string, { label: string; bg: string; text: string }> = {
  posted: { label: 'ยืนยัน', bg: '#dcfce7', text: '#16a34a' },
  paid: { label: 'ชำระแล้ว', bg: '#dbeafe', text: '#1d4ed8' },
  open: { label: 'ค้างชำระ', bg: '#fef9c3', text: '#854d0e' },
  overdue: { label: 'เกินกำหนด', bg: '#fee2e2', text: '#dc2626' },
  cancel: { label: 'ยกเลิก', bg: '#f1f5f9', text: '#64748b' },
  draft: { label: 'ร่าง', bg: '#fef9c3', text: '#854d0e' },
}

const slipStatusMap: Record<string, { label: string; color: string }> = {
  pending: { label: 'รอตรวจสอบ', color: 'bg-yellow-100 text-yellow-700' },
  matched: { label: 'จับคู่แล้ว', color: 'bg-green-100 text-green-700' },
  confirmed: { label: 'ยืนยัน', color: 'bg-green-100 text-green-700' },
  failed: { label: 'ไม่สำเร็จ', color: 'bg-red-100 text-red-700' },
}

type DashTab = 'orders' | 'invoices' | 'slips' | 'timeline'

export function OdooDashboardPanel({ partnerId, customerRef, lineUserId, userId }: OdooDashboardPanelProps) {
  const [activeTab, setActiveTab] = useState<DashTab>('orders')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['odoo-dashboard', partnerId, customerRef, lineUserId],
    queryFn: () => fetchDashboardData(partnerId ?? null, customerRef ?? null, lineUserId ?? null),
    enabled: !!(partnerId || customerRef || lineUserId),
    staleTime: 30 * 1000,
  })

  if (!partnerId && !customerRef && !lineUserId) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400 text-sm p-6">
        <div className="text-center">
          <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p>ยังไม่ได้เชื่อมกับ Odoo</p>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="p-3 space-y-3">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-16 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-4 text-center text-gray-400 text-sm">
        <AlertCircle className="h-6 w-6 mx-auto mb-2" />
        <p>ไม่สามารถโหลดข้อมูล ERP ได้</p>
      </div>
    )
  }

  const allOrders = data?.orders || []
  const invoices = data?.invoices || []

  const deliveredStates = ['done', 'cancel']
  const orders = allOrders.filter((o) => {
    if (o.is_delivered === true) return false
    const state = String(o.state || '').toLowerCase()
    if (deliveredStates.includes(state)) return false
    return true
  })

  const timeline = data?.timeline || []
  const credit = data?.credit || null

  const tabs: { id: DashTab; label: string; count: number; icon: typeof ShoppingBag }[] = [
    { id: 'orders', label: 'ออเดอร์', count: orders.length, icon: ShoppingBag },
    { id: 'invoices', label: 'ใบแจ้งหนี้', count: data?.invoicesTotal || invoices.length, icon: FileText },
    { id: 'slips', label: 'สลิป', count: 0, icon: Receipt },
    { id: 'timeline', label: 'Timeline', count: timeline.length, icon: Clock },
  ]

  return (
    <div className="flex flex-col h-full">
      {/* Sub-tabs: Pill / Segmented Control style */}
      <div className="flex-shrink-0 px-3 py-2 bg-white border-b border-gray-100">
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon
            const isActive = activeTab === tab.id
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-semibold transition-all duration-200 cursor-pointer',
                  isActive
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-500 hover:text-gray-700'
                )}
              >
                <Icon className="h-3 w-3" />
                {tab.label}
                {tab.id !== 'slips' && tab.count > 0 && (
                  <span className={cn(
                    'text-[10px] px-1.5 rounded-full font-bold',
                    isActive ? 'bg-gray-100 text-gray-600' : 'bg-gray-200 text-gray-500'
                  )}>
                    {tab.count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      {/* Credit Card - shown above content when available */}
      {credit && (credit.credit_limit || credit.total_due || credit.overdue_amount) && (
        <div className="flex-shrink-0 px-3 pt-2">
          <OdooCreditCard credit={credit} />
        </div>
      )}

      {/* Content */}
      {activeTab === 'slips' ? (
        <div className="flex-1 overflow-y-auto p-3">
          {userId ? (
            <OdooSlipsSection userId={userId} />
          ) : (
            <div className="text-center py-8 text-gray-400">
              <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p className="text-sm">ไม่พบข้อมูลผู้ใช้</p>
            </div>
          )}
        </div>
      ) : activeTab === 'timeline' ? (
        <ScrollArea className="flex-1">
          <div className="p-3">
            <OdooOrderTimeline events={timeline} maxItems={20} />
          </div>
        </ScrollArea>
      ) : (
        <ScrollArea className="flex-1">
          <div className="p-3">
            {activeTab === 'orders' && <OrdersList orders={orders} />}
            {activeTab === 'invoices' && <InvoicesList invoices={invoices} />}
          </div>
        </ScrollArea>
      )}

      {/* Slip image preview */}
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

function OrdersList({ orders }: { orders: OdooOrderItem[] }) {
  if (!orders.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        <ShoppingBag className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ไม่มีออเดอร์ที่ยังไม่ส่ง</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {orders.map((o, idx) => {
        const state = String(o.state || '').toLowerCase()
        const sc = orderStateColors[state] || { bg: '#f1f5f9', text: '#64748b' }
        const stateLabel = o.state_display || o.state || '—'
        return (
          <div key={`${o.order_name}-${idx}`} className="flex items-center justify-between p-2.5 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate">{o.order_name || '—'}</div>
              <div className="text-[10px] text-gray-400">{fmtDate(o.date_order || o.last_updated_at)}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: sc.bg, color: sc.text }}
              >
                {stateLabel}
              </span>
              <span className="text-xs font-bold text-gray-900">{fmtCurrency(o.amount_total)}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function InvoicesList({ invoices }: { invoices: OdooInvoiceItem[] }) {
  if (!invoices.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ไม่พบใบแจ้งหนี้</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {invoices.map((inv, idx) => {
        const stateVal = String(inv.invoice_state || inv.state || '').toLowerCase()
        const si = invoiceStateMap[stateVal] || { label: stateVal || '—', bg: '#f1f5f9', text: '#64748b' }
        const isPaid = stateVal === 'paid'
        const residual = isPaid ? 0 : Number(inv.amount_residual || 0)
        return (
          <div key={`${inv.invoice_number}-${idx}`} className={cn(
            'flex items-center justify-between p-2.5 border rounded-lg transition-colors',
            isPaid ? 'bg-green-50/50 border-green-100' : 'bg-white border-gray-100 hover:border-gray-200'
          )}>
            <div className="min-w-0">
              <div className="text-sm font-bold text-gray-900 truncate">{inv.invoice_number || inv.name || '—'}</div>
              <div className="text-[10px] text-gray-400">{fmtDate(inv.invoice_date || inv.due_date)}</div>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              <span
                className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                style={{ background: si.bg, color: si.text }}
              >
                {si.label}
              </span>
              <div className="text-right">
                <div className="text-xs font-bold text-gray-900">{fmtCurrency(inv.amount_total)}</div>
                {residual > 0 && (
                  <div className="text-[10px] text-red-500">ค้าง {fmtCurrency(residual)}</div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SlipsList({ slips, onPreview }: { slips: SlipItem[]; onPreview: (url: string) => void }) {
  if (!slips.length) {
    return (
      <div className="text-center py-8 text-gray-400">
        <Receipt className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ไม่พบสลิป</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      {slips.map((slip) => {
        const sc = slipStatusMap[slip.status] || slipStatusMap.pending
        return (
          <div key={slip.id} className="flex gap-2.5 p-2.5 bg-white border border-gray-100 rounded-lg hover:border-gray-200 transition-colors">
            {slip.image_full_url && (
              <button
                type="button"
                onClick={() => onPreview(slip.image_full_url!)}
                className="flex-shrink-0 rounded overflow-hidden border hover:opacity-80 transition-opacity"
              >
                <Image src={slip.image_full_url} alt="สลิป" width={48} height={60} className="w-12 h-15 object-cover" unoptimized />
              </button>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5 mb-0.5">
                <Badge className={cn('text-[10px] h-4 gap-0.5', sc.color)}>{sc.label}</Badge>
              </div>
              {slip.amount !== null && (
                <div className="text-sm font-bold text-gray-900">{fmtCurrency(slip.amount)}</div>
              )}
              <div className="text-[10px] text-gray-400">
                {fmtDate(slip.transfer_date || slip.uploaded_at)}
                {slip.uploaded_by && ` · ${slip.uploaded_by}`}
              </div>
            </div>
            {slip.image_full_url && (
              <button
                onClick={() => onPreview(slip.image_full_url!)}
                className="self-center p-1 text-gray-400 hover:text-gray-600"
                title="ดูสลิป"
              >
                <Eye className="h-4 w-4" />
              </button>
            )}
          </div>
        )
      })}
    </div>
  )
}
