"use client"

import { useQuery } from '@tanstack/react-query'
import {
  X, FileCheck, ExternalLink, FileText, RefreshCw,
  ShoppingCart, Receipt, Wallet, FileMinusIcon, AlertCircle, CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { useState, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'

const ODOO_BASE = 'https://erp.cnyrxapp.com'

interface BdoDetailPanelProps {
  bdoId: number | null
  bdoName?: string | null
  partnerId?: number | null
  lineUserId?: string | null
  onClose: () => void
}

interface BdoSummary {
  so_amount?: number
  outstanding_amount?: number
  credit_note_amount?: number
  deposit_amount?: number
  net_to_pay?: number
}

interface SaleOrderLine {
  product_name?: string
  name?: string
  product_code?: string
  quantity?: number
  uom?: string
  unit_price?: number
  price_unit?: number
  subtotal?: number
  price_subtotal?: number
}

interface SaleOrder {
  name?: string
  amount_total?: number
  lines?: SaleOrderLine[]
}

interface FinanceRow {
  number?: string
  name?: string
  date?: string
  origin?: string
  residual?: number
  amount_total?: number
  amount?: number
}

interface LinkedSlip {
  slip_inbox_name?: string
  name?: string
  transfer_date?: string
  created_at?: string
  amount?: number
}

interface BdoDetailData {
  bdo?: Record<string, any>
  summary?: BdoSummary
  sale_orders?: SaleOrder[]
  outstanding_invoices?: FinanceRow[]
  credit_notes?: FinanceRow[]
  deposits?: FinanceRow[]
  slips?: LinkedSlip[]
  odoo_url?: string | null
  pdf_url?: string | null
}

async function fetchBdoDetail(bdoId: number, partnerId?: number | null, lineUserId?: string | null): Promise<BdoDetailData> {
  const params = new URLSearchParams({ bdoId: String(bdoId) })
  if (partnerId) params.set('partnerId', String(partnerId))
  if (lineUserId) params.set('lineUserId', lineUserId)
  const res = await fetch(`/api/slip-center/bdo-detail?${params}`)
  const json = await res.json()
  if (!res.ok || !json.success) throw new Error(json.error || 'Failed to load BDO detail')
  return json.data
}

function fmtBaht(val?: number | null): string {
  if (val == null || isNaN(Number(val))) return '-'
  return '฿' + Number(val).toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

function fmtDate(raw?: string | null): string {
  if (!raw) return '-'
  const d = new Date(raw)
  if (isNaN(d.getTime())) return String(raw).slice(0, 10)
  return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: '2-digit' })
}

function SectionTitle({ icon: Icon, color, label }: { icon: React.ElementType; color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5 font-semibold text-sm text-gray-700 mt-4 mb-2">
      <Icon className={`h-4 w-4 ${color}`} />
      {label}
    </div>
  )
}

export function BdoDetailPanel({ bdoId, bdoName, partnerId, lineUserId, onClose }: BdoDetailPanelProps) {
  const qc = useQueryClient()
  const [pdfOpen, setPdfOpen] = useState(false)

  const { data, isLoading, error, isFetching } = useQuery<BdoDetailData>({
    queryKey: ['bdo-detail', bdoId, lineUserId ?? partnerId],
    queryFn: () => fetchBdoDetail(bdoId!, partnerId, lineUserId),
    enabled: bdoId != null,
    staleTime: 30000, // 30s — live from Odoo
    refetchOnWindowFocus: false,
  })

  const handleRefresh = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['bdo-detail', bdoId, lineUserId ?? partnerId] })
  }, [qc, bdoId, partnerId, lineUserId])

  if (bdoId == null) return null

  const bdo = data?.bdo
  const summary = data?.summary
  const odooUrl = data?.odoo_url || (bdo?.id ? `${ODOO_BASE}/web#id=${bdo.id}&model=cny.bill.invoice.before.delivery&view_type=form` : null)
  const pdfUrl = data?.pdf_url

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-lg bg-white shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-violet-100 rounded-lg">
              <FileCheck className="h-4 w-4 text-violet-600" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-900">{bdoName || `BDO-${bdoId}`}</h2>
              <p className="text-[10px] text-gray-400">รายละเอียด BDO</p>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isFetching} className="h-8 w-8 p-0">
              <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            </Button>
            <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-1">
          {isLoading ? (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
              </div>
              <Skeleton className="h-8 rounded-lg" />
              <Skeleton className="h-32 rounded-lg" />
            </div>
          ) : error ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertCircle className="h-10 w-10 mb-2 text-red-300" />
              <p className="text-sm text-gray-500 mb-1">ไม่สามารถโหลดข้อมูล BDO ได้</p>
              <p className="text-xs text-red-400">{error instanceof Error ? error.message : 'Unknown error'}</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={handleRefresh}>
                <RefreshCw className="h-3.5 w-3.5 mr-1.5" /> ลองใหม่
              </Button>
            </div>
          ) : (
            <>
              {/* Info Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-3">
                {[
                  { label: 'BDO', value: bdo?.name || bdo?.bdo_name || bdoName || '-' },
                  { label: 'สถานะ', value: bdo?.state || '-' },
                  { label: 'วันที่', value: fmtDate(bdo?.doc_date || bdo?.bdo_date || bdo?.updated_at) },
                  { label: 'ประเภทขนส่ง', value: bdo?.delivery_type === 'company' ? 'สายส่ง' : bdo?.delivery_type === 'private' ? 'ขนส่งเอกชน' : '-' },
                  { label: 'ยอดสุทธิ', value: fmtBaht(bdo?.amount_net_to_pay || bdo?.amount_total), bold: true, green: true },
                ].map(item => (
                  <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                    <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                    <div className={cn('text-sm font-semibold', item.green ? 'text-emerald-600' : 'text-gray-800')}>
                      {item.value}
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons */}
              {(pdfUrl || odooUrl) && (
                <div className="flex gap-2 flex-wrap mb-2">
                  {pdfUrl && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPdfOpen(true)}
                      className="gap-1.5 text-xs h-8 border-blue-200 text-blue-700 hover:bg-blue-50"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      ดู Statement PDF
                    </Button>
                  )}
                  {odooUrl && (
                    <a href={odooUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8 border-gray-200">
                        <ExternalLink className="h-3.5 w-3.5" />
                        เปิดใน Odoo
                      </Button>
                    </a>
                  )}
                </div>
              )}

              {/* Summary */}
              {summary && (
                <>
                  <SectionTitle icon={Wallet} color="text-emerald-500" label="สรุปยอด" />
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {[
                      { label: 'SO รอบนี้', value: fmtBaht(summary.so_amount) },
                      { label: 'Invoice ค้างชำระ', value: fmtBaht(summary.outstanding_amount), amber: (summary.outstanding_amount ?? 0) > 0 },
                      { label: 'Credit Note', value: fmtBaht(summary.credit_note_amount) },
                      { label: 'เงินมัดจำ', value: fmtBaht(summary.deposit_amount) },
                      { label: 'Net To Pay', value: fmtBaht(summary.net_to_pay), bold: true, green: true },
                    ].map(item => (
                      <div key={item.label} className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
                        <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                        <div className={cn('text-sm font-semibold', item.green ? 'text-emerald-600' : item.amber ? 'text-amber-600' : 'text-gray-800')}>
                          {item.value}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Sale Orders */}
              {Array.isArray(data?.sale_orders) && (data?.sale_orders?.length ?? 0) > 0 && (
                <>
                  <SectionTitle icon={ShoppingCart} color="text-blue-500" label="รายการสินค้า" />
                  <div className="space-y-2">
                    {data!.sale_orders!.map((order, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                        <div className="flex items-center justify-between px-3 py-2 bg-gray-50 border-b border-gray-100">
                          <span className="text-xs font-semibold text-gray-800">{order.name || '-'}</span>
                          <span className="text-xs font-bold text-blue-600">{fmtBaht(order.amount_total)}</span>
                        </div>
                        {Array.isArray(order.lines) && order.lines.length > 0 && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px]">
                              <thead>
                                <tr className="bg-gray-50/50 text-gray-400">
                                  <th className="text-left px-2 py-1.5 font-medium">สินค้า</th>
                                  <th className="text-right px-2 py-1.5 font-medium">จำนวน</th>
                                  <th className="text-right px-2 py-1.5 font-medium">ราคา</th>
                                  <th className="text-right px-2 py-1.5 font-medium">รวม</th>
                                </tr>
                              </thead>
                              <tbody>
                                {order.lines.map((line, li) => (
                                  <tr key={li} className="border-t border-gray-50 hover:bg-gray-50/50">
                                    <td className="px-2 py-1.5">
                                      <span className="text-gray-800">{line.product_name || line.name || '-'}</span>
                                      {line.product_code && (
                                        <span className="ml-1 text-gray-400">({line.product_code})</span>
                                      )}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-gray-600">
                                      {line.quantity ?? 0} {line.uom || ''}
                                    </td>
                                    <td className="px-2 py-1.5 text-right text-gray-600">
                                      {fmtBaht(line.unit_price || line.price_unit)}
                                    </td>
                                    <td className="px-2 py-1.5 text-right font-semibold text-gray-800">
                                      {fmtBaht(line.subtotal || line.price_subtotal)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Outstanding Invoices */}
              {Array.isArray(data?.outstanding_invoices) && (data?.outstanding_invoices?.length ?? 0) > 0 && (
                <>
                  <SectionTitle icon={Receipt} color="text-amber-500" label="ใบแจ้งหนี้ค้างชำระ" />
                  <div className="space-y-1.5">
                    {data!.outstanding_invoices!.map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 border border-amber-100 bg-amber-50/40 rounded-lg">
                        <div>
                          <div className="text-xs font-semibold text-gray-800">{row.number || row.name || '-'}</div>
                          <div className="text-[10px] text-gray-400">{[row.date ? fmtDate(row.date) : '', row.origin || ''].filter(Boolean).join(' · ')}</div>
                        </div>
                        <span className="text-sm font-bold text-amber-600">{fmtBaht(row.residual ?? row.amount_total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Credit Notes */}
              {Array.isArray(data?.credit_notes) && (data?.credit_notes?.length ?? 0) > 0 && (
                <>
                  <SectionTitle icon={FileMinusIcon} color="text-violet-500" label="Credit Notes" />
                  <div className="space-y-1.5">
                    {data!.credit_notes!.map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 border border-violet-100 bg-violet-50/40 rounded-lg">
                        <span className="text-xs font-semibold text-gray-800">{row.number || row.name || '-'}</span>
                        <span className="text-sm font-bold text-violet-600">{fmtBaht(row.residual ?? row.amount_total)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Deposits */}
              {Array.isArray(data?.deposits) && (data?.deposits?.length ?? 0) > 0 && (
                <>
                  <SectionTitle icon={Wallet} color="text-teal-500" label="เงินมัดจำ" />
                  <div className="space-y-1.5">
                    {data!.deposits!.map((row, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 border border-teal-100 bg-teal-50/40 rounded-lg">
                        <span className="text-xs font-semibold text-gray-800">{row.name || '-'}</span>
                        <span className="text-sm font-bold text-teal-600">{fmtBaht(row.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Linked Slips */}
              {Array.isArray(data?.slips) && (data?.slips?.length ?? 0) > 0 && (
                <>
                  <SectionTitle icon={CheckCircle2} color="text-green-500" label="สลิปที่จับคู่แล้ว" />
                  <div className="space-y-1.5">
                    {data!.slips!.map((slip, i) => (
                      <div key={i} className="flex items-center justify-between px-3 py-2 border border-green-200 bg-green-50/40 rounded-lg">
                        <div>
                          <div className="text-xs font-semibold text-green-800">{slip.slip_inbox_name || slip.name || 'Slip'}</div>
                          <div className="text-[10px] text-green-600">{fmtDate(slip.transfer_date || slip.created_at)}</div>
                        </div>
                        <span className="text-sm font-bold text-green-700">{fmtBaht(slip.amount)}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Empty state */}
              {!isLoading && !bdo && !error && (
                <div className="text-center py-10 text-gray-400 text-sm">ไม่พบข้อมูล BDO นี้</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* PDF Viewer Modal */}
      <Dialog open={pdfOpen} onOpenChange={setPdfOpen}>
        <DialogContent className="max-w-3xl w-full h-[85vh] p-0 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
            <div className="flex items-center gap-2">
              <FileText className="h-4 w-4 text-blue-500" />
              <span className="text-sm font-semibold text-gray-800">
                Statement PDF — {bdoName || `BDO-${bdoId}`}
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              {pdfUrl && (
                <a href={pdfUrl} target="_blank" rel="noopener noreferrer">
                  <Button variant="ghost" size="sm" className="h-7 text-xs gap-1">
                    <ExternalLink className="h-3 w-3" /> เปิดแท็บใหม่
                  </Button>
                </a>
              )}
              <Button variant="ghost" size="sm" onClick={() => setPdfOpen(false)} className="h-7 w-7 p-0">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
          {pdfUrl ? (
            <iframe
              src={pdfUrl}
              className="w-full h-full border-0"
              title={`Statement PDF — ${bdoName}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              ไม่มีไฟล์ PDF
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
