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

  const [dialogKey, setDialogKey] = useState<string | null>(null)
  const [draftBody, setDraftBody] = useState('')
  const [draftModel, setDraftModel] = useState('gemini-flash-latest')

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

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading prompts…</div>
  if (error) return <div className="text-sm text-red-600">Failed to load prompts.</div>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {PROMPT_KEYS.map((k) => (
          <Dialog
            key={k}
            open={dialogKey === k}
            onOpenChange={(open) => setDialogKey(open ? k : null)}
          >
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                + New version: {k}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New prompt version — {k}</DialogTitle>
                <DialogDescription>
                  Creates a new active version and deactivates the previous one.
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
                    rows={10}
                    value={draftBody}
                    onChange={(e) => setDraftBody(e.target.value)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  onClick={() =>
                    createMutation.mutate({ key: k, body: draftBody, model: draftModel })
                  }
                  disabled={createMutation.isPending || draftBody.trim().length === 0}
                >
                  {createMutation.isPending ? 'Saving…' : 'Save version'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        ))}
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Key</TableHead>
            <TableHead>Version</TableHead>
            <TableHead>Model</TableHead>
            <TableHead>Active</TableHead>
            <TableHead>Updated</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {(data ?? []).map((row) => (
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
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
