'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Ban, Loader2, Pause, Play, Send, Square } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

interface QueueItem {
  id: number
  order_id: number
  order_name: string | null
  chase_round: number
  user_id: number
  salesperson_name: string | null
  customer_name: string | null
  order_date: string
  amount: string | number
  message: string
}

interface RunProgress {
  id: number
  status: 'running' | 'paused' | 'stopped' | 'done'
  total: number
  sent: number
  failed: number
  remaining: number
}

const ALL_SALESPEOPLE = '__all__'

const STATUS_LABEL: Record<RunProgress['status'], string> = {
  running: 'กำลังยิง',
  paused: 'พักอยู่',
  stopped: 'หยุดแล้ว',
  done: 'เสร็จสิ้น',
}

const baht = (value: string | number) =>
  Number(value).toLocaleString('th-TH', { maximumFractionDigits: 0 })

export function PaymentChaseQueue() {
  const [items, setItems] = useState<QueueItem[]>([])
  const [salespeople, setSalespeople] = useState<{ name: string; n: number }[]>([])
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [expanded, setExpanded] = useState<number | null>(null)
  const [run, setRun] = useState<RunProgress | null>(null)

  const [salesperson, setSalesperson] = useState(ALL_SALESPEOPLE)
  const [minAmount, setMinAmount] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const query = new URLSearchParams()
    if (salesperson !== ALL_SALESPEOPLE) query.set('salesperson', salesperson)
    if (minAmount) query.set('minAmount', minAmount)

    try {
      const response = await fetch(`/api/inbox/payment-chase?${query}`)
      const data = await response.json()
      if (data.success) {
        setItems(data.items)
        setSalespeople(data.salespeople ?? [])
        // Everything is ticked by default — the rep unticks the exceptions,
        // which is the far shorter list.
        setSelected(new Set<number>(data.items.map((item: QueueItem) => item.id)))
      }
    } finally {
      setLoading(false)
    }
  }, [salesperson, minAmount])

  useEffect(() => {
    load()
  }, [load])

  // Poll while a run is live so the bar keeps moving without a refresh.
  useEffect(() => {
    if (!run || run.status === 'done' || run.status === 'stopped') return
    const timer = setInterval(async () => {
      const response = await fetch(`/api/inbox/payment-chase/runs/${run.id}`)
      const data = await response.json()
      if (data.success) setRun(data.run)
    }, 3000)
    return () => clearInterval(timer)
  }, [run])

  const selectedTotal = useMemo(
    () =>
      items
        .filter((item) => selected.has(item.id))
        .reduce((sum, item) => sum + Number(item.amount), 0),
    [items, selected]
  )

  const toggle = (id: number) => {
    setSelected((previous) => {
      const next = new Set(previous)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const approve = async () => {
    setSubmitting(true)
    try {
      const response = await fetch('/api/inbox/payment-chase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ queueIds: [...selected] }),
      })
      const data = await response.json()
      if (data.success) {
        setRun({
          id: data.runId,
          status: 'running',
          total: data.queued,
          sent: 0,
          failed: 0,
          remaining: data.queued,
        })
        await load()
      } else {
        alert(data.error ?? 'ส่งไม่สำเร็จ')
      }
    } finally {
      setSubmitting(false)
    }
  }

  const control = async (action: 'pause' | 'resume' | 'stop') => {
    if (!run) return
    const response = await fetch(`/api/inbox/payment-chase/runs/${run.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    const data = await response.json()
    if (data.success) {
      setRun({ ...run, status: data.status })
      if (action === 'stop') await load()
    } else {
      alert(data.error)
    }
  }

  const exclude = async (item: QueueItem) => {
    const reason = prompt(`ไม่ต้องตามยอด "${item.customer_name ?? item.user_id}" อีก\nเหตุผล:`)
    if (reason === null) return
    await fetch('/api/inbox/payment-chase/exclusions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: item.user_id, reason }),
    })
    await load()
  }

  const done = run ? run.sent + run.failed : 0
  const percent = run?.total ? Math.round((done / run.total) * 100) : 0

  return (
    // Matches SlipReportClient: /inbox/layout.tsx supplies the sidebar and the
    // scroll container, so the page owns only its own width and padding.
    <div className="mx-auto w-full max-w-6xl space-y-4 p-4">
      <div>
        <h1 className="text-lg font-semibold text-gray-800">ติดตามยอดชำระ</h1>
        <p className="text-xs text-gray-500">
          บิลที่ยังไม่ชำระ ค้าง 2 / 4 / 7 วัน — ติ๊กเลือกแล้วส่งทีเดียว
        </p>
      </div>

      {run && (
        <Card className="space-y-3 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              {run.status === 'running' && <Loader2 className="h-4 w-4 animate-spin" />}
              <span>
                กำลังส่ง {done} / {run.total}
              </span>
              {run.failed > 0 && <Badge variant="destructive">ล้มเหลว {run.failed}</Badge>}
              <Badge variant={run.status === 'running' ? 'default' : 'secondary'}>
                {STATUS_LABEL[run.status]}
              </Badge>
            </div>

            <div className="flex gap-2">
              {run.status === 'running' && (
                <Button size="sm" variant="outline" onClick={() => control('pause')}>
                  <Pause className="mr-1 h-4 w-4" /> พัก
                </Button>
              )}
              {run.status === 'paused' && (
                <Button size="sm" variant="outline" onClick={() => control('resume')}>
                  <Play className="mr-1 h-4 w-4" /> ไปต่อ
                </Button>
              )}
              {(run.status === 'running' || run.status === 'paused') && (
                <Button size="sm" variant="destructive" onClick={() => control('stop')}>
                  <Square className="mr-1 h-4 w-4" /> หยุด
                </Button>
              )}
            </div>
          </div>

          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-primary transition-all duration-500"
              style={{ width: `${percent}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            ทยอยส่งทีละข้อความเพื่อไม่ให้ชน rate limit ของ LINE — กดพักได้ตลอด
            ข้อความที่ยังไม่ถูกส่งจะกลับเข้าคิวเมื่อกดหยุด
          </p>
        </Card>
      )}

      <Card className="flex flex-wrap items-end gap-3 p-4">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">เซล</label>
          <Select value={salesperson} onValueChange={setSalesperson}>
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL_SALESPEOPLE}>ทุกคน</SelectItem>
              {salespeople.map((person) => (
                <SelectItem key={person.name} value={person.name}>
                  {person.name} ({person.n})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground">ยอดขั้นต่ำ</label>
          <Input
            className="w-32"
            inputMode="numeric"
            placeholder="0"
            value={minAmount}
            onChange={(event) => setMinAmount(event.target.value.replace(/\D/g, ''))}
          />
        </div>

        <div className="ml-auto flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setSelected(new Set(items.map((item) => item.id)))}
          >
            ติ๊กทั้งหมด
          </Button>
          <Button variant="outline" size="sm" onClick={() => setSelected(new Set())}>
            ล้างทั้งหมด
          </Button>
        </div>
      </Card>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          เลือก {selected.size} / {items.length} รายการ · รวม {baht(selectedTotal)} บาท
        </p>
        <Button
          disabled={selected.size === 0 || submitting || run?.status === 'running'}
          onClick={approve}
        >
          {submitting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          ส่งที่เลือก ({selected.size})
        </Button>
      </div>

      {loading ? (
        <p className="py-12 text-center text-sm text-muted-foreground">กำลังโหลด...</p>
      ) : items.length === 0 ? (
        <p className="py-12 text-center text-sm text-muted-foreground">
          ไม่มีบิลที่ต้องตามยอดวันนี้
        </p>
      ) : (
        <Card className="divide-y">
          {items.map((item) => (
            <div key={item.id} className="p-3">
              <div className="flex items-start gap-3">
                <Checkbox
                  className="mt-1"
                  checked={selected.has(item.id)}
                  onCheckedChange={() => toggle(item.id)}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-medium">
                      {item.customer_name ?? `#${item.user_id}`}
                    </span>
                    <Badge variant="outline">ค้าง {item.chase_round} วัน</Badge>
                    <span className="font-semibold">{baht(item.amount)} บาท</span>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {item.salesperson_name ?? 'ไม่ระบุเซล'} · บิล{' '}
                    {new Date(item.order_date).toLocaleDateString('th-TH')}
                  </p>

                  {expanded === item.id && (
                    <Textarea
                      className="mt-2 text-sm"
                      rows={10}
                      value={item.message}
                      onChange={(event) =>
                        setItems((previous) =>
                          previous.map((row) =>
                            row.id === item.id ? { ...row, message: event.target.value } : row
                          )
                        )
                      }
                    />
                  )}
                </div>

                <div className="flex shrink-0 gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setExpanded(expanded === item.id ? null : item.id)}
                  >
                    {expanded === item.id ? 'ปิด' : 'ดูข้อความ'}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    title="ไม่ต้องตามลูกค้ารายนี้อีก"
                    onClick={() => exclude(item)}
                  >
                    <Ban className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  )
}
