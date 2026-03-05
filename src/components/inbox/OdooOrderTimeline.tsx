"use client"

import { Clock, CheckCircle2, XCircle, AlertCircle, Package, Truck, CreditCard, FileText } from 'lucide-react'
import type { Customer360TimelineEvent } from '@/types/odoo'

interface OdooOrderTimelineProps {
  events: Customer360TimelineEvent[]
  maxItems?: number
}

const EVENT_LABELS: Record<string, string> = {
  'sale.order.created': 'สร้างออเดอร์',
  'sale.order.confirmed': 'ยืนยันออเดอร์',
  'sale.order.done': 'ออเดอร์สำเร็จ',
  'sale.order.cancelled': 'ยกเลิกออเดอร์',
  'order.validated': 'ยืนยันออเดอร์',
  'order.picker_assigned': 'มอบหมาย Picker',
  'order.picking': 'กำลังจัดสินค้า',
  'order.picked': 'จัดสินค้าเสร็จ',
  'order.packing': 'กำลังแพ็ค',
  'order.packed': 'แพ็คเสร็จ',
  'order.reserved': 'จองสินค้าแล้ว',
  'order.awaiting_payment': 'รอชำระเงิน',
  'order.paid': 'ชำระเงินแล้ว',
  'order.to_delivery': 'เตรียมจัดส่ง',
  'order.in_delivery': 'กำลังจัดส่ง',
  'order.delivered': 'จัดส่งสำเร็จ',
  'order.cancelled': 'ยกเลิกออเดอร์',
  'delivery.validated': 'เริ่มจัดเตรียม',
  'delivery.in_transit': 'กำลังจัดส่ง',
  'delivery.done': 'ส่งเสร็จแล้ว',
  'delivery.cancelled': 'ยกเลิกการส่ง',
  'delivery.back_order': 'ส่งบางส่วน',
  'invoice.created': 'สร้างใบแจ้งหนี้',
  'invoice.posted': 'ออกใบแจ้งหนี้',
  'invoice.paid': 'ชำระเงินแล้ว',
  'invoice.cancelled': 'ยกเลิกใบแจ้งหนี้',
  'invoice.overdue': 'เกินกำหนดชำระ',
  'payment.received': 'รับชำระเงิน',
  'payment.confirmed': 'ยืนยันชำระเงิน',
}

function getEventIcon(eventType: string | null) {
  if (!eventType) return <Clock className="h-3 w-3" />
  if (eventType.includes('delivery') || eventType.includes('in_delivery') || eventType.includes('to_delivery')) return <Truck className="h-3 w-3" />
  if (eventType.includes('invoice')) return <FileText className="h-3 w-3" />
  if (eventType.includes('payment') || eventType.includes('paid')) return <CreditCard className="h-3 w-3" />
  if (eventType.includes('cancel')) return <XCircle className="h-3 w-3" />
  return <Package className="h-3 w-3" />
}

function getStatusColor(status: string | null) {
  switch (status) {
    case 'success': return { bg: '#dcfce7', text: '#16a34a', dot: '#16a34a' }
    case 'failed': return { bg: '#fee2e2', text: '#dc2626', dot: '#dc2626' }
    case 'retry': return { bg: '#fef3c7', text: '#d97706', dot: '#d97706' }
    case 'dead_letter': return { bg: '#fee2e2', text: '#dc2626', dot: '#dc2626' }
    default: return { bg: '#f3f4f6', text: '#6b7280', dot: '#6b7280' }
  }
}

function getStatusIcon(status: string | null) {
  switch (status) {
    case 'success': return <CheckCircle2 className="h-3 w-3 text-green-600" />
    case 'failed': return <XCircle className="h-3 w-3 text-red-600" />
    case 'retry': return <AlertCircle className="h-3 w-3 text-yellow-600" />
    default: return <Clock className="h-3 w-3 text-gray-400" />
  }
}

function fmtTime(raw: string | null) {
  if (!raw) return '—'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return raw
  return d.toLocaleString('th-TH', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function fmtCurrency(val: number | null) {
  if (val === null || val === undefined) return ''
  return `฿${Number(val).toLocaleString('th-TH', { minimumFractionDigits: 0 })}`
}

export function OdooOrderTimeline({ events, maxItems = 15 }: OdooOrderTimelineProps) {
  if (!events || events.length === 0) {
    return (
      <div className="text-center py-4 text-gray-400 text-xs">
        <Clock className="h-5 w-5 mx-auto mb-1 opacity-50" />
        ไม่มีข้อมูล Timeline
      </div>
    )
  }

  const displayEvents = events.slice(0, maxItems)

  return (
    <div className="space-y-0">
      {displayEvents.map((event, idx) => {
        const color = getStatusColor(event.status)
        const label = EVENT_LABELS[event.event_type || ''] || event.state_display || event.event_type || '—'
        const isLast = idx === displayEvents.length - 1

        return (
          <div key={event.id} className="flex gap-2.5">
            {/* Timeline line + dot */}
            <div className="flex flex-col items-center flex-shrink-0 w-5">
              <div
                className="w-2.5 h-2.5 rounded-full border-2 flex-shrink-0 mt-1"
                style={{ borderColor: color.dot, backgroundColor: event.status === 'success' ? color.dot : 'white' }}
              />
              {!isLast && <div className="w-px flex-1 bg-gray-200" />}
            </div>

            {/* Content */}
            <div className="flex-1 pb-3 min-w-0">
              <div className="flex items-start justify-between gap-1">
                <div className="flex items-center gap-1 min-w-0">
                  {getEventIcon(event.event_type)}
                  <span className="text-xs font-semibold text-gray-800 truncate">{label}</span>
                  {getStatusIcon(event.status)}
                </div>
                {event.amount_total !== null && event.amount_total > 0 && (
                  <span className="text-[10px] font-semibold text-gray-500 flex-shrink-0">
                    {fmtCurrency(event.amount_total)}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 mt-0.5">
                {event.order_name && (
                  <span className="text-[10px] text-blue-600 font-medium">{event.order_name}</span>
                )}
                <span className="text-[10px] text-gray-400">{fmtTime(event.processed_at)}</span>
              </div>

              {event.error_message && (
                <div className="text-[10px] text-red-500 mt-0.5 truncate" title={event.error_message}>
                  {event.error_message}
                </div>
              )}
            </div>
          </div>
        )
      })}

      {events.length > maxItems && (
        <div className="text-center text-[10px] text-gray-400 pt-1">
          +{events.length - maxItems} events อื่นๆ
        </div>
      )}
    </div>
  )
}
