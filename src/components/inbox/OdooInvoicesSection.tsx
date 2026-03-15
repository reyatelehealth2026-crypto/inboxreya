"use client"

import { useQuery } from '@tanstack/react-query'
import { FileText, Calendar, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface OdooInvoicesSectionProps {
  userId: string
  memberId: string | null | undefined
}

async function fetchCustomerInvoices(memberId: string) {
  const res = await fetch('/api/odoo-dashboard', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action: 'odoo_invoices',
      customer_ref: memberId,
      limit: 20,
      offset: 0,
    }),
  })
  const json = await res.json()
  if (!json.success) return []
  return json.data?.invoices || []
}

export function OdooInvoicesSection({ userId, memberId }: OdooInvoicesSectionProps) {
  const { data: invoices, isLoading, error } = useQuery({
    queryKey: ['odoo-invoices', memberId],
    queryFn: () => fetchCustomerInvoices(memberId!),
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
    return <InvoicesSkeleton />
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ไม่สามารถโหลดข้อมูลใบแจ้งหนี้ได้
        </AlertDescription>
      </Alert>
    )
  }

  if (!invoices || invoices.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ยังไม่มีใบแจ้งหนี้</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-[300px]">
      <div className="space-y-3 pr-4">
        {invoices.map((invoice: any) => (
          <InvoiceItem key={invoice.id} invoice={invoice} />
        ))}
      </div>
    </ScrollArea>
  )
}

function InvoiceItem({ invoice }: { invoice: any }) {
  const stateVal = String(invoice.invoice_state || invoice.state || '').toLowerCase()
  // Multi-signal paid detection (matches PHP backend logic)
  const isPaid = stateVal === 'paid'
    || invoice.is_paid
    || String(invoice.latest_event || '') === 'invoice.paid'
    || String(invoice.payment_state || '').toLowerCase() === 'paid'
    || (parseFloat(invoice.amount_residual) === 0 && parseFloat(invoice.amount_total || 0) > 0)

  const dueDate = invoice.due_date || invoice.invoice_date_due
  const isOverdue = !isPaid && dueDate && new Date(dueDate) < new Date()
  const effectiveState = isPaid ? 'paid' : (isOverdue ? 'overdue' : stateVal)

  const stateConfig: Record<string, { color: string; label: string }> = {
    draft: { color: 'bg-gray-100 text-gray-700', label: 'ร่าง' },
    open: { color: 'bg-orange-100 text-orange-700', label: 'รอชำระ' },
    posted: { color: 'bg-orange-100 text-orange-700', label: 'รอชำระ' },
    paid: { color: 'bg-green-100 text-green-700', label: 'ชำระแล้ว' },
    overdue: { color: 'bg-red-100 text-red-700', label: 'เกินกำหนด' },
    cancel: { color: 'bg-gray-100 text-gray-500', label: 'ยกเลิก' },
  }
  const { color: badgeColor, label: badgeLabel } = stateConfig[effectiveState] || stateConfig.draft

  const residual = isPaid ? 0 : (invoice.amount_residual ?? invoice.amount_total ?? 0)
  const hasBalance = !isPaid && parseFloat(residual) > 0

  const invoiceDate = invoice.invoice_date || invoice.due_date || invoice.updated_at || invoice.synced_at
  const dateStr = invoiceDate ? new Date(invoiceDate).toLocaleDateString('th-TH') : '-'

  return (
    <div className={cn("border rounded-lg p-3 hover:bg-gray-50 transition-colors", isPaid && "bg-green-50/50")}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">{invoice.invoice_number || invoice.name || '-'}</p>
            <Badge className={cn('text-xs h-5', badgeColor)}>
              {badgeLabel}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            <Calendar className="h-3 w-3 inline mr-1" />
            {dateStr}
          </p>
          {invoice.order_name && (
            <p className="text-xs text-blue-600 mt-0.5">
              {invoice.order_name}
            </p>
          )}
          {dueDate && !isPaid && (
            <p className={cn("text-xs mt-0.5", isOverdue ? "text-red-600 font-medium" : "text-orange-600")}>
              ครบกำหนด: {new Date(dueDate).toLocaleDateString('th-TH')}
              {isOverdue && ' ⚠'}
            </p>
          )}
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">ยอดรวม</span>
          <span className="font-semibold text-gray-900">
            ฿{invoice.amount_total?.toLocaleString() || '0'}
          </span>
        </div>
        {hasBalance && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">ค้างชำระ</span>
            <span className="font-semibold text-red-600">
              ฿{parseFloat(residual).toLocaleString()}
            </span>
          </div>
        )}
        {isPaid && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">ค้างชำระ</span>
            <span className="text-gray-400">฿0</span>
          </div>
        )}
      </div>
    </div>
  )
}

function InvoicesSkeleton() {
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
