"use client"

import { Receipt, FileCheck, CheckCircle2, Users, AlertCircle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface SlipCenterKPIProps {
  stats?: {
    totalCustomers: number
    totalPendingSlips: number
    totalPendingBdos: number
    totalAllBdos: number
    totalPaidBdos?: number
  }
  isLoading: boolean
}

export function SlipCenterKPI({ stats, isLoading }: SlipCenterKPIProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 rounded-xl" />
        ))}
      </div>
    )
  }

  const pendingSlips = stats?.totalPendingSlips ?? 0
  const pendingBdos  = stats?.totalPendingBdos ?? 0
  const paidBdos     = stats?.totalPaidBdos ?? 0
  const customers    = stats?.totalCustomers ?? 0

  const kpis = [
    {
      label: 'สลิปรอจับคู่',
      value: pendingSlips,
      sub: 'อัพโหลดแล้ว รอจับคู่ BDO',
      icon: Receipt,
      color: 'text-amber-600',
      bg: pendingSlips > 0 ? 'bg-amber-50 border-amber-300' : 'bg-gray-50 border-gray-200',
      iconBg: 'bg-amber-100',
      urgent: pendingSlips >= 5,
    },
    {
      label: 'BDO ค้างชำระ',
      value: pendingBdos,
      sub: 'ยังไม่ได้รับชำระ',
      icon: AlertCircle,
      color: 'text-violet-600',
      bg: pendingBdos > 0 ? 'bg-violet-50 border-violet-300' : 'bg-gray-50 border-gray-200',
      iconBg: 'bg-violet-100',
      urgent: false,
    },
    {
      label: 'BDO จ่ายแล้ว',
      value: paidBdos,
      sub: 'ชำระเรียบร้อย',
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100',
      urgent: false,
    },
    {
      label: 'ลูกค้าทั้งหมด',
      value: customers,
      sub: 'ในระบบ',
      icon: Users,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
      urgent: false,
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {kpis.map(kpi => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className={`rounded-xl border p-3.5 transition-all hover:shadow-md relative overflow-hidden ${kpi.bg}`}
          >
            {kpi.urgent && (
              <span className="absolute top-2 right-2 flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
              </span>
            )}
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                <Icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
              <span className="text-[11px] font-semibold text-gray-600">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold leading-none ${kpi.color}`}>
              {kpi.value.toLocaleString()}
            </p>
            <p className="text-[10px] text-gray-400 mt-1">{kpi.sub}</p>
          </div>
        )
      })}
    </div>
  )
}
