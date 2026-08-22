'use client'

import { useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface SlipReportItem {
  messageId: number
  userId: number | null
  customerName: string | null
  bdoId: number | null
  bdoName: string | null
  amount: number | null
  ref: string | null
  points: number
  verifiedAt: string | null
  receivedAt: string
  imageUrl: string | null
}

interface SlipReportSummary {
  slips: number
  matchedBdo: number
  unmatched: number
  totalAmount: number
  totalPoints: number
  customers: number
}

const RANGES = [
  { days: 1, label: 'วันนี้' },
  { days: 7, label: '7 วัน' },
  { days: 30, label: '30 วัน' },
]

function formatThaiDateTime(iso: string | null) {
  if (!iso) return '-'
  const parsed = new Date(iso)
  if (isNaN(parsed.getTime())) return '-'
  return parsed.toLocaleString('th-TH', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export function SlipReportClient() {
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SlipReportSummary | null>(null)
  const [items, setItems] = useState<SlipReportItem[]>([])

  const load = useCallback(async (rangeDays: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/inbox/slip-report?days=${rangeDays}`)
      const json = await res.json()
      if (!json.success) throw new Error(json.error || 'โหลดข้อมูลไม่สำเร็จ')
      setSummary(json.summary)
      setItems(json.items)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load(days)
  }, [days, load])

  const kpis = summary
    ? [
        { label: 'สลิปที่ตรวจผ่าน', value: summary.slips.toLocaleString(), tone: 'text-teal-700' },
        { label: 'จับคู่ BDO แล้ว', value: summary.matchedBdo.toLocaleString(), tone: 'text-green-700' },
        { label: 'ยอดรวม', value: `฿${summary.totalAmount.toLocaleString()}`, tone: 'text-gray-800' },
        { label: 'แต้มที่ให้', value: summary.totalPoints.toLocaleString(), tone: 'text-amber-700' },
      ]
    : []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">สรุปสลิปที่ตรวจแล้ว</h1>
          <p className="text-xs text-gray-500">สลิปที่ยืนยันกับธนาคารผ่าน และ BDO ที่จับคู่ให้</p>
        </div>

        <div className="flex items-center gap-2">
          {RANGES.map((range) => (
            <Button
              key={range.days}
              variant={days === range.days ? 'default' : 'outline'}
              size="sm"
              className="h-8 text-xs"
              onClick={() => setDays(range.days)}
            >
              {range.label}
            </Button>
          ))}
          <Button
            variant="outline"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            disabled={loading}
            onClick={() => load(days)}
          >
            {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
            รีเฟรช
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-3">
            <div className="text-[11px] font-semibold text-gray-600">{kpi.label}</div>
            <div className={`mt-1 text-xl font-bold ${kpi.tone}`}>{kpi.value}</div>
          </div>
        ))}
      </div>

      {summary && summary.unmatched > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          มี {summary.unmatched} สลิปที่ตรวจผ่านแต่ยังไม่ได้ผูกกับ BDO (บันทึกจากหน้าแชทจะไม่มีการเลือก BDO)
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase text-gray-600">
              <th className="px-3 py-2 font-semibold">รูป</th>
              <th className="px-3 py-2 font-semibold">ลูกค้า</th>
              <th className="px-3 py-2 font-semibold">BDO</th>
              <th className="px-3 py-2 text-right font-semibold">ยอด</th>
              <th className="px-3 py-2 font-semibold">Ref</th>
              <th className="px-3 py-2 text-right font-semibold">แต้ม</th>
              <th className="px-3 py-2 font-semibold">ตรวจเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-gray-500">
                  กำลังโหลด...
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={7} className="px-3 py-8 text-center text-xs text-gray-500">
                  ยังไม่มีสลิปที่ตรวจผ่านในช่วงนี้
                </td>
              </tr>
            )}

            {items.map((item) => (
              <tr key={item.messageId} className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
                <td className="px-3 py-2">
                  {item.imageUrl ? (
                    <a href={item.imageUrl} target="_blank" rel="noopener noreferrer">
                      <Image
                        src={item.imageUrl}
                        alt="สลิป"
                        width={40}
                        height={56}
                        className="h-14 w-10 rounded border border-gray-200 object-cover"
                        unoptimized
                      />
                    </a>
                  ) : (
                    <span className="text-xs text-gray-400">-</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  <div className="text-xs font-medium text-gray-800">{item.customerName || '-'}</div>
                  {item.userId && <div className="text-[10px] text-gray-400">#{item.userId}</div>}
                </td>
                <td className="px-3 py-2">
                  {item.bdoName || item.bdoId ? (
                    <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-[11px] text-green-800">
                      {item.bdoName || `BDO-${item.bdoId}`}
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-700">ยังไม่ผูก</span>
                  )}
                </td>
                <td className="px-3 py-2 text-right text-xs font-semibold text-gray-800">
                  {item.amount ? `฿${item.amount.toLocaleString()}` : '-'}
                </td>
                <td className="px-3 py-2 font-mono text-[11px] text-gray-600">{item.ref || '-'}</td>
                <td className="px-3 py-2 text-right text-xs text-amber-700">
                  {item.points > 0 ? `+${item.points}` : '-'}
                </td>
                <td className="px-3 py-2 text-[11px] text-gray-600">{formatThaiDateTime(item.verifiedAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
