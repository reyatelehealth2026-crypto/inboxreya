"use client"

import { useEffect, useState, type JSX } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, Trash2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  useAiParseOrder,
  type ParsedOrderItem,
} from '@/hooks/use-ai-parse-order'
import { useCreateOrder } from '@/hooks/use-create-order'

export interface OrderDraftModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | null
  messageId: number | null
  initialText: string
  onCreated?: (result: { orderId: number; orderNumber: string }) => void
}

interface DraftRow {
  sku: string
  name: string
  qty: number
  price: number
  confidence: number
}

function ConfidenceChip({ value }: { value: number }): JSX.Element {
  const pct = `${(value * 100).toFixed(0)}%`
  if (value >= 0.7) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700 border border-green-200">
        <CheckCircle2 className="h-3 w-3" />
        {pct}
      </span>
    )
  }
  if (value >= 0.4) {
    return (
      <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
        <AlertTriangle className="h-3 w-3" />
        {pct}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700 border border-red-200">
      <AlertTriangle className="h-3 w-3" />
      {pct}
    </span>
  )
}

export function OrderDraftModal({
  open,
  onOpenChange,
  userId,
  messageId,
  initialText,
  onCreated,
}: OrderDraftModalProps): JSX.Element {
  const [items, setItems] = useState<DraftRow[]>([])
  const [degraded, setDegraded] = useState<string[]>([])
  const [parseError, setParseError] = useState<string>('')
  const [success, setSuccess] = useState<{ orderId: number; orderNumber: string } | null>(null)
  const parseOrder = useAiParseOrder()
  const createOrder = useCreateOrder()

  useEffect(() => {
    if (!open) {
      setItems([])
      setDegraded([])
      setParseError('')
      setSuccess(null)
      parseOrder.reset()
      createOrder.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const runParse = async (): Promise<void> => {
    if (userId == null || !initialText) return
    setParseError('')
    setDegraded([])
    try {
      const data = await parseOrder.mutateAsync({
        userId,
        text: initialText,
        messageId: messageId ?? undefined,
      })
      setItems(
        data.items.map((it: ParsedOrderItem) => ({
          sku: it.sku,
          name: it.name,
          qty: it.qty,
          price: it.price,
          confidence: it.confidence,
        })),
      )
      setDegraded(data.degraded ?? [])
      setParseError(data.parseError ?? '')
    } catch {
      // surfaced via parseOrder.isError
    }
  }

  useEffect(() => {
    if (open && userId != null && initialText && !parseOrder.isPending && !parseOrder.isSuccess && !parseOrder.isError) {
      void runParse()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, userId, initialText])

  const updateRow = (idx: number, patch: Partial<DraftRow>): void => {
    setItems((prev) => prev.map((row, i) => (i === idx ? { ...row, ...patch } : row)))
  }

  const removeRow = (idx: number): void => {
    setItems((prev) => prev.filter((_, i) => i !== idx))
  }

  const addRow = (): void => {
    setItems((prev) => [...prev, { sku: '', name: '', qty: 1, price: 0, confidence: 1 }])
  }

  const hasInvalidRow = items.some(
    (r) => r.qty < 1 || !Number.isInteger(r.qty) || !r.sku.trim() || !r.name.trim(),
  )
  const canConfirm = items.length > 0 && !hasInvalidRow && !createOrder.isPending

  const handleConfirm = async (): Promise<void> => {
    if (userId == null || !canConfirm) return
    try {
      const result = await createOrder.mutateAsync({
        userId,
        items: items.map((r) => ({ sku: r.sku, name: r.name, qty: r.qty, price: r.price })),
      })
      setSuccess(result)
      onCreated?.(result)
      onOpenChange(false)
    } catch {
      // surfaced via createOrder.isError
    }
  }

  const parseErrorMessage =
    parseOrder.error instanceof Error ? parseOrder.error.message : 'เกิดข้อผิดพลาด'
  const createErrorMessage =
    createOrder.error instanceof Error ? createOrder.error.message : 'เกิดข้อผิดพลาด'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-[800px]">
        <DialogHeader>
          <DialogTitle>📦 แปลงเป็นออเดอร์</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {parseOrder.isPending && (
            <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              AI กำลังจับคู่สินค้า…
            </div>
          )}

          {parseOrder.isError && !parseOrder.isPending && (
            <div className="space-y-2">
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                {parseErrorMessage}
              </div>
              <Button variant="outline" onClick={runParse} className="w-full">
                ลองอีกครั้ง
              </Button>
            </div>
          )}

          {!parseOrder.isPending && !parseOrder.isError && parseOrder.isSuccess && (
            <div className="space-y-3">
              {degraded.length > 0 && (
                <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  บริบทบางส่วนไม่พร้อม: {degraded.join(', ')}
                </div>
              )}
              {parseError && (
                <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  {parseError}
                </div>
              )}

              <div className="overflow-x-auto border rounded-md">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr className="text-left">
                      <th className="px-2 py-2 font-medium">SKU</th>
                      <th className="px-2 py-2 font-medium">ชื่อสินค้า</th>
                      <th className="px-2 py-2 font-medium w-20">จำนวน</th>
                      <th className="px-2 py-2 font-medium w-24">ราคา</th>
                      <th className="px-2 py-2 font-medium w-24">ความมั่นใจ</th>
                      <th className="px-2 py-2 font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-2 py-4 text-center text-muted-foreground text-xs">
                          ไม่มีรายการ
                        </td>
                      </tr>
                    )}
                    {items.map((row, idx) => (
                      <tr key={idx} className="border-t">
                        <td className="px-2 py-1.5 font-mono text-xs">{row.sku || '-'}</td>
                        <td className="px-2 py-1.5">
                          <input
                            type="text"
                            value={row.name}
                            onChange={(e) => updateRow(idx, { name: e.target.value })}
                            className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={1}
                            step={1}
                            value={row.qty}
                            onChange={(e) =>
                              updateRow(idx, { qty: Math.max(1, parseInt(e.target.value, 10) || 1) })
                            }
                            className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <input
                            type="number"
                            min={0}
                            step={0.01}
                            value={row.price}
                            onChange={(e) =>
                              updateRow(idx, { price: Math.max(0, parseFloat(e.target.value) || 0) })
                            }
                            className="w-full rounded border border-input bg-background px-2 py-1 text-sm"
                          />
                        </td>
                        <td className="px-2 py-1.5">
                          <ConfidenceChip value={row.confidence} />
                        </td>
                        <td className="px-2 py-1.5">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeRow(idx)}
                            aria-label="ลบ"
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Button variant="outline" size="sm" onClick={addRow}>
                + เพิ่มแถว
              </Button>

              {createOrder.isError && !createOrder.isPending && (
                <div className="space-y-2">
                  <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                    {createErrorMessage}
                  </div>
                  <Button variant="outline" onClick={handleConfirm} className="w-full">
                    ลองอีกครั้ง
                  </Button>
                </div>
              )}

              {success && (
                <div className="p-3 rounded-md bg-green-50 border border-green-200 text-green-700 text-sm">
                  ✅ สร้างออเดอร์ {success.orderNumber} เรียบร้อย
                </div>
              )}

              <Button
                onClick={handleConfirm}
                disabled={!canConfirm}
                className="w-full"
              >
                {createOrder.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    กำลังสร้างออเดอร์…
                  </>
                ) : (
                  'ยืนยันสร้างออเดอร์'
                )}
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ยกเลิก
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
