"use client"

import { useState, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { Search, Users, Receipt, FileCheck, AlertCircle, ArrowRight, MessageCircle } from 'lucide-react'
import { Input } from '@/components/ui/input'
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
  const router = useRouter()

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

    // Sort: both slips+BDOs → only slips → only BDOs → none
    list.sort((a, b) => {
      const aRef = normalizeRef(a.customer_ref || a.ref)
      const bRef = normalizeRef(b.customer_ref || b.ref)
      const aSlips = slipCountByRef[aRef] || 0
      const bSlips = slipCountByRef[bRef] || 0
      const aBdos = bdoCountByRef[aRef] || 0
      const bBdos = bdoCountByRef[bRef] || 0
      const aScore = (aSlips > 0 ? 2 : 0) + (aBdos > 0 ? 1 : 0)
      const bScore = (bSlips > 0 ? 2 : 0) + (bBdos > 0 ? 1 : 0)
      if (aScore !== bScore) return bScore - aScore
      if (aSlips !== bSlips) return bSlips - aSlips
      return bBdos - aBdos
    })

    return list
  }, [customers, search, slipCountByRef, bdoCountByRef])

  if (isLoading) {
    return (
      <div>
        <Skeleton className="h-9 w-full max-w-sm mb-4 rounded-lg" />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <Skeleton key={i} className="h-32 rounded-xl" />
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

      {/* Summary row */}
      {filtered.length > 0 && (
        <p className="text-xs text-gray-400 mb-3">
          แสดง <span className="font-semibold text-gray-600">{filtered.length}</span> ลูกค้า
          {search && ` (กรองจาก ${customers.length} ทั้งหมด)`}
        </p>
      )}

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
            const hasPendingSlips = slipCnt > 0
            const hasPendingBdos = bdoCnt > 0
            const isUrgent = slipCnt >= 3
            const hasActivity = hasPendingSlips || hasPendingBdos

            return (
              <div
                key={`${ref}-${idx}`}
                className={cn(
                  "rounded-xl border transition-all hover:shadow-md group relative overflow-hidden",
                  isUrgent
                    ? "bg-red-50/50 border-red-200"
                    : hasPendingSlips
                    ? "bg-amber-50/60 border-amber-200"
                    : hasPendingBdos
                    ? "bg-violet-50/40 border-violet-200"
                    : "bg-white border-gray-200"
                )}
              >
                {/* Urgent tag */}
                {isUrgent && (
                  <div className="absolute top-0 right-0 bg-red-500 text-white text-[9px] font-bold px-2 py-0.5 rounded-bl-lg">
                    ด่วน
                  </div>
                )}

                {/* Main clickable area */}
                <button
                  type="button"
                  onClick={() => onSelectCustomer(ref, name, pid, lineUserId)}
                  className="w-full text-left p-3.5 pb-2"
                >
                  {/* Top: Ref */}
                  <div className="flex items-start gap-2 mb-1 pr-10">
                    {hasActivity && (
                      <AlertCircle className={cn(
                        "h-3.5 w-3.5 flex-shrink-0 mt-0.5",
                        isUrgent ? "text-red-500" : hasPendingSlips ? "text-amber-500" : "text-violet-400"
                      )} />
                    )}
                    <span className="font-bold text-sm text-gray-900 leading-tight">{ref || '-'}</span>
                  </div>

                  {/* Customer name */}
                  <p className="text-xs text-gray-500 mb-2.5 truncate pl-5" title={name}>
                    {name}
                  </p>

                  {/* Counts — prominent display */}
                  <div className="flex items-center gap-2 pl-5">
                    {slipCnt > 0 ? (
                      <div className="flex items-center gap-1 bg-amber-100 border border-amber-200 rounded-lg px-2 py-1">
                        <Receipt className="h-3 w-3 text-amber-600" />
                        <span className="text-xs font-bold text-amber-700">สลิปรอ</span>
                        <span className="text-sm font-extrabold text-amber-700 leading-none">{slipCnt}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                        <Receipt className="h-3 w-3 text-gray-300" />
                        <span className="text-xs text-gray-300">สลิป 0</span>
                      </div>
                    )}
                    {bdoCnt > 0 ? (
                      <div className="flex items-center gap-1 bg-violet-100 border border-violet-200 rounded-lg px-2 py-1">
                        <FileCheck className="h-3 w-3 text-violet-600" />
                        <span className="text-xs font-bold text-violet-700">BDO ค้าง</span>
                        <span className="text-sm font-extrabold text-violet-700 leading-none">{bdoCnt}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-2 py-1">
                        <FileCheck className="h-3 w-3 text-gray-300" />
                        <span className="text-xs text-gray-300">BDO 0</span>
                      </div>
                    )}
                  </div>
                </button>

                {/* Bottom bar: salesperson + action buttons */}
                <div className="flex items-center justify-between px-3.5 pb-3 pt-1.5 border-t border-gray-100/80">
                  <span className="text-[10px] text-gray-400 truncate flex-1 min-w-0">
                    {cu.salesperson_name || <span className="text-gray-200">—</span>}
                  </span>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {/* Chat button */}
                    <button
                      type="button"
                      title={lineUserId ? 'เปิดแชท Inbox' : 'ไม่มีข้อมูล LINE'}
                      disabled={!lineUserId}
                      onClick={e => {
                        e.stopPropagation()
                        if (lineUserId) router.push(`/inbox?userId=${encodeURIComponent(lineUserId)}`)
                      }}
                      className={cn(
                        "flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-all",
                        lineUserId
                          ? "bg-green-50 border border-green-200 text-green-700 hover:bg-green-100 hover:border-green-300"
                          : "bg-gray-50 border border-gray-100 text-gray-300 cursor-not-allowed"
                      )}
                    >
                      <MessageCircle className="h-3 w-3" />
                      แชท
                    </button>
                    {/* Open detail button */}
                    <button
                      type="button"
                      onClick={() => onSelectCustomer(ref, name, pid, lineUserId)}
                      className={cn(
                        "flex items-center gap-0.5 px-2 py-1 rounded-lg text-[10px] font-medium transition-all",
                        hasActivity
                          ? "bg-gray-800 text-white hover:bg-gray-700"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      )}
                    >
                      ดู <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
