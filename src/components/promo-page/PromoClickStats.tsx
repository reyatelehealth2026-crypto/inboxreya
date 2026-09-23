'use client'

import { Card } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import type { RegionClickSummary } from '@/lib/promo-clicks'

const ROWS = 10

const num = (value: number) => value.toLocaleString('th-TH')
const pct = (value: number) => `${(value * 100).toFixed(1)}%`

/**
 * Imagemap and flex link taps per brand. CTR is people who tapped over people the
 * broadcast reached, so one person tapping three times still counts once.
 */
export function PromoClickStats({ summary, days }: { summary: RegionClickSummary | null; days: number }) {
  const rows = summary?.brands.slice(0, ROWS) ?? []
  const max = rows[0]?.people ?? 0
  const totals = summary?.totals
  return (
    <Card className="space-y-3 p-4">
      <div>
        <Label>คนที่กดลิงก์ในบรอดแคสต์ ({days} วันล่าสุด)</Label>
        <p className="text-xs text-gray-500">
          {totals
            ? `${totals.broadcasts} บรอดแคสต์ · ส่งถึง ${num(totals.recipients)} คน · กด ${num(totals.people)} คน (${num(totals.clicks)} ครั้ง)` +
              (totals.recipients > 0 ? ` · CTR ${pct(totals.people / totals.recipients)}` : '')
            : 'กำลังโหลด...'}
        </p>
      </div>
      {summary && rows.length === 0 && (
        <p className="text-sm text-gray-400">ยังไม่มีบรอดแคสต์ imagemap หรือ Flex ในช่วงนี้</p>
      )}
      {rows.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="truncate font-medium text-gray-800">{row.label}</span>
            <span className="shrink-0 text-xs text-gray-500">
              {num(row.people)} คน · {num(row.clicks)} ครั้ง · CTR {pct(row.ctr)}
            </span>
          </div>
          <div className="h-1.5 rounded bg-gray-100">
            <div
              className="h-1.5 rounded bg-[#ec3013]"
              style={{ width: max > 0 ? `${Math.max(2, (row.people / max) * 100)}%` : '0%' }}
            />
          </div>
        </div>
      ))}
    </Card>
  )
}
