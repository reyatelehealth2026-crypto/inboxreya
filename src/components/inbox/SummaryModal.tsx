"use client"

import { useEffect, useState } from 'react'
import { Loader2 } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useAiSummary, type SummaryResult } from '@/hooks/use-ai-summary'

export interface SummaryModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: number | null
}

const WINDOW_OPTIONS: ReadonlyArray<50 | 100 | 200 | 500> = [50, 100, 200, 500]

export function SummaryModal({ open, onOpenChange, userId }: SummaryModalProps) {
  const [messageCount, setMessageCount] = useState<50 | 100 | 200 | 500>(100)
  const [result, setResult] = useState<SummaryResult | null>(null)
  const summary = useAiSummary()

  useEffect(() => {
    if (!open) {
      setResult(null)
      setMessageCount(100)
      summary.reset()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const runAnalysis = async () => {
    if (userId == null) return
    try {
      const data = await summary.mutateAsync({ userId, messageCount })
      setResult(data)
    } catch {
      // error state surfaced via summary.isError / summary.error
    }
  }

  const errorMessage =
    summary.error instanceof Error ? summary.error.message : 'เกิดข้อผิดพลาด'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle>📋 สรุปแชท</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <label className="text-sm font-medium mb-2 block">จำนวนข้อความล่าสุด</label>
            <div className="flex gap-2">
              {WINDOW_OPTIONS.map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setMessageCount(n)}
                  disabled={summary.isPending}
                  className={`px-3 py-1.5 rounded-md text-sm border transition-colors ${
                    messageCount === n
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-background hover:bg-muted border-input'
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>

          <Button
            onClick={runAnalysis}
            disabled={summary.isPending || userId == null}
            className="w-full"
          >
            {summary.isPending ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                กำลังประมวลผล…
              </>
            ) : (
              'วิเคราะห์'
            )}
          </Button>

          {summary.isError && !summary.isPending && (
            <div className="space-y-2">
              <div className="p-3 rounded-md bg-red-50 border border-red-200 text-red-700 text-sm">
                {errorMessage}
              </div>
              <Button variant="outline" onClick={runAnalysis} className="w-full">
                ลองอีกครั้ง
              </Button>
            </div>
          )}

          {result && !summary.isPending && !summary.isError && (
            <div className="space-y-2">
              {result.degraded.length > 0 && (
                <div className="p-2 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs">
                  บริบทบางส่วนไม่พร้อม: {result.degraded.join(', ')}
                </div>
              )}
              <div className="p-3 rounded-md border bg-muted/30 text-sm whitespace-pre-line max-h-[400px] overflow-y-auto">
                {result.summary}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ปิด
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
