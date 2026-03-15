"use client"

import { CreditCard, AlertTriangle, TrendingDown } from 'lucide-react'
import type { Customer360Credit } from '@/types/odoo'

interface OdooCreditCardProps {
  credit: Customer360Credit | null | undefined
}

function fmtCurrency(val: number | null | undefined) {
  if (val === null || val === undefined) return '—'
  return `฿${Number(val).toLocaleString('th-TH', { minimumFractionDigits: 0 })}`
}

export function OdooCreditCard({ credit }: OdooCreditCardProps) {
  if (!credit) return null

  const { credit_limit, credit_used, credit_remaining, total_due, overdue_amount } = credit

  const hasCredit = credit_limit !== null && credit_limit > 0
  const hasDue = (total_due !== null && total_due > 0) || (overdue_amount !== null && overdue_amount > 0)

  if (!hasCredit && !hasDue) return null

  const usedPercent = hasCredit && credit_used !== null
    ? Math.min(100, Math.round((credit_used / credit_limit!) * 100))
    : 0

  const barColor = usedPercent > 80 ? '#ef4444' : usedPercent > 50 ? '#f59e0b' : '#10b981'

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 space-y-2.5">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500">
        <CreditCard className="h-3.5 w-3.5" />
        วงเงินเครดิต
      </div>

      {hasCredit && (
        <>
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-500">วงเงิน</span>
            <span className="font-bold text-gray-900">{fmtCurrency(credit_limit)}</span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{ width: `${usedPercent}%`, backgroundColor: barColor }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-gray-500">
            <span>ใช้ไป {fmtCurrency(credit_used)} ({usedPercent}%)</span>
            <span>คงเหลือ {fmtCurrency(credit_remaining)}</span>
          </div>
        </>
      )}

      {hasDue && (
        <div className="space-y-1.5 pt-1 border-t border-gray-100">
          {total_due !== null && total_due > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-500">
                <TrendingDown className="h-3 w-3" />
                ยอดค้างชำระ
              </span>
              <span className="font-semibold text-orange-600">{fmtCurrency(total_due)}</span>
            </div>
          )}
          {overdue_amount !== null && overdue_amount > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1 text-gray-500">
                <AlertTriangle className="h-3 w-3" />
                เกินกำหนด
              </span>
              <span className="font-semibold text-red-600">{fmtCurrency(overdue_amount)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
