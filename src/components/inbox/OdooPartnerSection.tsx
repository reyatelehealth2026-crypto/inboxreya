"use client"

import { useQuery } from '@tanstack/react-query'
import { Building2, Phone, Mail, MapPin, CreditCard, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { odooApi } from '@/lib/odoo-api'
import type { OdooPartner } from '@/types/odoo'

interface OdooPartnerSectionProps {
  userId: string
  memberId: string | null | undefined
}

export function OdooPartnerSection({ userId, memberId }: OdooPartnerSectionProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['odoo-partner', memberId],
    queryFn: async () => {
      if (!memberId) return null
      const response = await odooApi.getPartner(memberId)
      if (!response.success || !response.data) {
        throw new Error(response.error || 'Failed to fetch partner data')
      }
      return response.data.partner as OdooPartner
    },
    enabled: !!memberId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 1,
  })

  if (!memberId) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          ไม่มีเลขสมาชิก ไม่สามารถเชื่อมต่อ Odoo ได้
        </AlertDescription>
      </Alert>
    )
  }

  if (isLoading) {
    return <PartnerSkeleton />
  }

  if (error || !data) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="text-sm">
          {error instanceof Error ? error.message : 'ไม่พบข้อมูลใน Odoo ERP'}
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-3">
      <PartnerField label="Partner Code" value={data.partner_code} icon={Building2} />
      <PartnerField label="ชื่อ" value={data.name} icon={Building2} />
      <PartnerField label="เบอร์โทร" value={data.phone || data.mobile} icon={Phone} />
      <PartnerField label="อีเมล" value={data.email} icon={Mail} />
      <PartnerField
        label="ที่อยู่"
        value={[data.street, data.street2, data.city].filter(Boolean).join(', ')}
        icon={MapPin}
      />
      {data.credit_limit && (
        <PartnerField
          label="วงเงินเครดิต"
          value={`฿${data.credit_limit.toLocaleString()}`}
          icon={CreditCard}
        />
      )}
      {data.total_due && data.total_due > 0 && (
        <PartnerField
          label="ยอดค้างชำระ"
          value={`฿${data.total_due.toLocaleString()}`}
          icon={CreditCard}
          className="text-orange-600 font-semibold"
        />
      )}
      {data.total_overdue && data.total_overdue > 0 && (
        <PartnerField
          label="ยอดเกินกำหนด"
          value={`฿${data.total_overdue.toLocaleString()}`}
          icon={CreditCard}
          className="text-red-600 font-semibold"
        />
      )}
    </div>
  )
}

function PartnerField({
  label,
  value,
  icon: Icon,
  className
}: {
  label: string
  value: string | null | undefined
  icon?: any
  className?: string
}) {
  if (!value) return null

  return (
    <div className="flex items-start gap-3">
      {Icon && <Icon className="h-4 w-4 text-gray-500 mt-0.5 flex-shrink-0" />}
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-500 mb-0.5">{label}</p>
        <p className={`text-sm ${className || 'text-gray-900'}`}>{value}</p>
      </div>
    </div>
  )
}

function PartnerSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="flex items-start gap-3">
          <Skeleton className="h-4 w-4 flex-shrink-0" />
          <div className="flex-1 space-y-1">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-4 w-full" />
          </div>
        </div>
      ))}
    </div>
  )
}
