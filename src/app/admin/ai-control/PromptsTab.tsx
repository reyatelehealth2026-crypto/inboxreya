'use client'

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'

interface PromptRow {
  id: number
  key: string
  version: number
  body: string
  model: string
  isActive: boolean
  updatedAt: string
}

const PROMPT_KEYS = ['ghost_draft', 'summarizer', 'action_suggester', 'order_parser'] as const
type PromptKey = (typeof PROMPT_KEYS)[number]

const PROMPT_LABELS: Record<PromptKey, string> = {
  ghost_draft: 'Ghost Draft',
  summarizer: 'สรุปแชท',
  action_suggester: 'แนะนำขั้นตอนถัดไป',
  order_parser: 'แปลงข้อความเป็นออเดอร์',
}

async function fetchPrompts(): Promise<PromptRow[]> {
  const res = await fetch('/api/admin/ai-prompts')
  if (!res.ok) throw new Error('Failed to load prompts: ' + res.status)
  const json = (await res.json()) as { data: PromptRow[] }
  return json.data
}

export function PromptsTab() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'ai-prompts'],
    queryFn: fetchPrompts,
  })

  const toggleMutation = useMutation({
    mutationFn: async (vars: { id: number; isActive: boolean }) => {
      const res = await fetch('/api/admin/ai-prompts/' + vars.id, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: vars.isActive }),
      })
      if (!res.ok) throw new Error('Toggle failed: ' + res.status)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ai-prompts'] }),
  })

  const [dialogKey, setDialogKey] = useState<PromptKey | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftModel, setDraftModel] = useState('gemini-flash-latest')

  const activePromptByKey = new Map(
    (data ?? []).filter((row) => row.isActive).map((row) => [row.key, row]),
  )

  const createMutation = useMutation({
    mutationFn: async (vars: { key: string; body: string; model: string }) => {
      const res = await fetch('/api/admin/ai-prompts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(vars),
      })
      if (!res.ok) throw new Error('Create failed: ' + res.status)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'ai-prompts'] })
      setDialogKey(null)
      setDraftBody('')
      setDraftModel('gemini-flash-latest')
    },
  })

  function openDialog(key: PromptKey) {
    const active = activePromptByKey.get(key)
    setDialogKey(key)
    setDraftBody(active?.body ?? '')
    setDraftModel(active?.model ?? 'gemini-flash-latest')
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">กำลังโหลดคำสั่ง AI...</div>
  if (error) return <div className="text-sm text-red-600">โหลดคำสั่ง AI ไม่สำเร็จ</div>

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        หน้านี้ใช้ตอนต้องการปรับคำสั่ง AI จริง ๆ ระบบจะคัดลอก prompt ปัจจุบันมาให้แก้ก่อน
        แล้วค่อยบันทึกเป็นเวอร์ชันใหม่
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_KEYS.map((key) => (
          <Dialog
            key={key}
            open={dialogKey === key}
            onOpenChange={(open) => {
              if (open) {
                openDialog(key)
              } else {
                setDialogKey(null)
              }
            }}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                แก้คำสั่ง: {PROMPT_LABELS[key]}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>แก้คำสั่ง AI: {PROMPT_LABELS[key]}</DialogTitle>
                <DialogDescription>
                  ระบบจะสร้างเวอร์ชันใหม่จากคำสั่งเดิม และสลับไปใช้เวอร์ชันล่าสุดเมื่อบันทึก
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor={`model-${key}`}>โมเดล</Label>
                  <Input
                    id={`model-${key}`}
                    value={draftModel}
                    onChange={(e) => setDraftModel(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor={`body-${key}`}>คำสั่งที่ AI ใช้</Label>
                  <Textarea
                    id={`body-${key}`}
                    rows={14}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    createMutation.mutate({ key, body: draftBody, model: draftModel })
                  }
                  disabled={createMutation.isPending || draftBody.trim().length === 0}
                >
                  {createMutation.isPending ? 'กำลังบันทึก...' : 'บันทึกเป็นเวอร์ชันใหม่'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>ฟีเจอร์</TableHead>
            <TableHead>เวอร์ชัน</TableHead>
            <TableHead>โมเดล</TableHead>
            <TableHead>กำลังใช้</TableHead>
            <TableHead>อัปเดตล่าสุด</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => {
            const key = row.key as PromptKey
            return (
              <TableRow key={row.id}>
                <TableCell>
                  <div className="font-medium">{PROMPT_LABELS[key] ?? row.key}</div>
                  <div className="font-mono text-xs text-muted-foreground">{row.key}</div>
                </TableCell>
                <TableCell>{row.version}</TableCell>
                <TableCell className="font-mono text-xs">{row.model}</TableCell>
                <TableCell>
                  <Switch
                    checked={row.isActive}
                    onCheckedChange={(v) =>
                      toggleMutation.mutate({ id: row.id, isActive: Boolean(v) })
                    }
                  />
                </TableCell>
                <TableCell className="text-xs text-muted-foreground">
                  {new Date(row.updatedAt).toLocaleString()}
                </TableCell>
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}
