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

const PROMPT_KEY_LABELS: Record<string, string> = {
  ghost_draft: 'ร่างคำตอบ (Ghost Draft)',
  summarizer: 'สรุปแชท',
  action_suggester: 'แนะนำ Action',
  order_parser: 'แปลงเป็นออเดอร์',
}

async function fetchPrompts(): Promise<PromptRow[]> {
  const res = await fetch('/api/admin/ai-prompts')
  if (!res.ok) throw new Error('Failed to load prompts: ' + res.status)
  const json = (await res.json()) as { data: PromptRow[] }
  return json.data
}

function pickActive(rows: PromptRow[], key: string): PromptRow | null {
  const matches = rows.filter((r) => r.key === key)
  const active = matches.find((r) => r.isActive)
  if (active) return active
  if (matches.length === 0) return null
  return matches.reduce((a, b) => (a.version > b.version ? a : b))
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

  // Edit dialog (creates a new version pre-filled from the current active body)
  const [editKey, setEditKey] = useState<string | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftModel, setDraftModel] = useState('gemini-flash-latest')

  // View dialog (read-only)
  const [viewRow, setViewRow] = useState<PromptRow | null>(null)

  const openEdit = (key: string) => {
    const current = pickActive(data ?? [], key)
    setDraftBody(current?.body ?? '')
    setDraftModel(current?.model ?? 'gemini-flash-latest')
    setEditKey(key)
  }

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
      setEditKey(null)
      setDraftBody('')
      setDraftModel('gemini-flash-latest')
    },
  })

  if (isLoading) return <div className="text-sm text-muted-foreground">กำลังโหลด prompts…</div>
  if (error) return <div className="text-sm text-red-600">โหลด prompts ล้มเหลว</div>

  const rows = data ?? []
  const sourceKey = editKey ?? ''
  const sourceActive = sourceKey ? pickActive(rows, sourceKey) : null

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
        <strong>วิธีใช้:</strong> กดปุ่ม <em>แก้ prompt</em> ของแต่ละ feature จะเปิดกล่องแก้ไข
        ที่โหลด prompt ปัจจุบันมาให้แล้ว — แก้แล้วกด <em>บันทึก version ใหม่</em> ระบบจะสร้าง version
        ถัดไปและปิด version เก่าให้อัตโนมัติ. กดปุ่ม <em>ดู</em> เพื่ออ่าน body ของแต่ละ version
        แบบไม่แก้ไข.
      </div>

      <div className="flex flex-wrap gap-2">
        {PROMPT_KEYS.map((k) => (
          <Button key={k} variant="outline" size="sm" onClick={() => openEdit(k)}>
            ✏️ แก้ prompt: {PROMPT_KEY_LABELS[k] ?? k}
          </Button>
        ))}
      </div>

      <Dialog open={editKey !== null} onOpenChange={(open) => !open && setEditKey(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              แก้ prompt — {PROMPT_KEY_LABELS[sourceKey] ?? sourceKey}
              {sourceActive ? (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  (กำลังแก้จาก version {sourceActive.version})
                </span>
              ) : null}
            </DialogTitle>
            <DialogDescription>
              บันทึกแล้วจะสร้าง version ใหม่และปิด version เก่าให้อัตโนมัติ.
              เนื้อหาด้านล่างถูก pre-fill จาก version ปัจจุบัน — แก้ส่วนที่ต้องการเปลี่ยนได้เลย.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={draftModel}
                onChange={(e) => setDraftModel(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="body">Prompt body</Label>
              <Textarea
                id="body"
                rows={14}
                value={draftBody}
                onChange={(e) => setDraftBody(e.target.value)}
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                {draftBody.length.toLocaleString()} chars
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setEditKey(null)}>
              ยกเลิก
            </Button>
            <Button
              onClick={() =>
                editKey &&
                createMutation.mutate({ key: editKey, body: draftBody, model: draftModel })
              }
              disabled={createMutation.isPending || draftBody.trim().length === 0}
            >
              {createMutation.isPending ? 'กำลังบันทึก…' : 'บันทึก version ใหม่'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={viewRow !== null} onOpenChange={(open) => !open && setViewRow(null)}>
        <DialogContent className="sm:max-w-[720px]">
          <DialogHeader>
            <DialogTitle>
              {viewRow?.key} — version {viewRow?.version}
            </DialogTitle>
            <DialogDescription>
              Model: <span className="font-mono">{viewRow?.model}</span> ·{' '}
              {viewRow?.isActive ? 'active' : 'inactive'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[400px] overflow-y-auto rounded-md border bg-muted/30 p-3">
            <pre className="whitespace-pre-wrap font-mono text-xs">{viewRow?.body}</pre>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewRow(null)}>
              ปิด
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Updated</TableHead>
            <TableHead>Body</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow key={row.id}>
              <TableCell className="font-mono text-xs">{row.key}</TableCell>
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
              <TableCell>
                <Button variant="ghost" size="sm" onClick={() => setViewRow(row)}>
                  ดู
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
