'use client'

import { Fragment, useCallback, useEffect, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { BdoDetailPanel } from '@/components/slip-center/BdoDetailPanel'

interface SlipReportItem {
  messageId: number
  userId: number | null
  customerName: string | null
  bdoId: number | null
  invoiceId: number | null
  bdoName: string | null
  amount: number | null
  ref: string | null
  points: number
  verifiedAt: string | null
  receivedAt: string
  imageUrl: string | null
  deliveryType: 'private' | 'company'
  /** Every order the matched document covers — a BDO often spans several. */
  documents: SlipDocument[]
}

interface SlipDocument {
  invoiceId: number
  invoiceNumber: string | null
  orderName: string | null
  amount: number
  paid: boolean
  paidAt: string | null
}

interface SlipReportSummary {
  received: number
  checked: number
  slips: number
  matchedBdo: number
  matchedInvoice: number
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

/** Date only, Buddhist era — the form the team reads on Odoo documents. */
function formatThaiDate(iso: string | null) {
  if (!iso) return null
  const parsed = new Date(iso)
  if (isNaN(parsed.getTime())) return null
  return parsed.toLocaleDateString('th-TH', { day: 'numeric', month: 'numeric', year: 'numeric' })
}

export function SlipReportClient() {
  const [days, setDays] = useState(7)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [summary, setSummary] = useState<SlipReportSummary | null>(null)
  const [items, setItems] = useState<SlipReportItem[]>([])
  // BDO ที่กำลังเปิดดู — ใช้ panel ตัวเดียวกับ Slip Center ที่ยิงข้อมูลสดจาก Odoo เอง
  const [openBdo, setOpenBdo] = useState<{ id: number; name: string | null } | null>(null)
  // แถวที่กางดูใบแจ้งหนี้ทั้งหมด เก็บเป็น messageId
  const [expanded, setExpanded] = useState<Set<number>>(new Set())

  const toggleRow = useCallback((messageId: number) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(messageId)) next.delete(messageId)
      else next.add(messageId)
      return next
    })
  }, [])

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

  // Read left to right: every picture that arrived, then what survived each
  // narrowing. Showing only the last number hides where slips are being lost.
  const funnel = summary
    ? [
        {
          label: 'รูปที่ลูกค้าส่งมา',
          value: summary.received.toLocaleString(),
          hint: 'ทุกรูปในช่วงนี้',
          tone: 'text-gray-800',
        },
        {
          label: 'ระบบตรวจแล้ว',
          value: summary.checked.toLocaleString(),
          hint: 'รูปที่มีผลตรวจบันทึกไว้',
          tone: 'text-sky-700',
        },
        {
          label: 'เป็นสลิปจริง',
          value: summary.slips.toLocaleString(),
          hint: 'ธนาคารยืนยันผ่าน',
          tone: 'text-teal-700',
        },
        {
          label: 'ยังไม่ผูกบิล',
          value: summary.unmatched.toLocaleString(),
          hint: 'คิวที่รอเซล',
          tone: summary.unmatched > 0 ? 'text-amber-700' : 'text-gray-400',
        },
      ]
    : []

  const totals = summary
    ? [
        {
          label: 'จับคู่ BDO',
          value: summary.matchedBdo.toLocaleString(),
          hint: 'ใบส่งของ',
          tone: 'text-green-700',
        },
        {
          label: 'จับคู่ใบแจ้งหนี้',
          value: summary.matchedInvoice.toLocaleString(),
          hint: 'ลูกค้าโอนก่อนส่ง',
          tone: 'text-violet-700',
        },
        {
          label: 'ยอดรวม',
          value: `฿${summary.totalAmount.toLocaleString()}`,
          hint: `${summary.customers.toLocaleString()} ลูกค้า`,
          tone: 'text-gray-800',
        },
        {
          label: 'แต้มที่ให้',
          value: summary.totalPoints.toLocaleString(),
          hint: '1,000 ฿ = 1 แต้ม',
          tone: 'text-amber-700',
        },
      ]
    : []

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-gray-800">สรุปสลิปที่ตรวจแล้ว</h1>
          <p className="text-xs text-gray-500">
            สลิปที่ยืนยันกับธนาคารผ่าน และบิลที่จับคู่ให้ — ใบส่งของ (BDO) หรือใบแจ้งหนี้
          </p>
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

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          เส้นทางของรูปที่เข้ามา
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {funnel.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-[11px] font-semibold text-gray-600">{kpi.label}</div>
              <div className={`mt-1 text-xl font-bold ${kpi.tone}`}>{kpi.value}</div>
              <div className="text-[10px] text-gray-400">{kpi.hint}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-1.5">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
          สลิปที่ผ่านแล้วถูกผูกกับอะไร
        </div>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {totals.map((kpi) => (
            <div key={kpi.label} className="rounded-xl border border-gray-200 bg-white p-3">
              <div className="text-[11px] font-semibold text-gray-600">{kpi.label}</div>
              <div className={`mt-1 text-xl font-bold ${kpi.tone}`}>{kpi.value}</div>
              <div className="text-[10px] text-gray-400">{kpi.hint}</div>
            </div>
          ))}
        </div>
      </div>

      {summary && summary.unmatched > 0 && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
          มี {summary.unmatched} สลิปที่ตรวจผ่านแต่ยังไม่ได้ผูกกับบิล — บันทึกจากหน้าแชทจะไม่มีการเลือกบิล
          หรือยอดที่โอนมาไม่ตรงกับบิลค้างใบไหนเลย
        </div>
      )}

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-left text-[11px] uppercase text-gray-600">
              <th className="px-3 py-2 font-semibold">รูป</th>
              <th className="px-3 py-2 font-semibold">ลูกค้า</th>
              <th className="px-3 py-2 font-semibold">ขนส่ง</th>
              <th className="px-3 py-2 font-semibold">จับคู่กับ</th>
              <th className="px-3 py-2 text-right font-semibold">ยอด</th>
              <th className="px-3 py-2 font-semibold">Ref</th>
              <th className="px-3 py-2 text-right font-semibold">แต้ม</th>
              <th className="px-3 py-2 font-semibold">ตรวจเมื่อ</th>
            </tr>
          </thead>
          <tbody>
            {loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">
                  กำลังโหลด...
                </td>
              </tr>
            )}

            {!loading && items.length === 0 && (
              <tr>
                <td colSpan={8} className="px-3 py-8 text-center text-xs text-gray-500">
                  ยังไม่มีสลิปที่ตรวจผ่านในช่วงนี้
                </td>
              </tr>
            )}

            {items.map((item) => (
              <Fragment key={item.messageId}>
              <tr className="border-b border-gray-100 last:border-0 hover:bg-gray-50">
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
                  {item.userId ? (
                    <Link
                      href={`/inbox/customers/${item.userId}`}
                      target="_blank"
                      className="block rounded px-1 py-0.5 hover:bg-teal-50"
                      title="เปิดข้อมูลลูกค้า"
                    >
                      <div className="text-xs font-medium text-teal-700 underline decoration-dotted underline-offset-2">
                        {item.customerName || `ลูกค้า #${item.userId}`}
                      </div>
                      <div className="text-[10px] text-gray-400">#{item.userId}</div>
                    </Link>
                  ) : (
                    <div className="text-xs font-medium text-gray-800">{item.customerName || '-'}</div>
                  )}
                </td>
                <td className="px-3 py-2">
                  {item.deliveryType === 'private' ? (
                    <span className="rounded bg-violet-50 px-1.5 py-0.5 text-[10px] font-medium text-violet-800">
                      ขนส่งเอกชน
                    </span>
                  ) : (
                    <span className="text-[10px] text-gray-400">สายส่ง</span>
                  )}
                </td>
                <td className="px-3 py-2">
                  {item.bdoId ? (
                    <button
                      type="button"
                      onClick={() => setOpenBdo({ id: item.bdoId as number, name: item.bdoName })}
                      className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-[11px] text-green-800 underline decoration-dotted underline-offset-2 hover:bg-green-100"
                      title="ดูรายละเอียด BDO"
                    >
                      {item.bdoName || `BDO-${item.bdoId}`}
                    </button>
                  ) : item.invoiceId ? (
                    // ใบแจ้งหนี้ของลูกค้าที่โอนก่อนส่ง — ยังไม่มี panel รายละเอียด
                    // ฝั่ง invoice จึงแสดงเป็นป้ายเฉย ๆ ไม่ให้กด
                    <span
                      className="rounded bg-violet-50 px-1.5 py-0.5 font-mono text-[11px] text-violet-800"
                      title="ใบแจ้งหนี้ — ลูกค้าโอนก่อนส่ง"
                    >
                      {item.bdoName || `INV-${item.invoiceId}`}
                    </span>
                  ) : item.bdoName ? (
                    // มีชื่อ BDO แต่ไม่มี id — เปิด panel ไม่ได้ เพราะ panel ยิงด้วย id เท่านั้น
                    <span className="rounded bg-green-50 px-1.5 py-0.5 font-mono text-[11px] text-green-800">
                      {item.bdoName}
                    </span>
                  ) : (
                    <span className="text-[11px] text-amber-700">ยังไม่ผูก</span>
                  )}

                  {item.documents.length > 0 && (
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[10px] text-gray-500">
                      {item.documents[0].invoiceNumber && (
                        <span className="font-mono">{item.documents[0].invoiceNumber}</span>
                      )}
                      {item.documents[0].orderName && (
                        <span className="font-mono text-gray-400">{item.documents[0].orderName}</span>
                      )}
                      {/* Only the settled state is worth a word. A slip exists
                          because the bill was unpaid, so the opposite label tells
                          the reader nothing they did not already know. */}
                      {item.documents[0].paid && (
                        <span className="text-green-700">
                          ชำระแล้ว
                          {formatThaiDate(item.documents[0].paidAt)
                            ? ` ${formatThaiDate(item.documents[0].paidAt)}`
                            : ''}
                        </span>
                      )}
                      {item.documents.length > 1 && (
                        <button
                          type="button"
                          onClick={() => toggleRow(item.messageId)}
                          className="rounded px-1 font-medium text-teal-700 underline decoration-dotted hover:bg-teal-50"
                        >
                          {expanded.has(item.messageId) ? 'ย่อ' : `+อีก ${item.documents.length - 1} ใบ`}
                        </button>
                      )}
                    </div>
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

              {expanded.has(item.messageId) && item.documents.length > 1 && (
                <tr className="border-b border-gray-100 bg-gray-50">
                  <td colSpan={8} className="px-3 py-2">
                    <div className="space-y-1 pl-14">
                      <div className="text-[10px] font-semibold text-gray-500">
                        {item.bdoName || 'บิลนี้'} คลุม {item.documents.length} ใบแจ้งหนี้
                      </div>

                      {item.documents.map((doc) => (
                        <div
                          key={doc.invoiceId}
                          className="flex flex-wrap items-center gap-x-2 text-[11px]"
                        >
                          <span className="font-mono text-gray-700">
                            {doc.invoiceNumber || `INV-${doc.invoiceId}`}
                          </span>
                          <span className="font-mono text-gray-400">{doc.orderName || '-'}</span>
                          <span className="text-gray-600">฿{doc.amount.toLocaleString()}</span>
                          {doc.paid && (
                            <span className="text-green-700">
                              ชำระแล้ว
                              {formatThaiDate(doc.paidAt) ? ` ${formatThaiDate(doc.paidAt)}` : ''}
                            </span>
                          )}
                        </div>
                      ))}

                      {/* The comparison a rep is actually making: does what the
                          bank confirmed cover everything this document holds? */}
                      <div className="pt-1 text-[10px] text-gray-500">
                        รวมทุกใบ ฿
                        {item.documents.reduce((sum, d) => sum + d.amount, 0).toLocaleString()}
                        {item.amount !== null && ` · สลิปโอนมา ฿${item.amount.toLocaleString()}`}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>

      {openBdo && (
        <BdoDetailPanel
          bdoId={openBdo.id}
          bdoName={openBdo.name}
          onClose={() => setOpenBdo(null)}
        />
      )}
    </div>
  )
}
