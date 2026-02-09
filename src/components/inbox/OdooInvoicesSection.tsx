"use client"

import { useQuery } from '@tanstack/react-query'
import { FileText, Calendar, DollarSign, AlertCircle, ChevronRight } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface OdooInvoicesSectionProps {
  userId: string
  memberId: string | null | undefined
}

// Mock function - replace with actual API call
async function fetchCustomerInvoices(memberId: string) {
  // For now, return empty array. You'll need to implement an API endpoint
  // that fetches invoices from Odoo by partner_code
  return []
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
  const stateColors: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    open: 'bg-orange-100 text-orange-700',
    paid: 'bg-green-100 text-green-700',
    cancel: 'bg-red-100 text-red-700',
  }

  const stateLabels: Record<string, string> = {
    draft: 'ร่าง',
    open: 'รอชำระ',
    paid: 'ชำระแล้ว',
    cancel: 'ยกเลิก',
  }

  const isPaid = invoice.state === 'paid'
  const hasBalance = invoice.residual > 0

  return (
    <div className="border rounded-lg p-3 hover:bg-gray-50 transition-colors">
      <div className="flex items-start justify-between mb-2">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <p className="font-semibold text-sm">{invoice.invoice_number || invoice.number}</p>
            <Badge className={cn('text-xs h-5', stateColors[invoice.state] || stateColors.draft)}>
              {stateLabels[invoice.state] || invoice.state}
            </Badge>
          </div>
          <p className="text-xs text-gray-500">
            <Calendar className="h-3 w-3 inline mr-1" />
            {new Date(invoice.date_invoice).toLocaleDateString('th-TH')}
          </p>
          {invoice.date_due && !isPaid && (
            <p className="text-xs text-orange-600 mt-0.5">
              ครบกำหนด: {new Date(invoice.date_due).toLocaleDateString('th-TH')}
            </p>
          )}
        </div>
        <Button variant="ghost" size="sm" className="h-7 w-7 p-0">
          <ChevronRight className="h-4 w-4" />
        </Button>
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
            <span className="text-gray-600">คงเหลือ</span>
            <span className="font-semibold text-orange-600">
              ฿{invoice.residual?.toLocaleString() || '0'}
            </span>
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
