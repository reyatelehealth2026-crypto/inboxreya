"use client"

import { useState, useMemo } from 'react'
import { Search, Users, Receipt, FileCheck, AlertCircle, ArrowRight } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { type SlipCenterCustomer, normalizeRef } from './SlipCenterClient'

interface CustomerGridProps {
  customers: SlipCenterCustomer[]
  slipCountByRef: Record<string, number>
  bdoCountByRef: Record<string, number>
  isLoading: boolean
  onSelectCustomer: (ref: string, name: string, partnerId: string, lineUserId: string) => void
}

export function CustomerGrid({
  customers,
  slipCountByRef,
  bdoCountByRef,
  isLoading,
  onSelectCustomer,
}: CustomerGridProps) {
  const [search, setSearch] = useState('')

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    let list = customers.slice()

    if (q) {
      list = list.filter(c => {
        const ref = String(c.customer_ref || c.ref || '').toLowerCase()
        const name = String(c.customer_name || c.name || '').toLowerCase()
        return ref.includes(q) || name.includes(q)
      })
    }

    // Sort: customers with pending slips first, then pending BDOs, then alphabetical
    list.sort((a, b) => {
      const aRef = normalizeRef(a.customer_ref || a.ref)
      const bRef = normalizeRef(b.customer_ref || b.ref)
      const aSlips = slipCountByRef[aRef] || 0
      const bSlips = slipCountByRef[bRef] || 0
      const aBdos = bdoCountByRef[aRef] || 0
      const bBdos = bdoCountByRef[bRef] || 0
      // Customers with pending slips first
      if (aSlips > 0 && bSlips === 0) return -1
      if (aSlips === 0 && bSlips > 0) return 1
      // Then by pending BDOs
      if (aBdos > 0 && bBdos === 0) return -1
      if (aBdos === 0 && bBdos > 0) return 1
      // Then by slip count desc
      if (aSlips !== bSlips) return bSlips - aSlips
      return 0
    })

    return list
  }, [customers, search, slipCountByRef, bdoCountByRef])

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-9 w-full max-w-sm mb-4 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Search Bar */}
      <div className="relative mb-4 max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="ค้นหารหัส / ชื่อลูกค้า..."
          className="pl-9 h-9 text-sm bg-white"
        />
      </div>

      {/* Grid */}
      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="h-10 w-10 mx-auto mb-2 text-gray-300" />
          <p className="text-sm text-gray-500">ไม่พบลูกค้า</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((cu, idx) => {
            const ref = normalizeRef(cu.customer_ref || cu.ref)
            const name = cu.customer_name || cu.name || '-'
            const pid = String(cu.partner_id || cu.customer_id || cu.odoo_id || '')
            const lineUserId = cu.line_user_id || ''
            const slipCnt = slipCountByRef[ref] || 0
            const bdoCnt = bdoCountByRef[ref] || 0
            const hasPending = slipCnt > 0

            return (
              <button
                key={`${ref}-${idx}`}
                type="button"
                onClick={() => onSelectCustomer(ref, name, pid, lineUserId)}
                className={cn(
                  "text-left rounded-xl border p-3.5 transition-all hover:shadow-md hover:-translate-y-0.5 group",
                  hasPending
                    ? "bg-amber-50/60 border-amber-200 hover:border-amber-400"
                    : "bg-white border-gray-200 hover:border-gray-300"
                )}
              >
                {/* Top: Ref + Alert */}
                <div className="flex items-start justify-between mb-1">
                  <span className="font-bold text-sm text-gray-900">{ref || '-'}</span>
                  {hasPending && (
                    <AlertCircle className="h-4 w-4 text-amber-500 flex-shrink-0" />
                  )}
                </div>

                {/* Customer name */}
                <p className="text-xs text-gray-500 mb-2.5 truncate" title={name}>
                  {name}
                </p>

                {/* Badges */}
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {slipCnt > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 gap-0.5 border-amber-300 text-amber-700 bg-amber-50">
                      <Receipt className="h-2.5 w-2.5" />
                      สลิปรอ {slipCnt}
                    </Badge>
                  )}
                  {bdoCnt > 0 && (
                    <Badge variant="outline" className="text-[10px] h-5 gap-0.5 border-violet-300 text-violet-700 bg-violet-50">
                      <FileCheck className="h-2.5 w-2.5" />
                      BDO รอ {bdoCnt}
                    </Badge>
                  )}
                  {slipCnt === 0 && bdoCnt === 0 && (
                    <span className="text-[10px] text-gray-300">ไม่มีรายการรอ</span>
                  )}
                </div>

                {/* Salesperson + Arrow */}
                <div className="flex items-center justify-between">
                  {cu.salesperson_name ? (
                    <span className="text-[10px] text-gray-400 truncate">
                      {cu.salesperson_name}
                    </span>
                  ) : (
                    <span />
                  )}
                  <span className={cn(
                    "text-xs font-medium flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
                    hasPending ? "text-amber-600" : "text-gray-400"
                  )}>
                    เปิด <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
