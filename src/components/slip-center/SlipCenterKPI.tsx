"use client"

import { Receipt, FileCheck, CheckCircle2, AlertTriangle } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'

interface SlipCenterKPIProps {
  stats?: {
    totalCustomers: number
    totalPendingSlips: number
    totalPendingBdos: number
    totalAllBdos: number
  }
  isLoading: boolean
}

export function SlipCenterKPI({ stats, isLoading }: SlipCenterKPIProps) {
  if (isLoading) {
    return (
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    )
  }

  const kpis = [
    {
      label: 'สลิปรอจับคู่',
      value: stats?.totalPendingSlips ?? 0,
      icon: Receipt,
      color: 'text-amber-600',
      bg: 'bg-amber-50 border-amber-200',
      iconBg: 'bg-amber-100',
    },
    {
      label: 'BDO รอชำระ',
      value: stats?.totalPendingBdos ?? 0,
      icon: FileCheck,
      color: 'text-violet-600',
      bg: 'bg-violet-50 border-violet-200',
      iconBg: 'bg-violet-100',
    },
    {
      label: 'BDO ทั้งหมด',
      value: stats?.totalAllBdos ?? 0,
      icon: CheckCircle2,
      color: 'text-emerald-600',
      bg: 'bg-emerald-50 border-emerald-200',
      iconBg: 'bg-emerald-100',
    },
    {
      label: 'ลูกค้า',
      value: stats?.totalCustomers ?? 0,
      icon: AlertTriangle,
      color: 'text-blue-600',
      bg: 'bg-blue-50 border-blue-200',
      iconBg: 'bg-blue-100',
    },
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
      {kpis.map(kpi => {
        const Icon = kpi.icon
        return (
          <div
            key={kpi.label}
            className={`rounded-xl border p-3 transition-all hover:shadow-md ${kpi.bg}`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className={`p-1.5 rounded-lg ${kpi.iconBg}`}>
                <Icon className={`h-3.5 w-3.5 ${kpi.color}`} />
              </div>
              <span className="text-[11px] font-medium text-gray-500">{kpi.label}</span>
            </div>
            <p className={`text-2xl font-bold ${kpi.color}`}>
              {kpi.value.toLocaleString()}
            </p>
          </div>
        )
      })}
    </div>
  )
}
