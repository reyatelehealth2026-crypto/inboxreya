'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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

interface FlagRow {
  id: number
  key: string
  enabled: boolean
  enabledForRoles: string | null
  enabledForUserIds: string | null
  updatedAt: string
}

interface FlagDraft {
  enabled: boolean
  enabledForRoles: string
  enabledForUserIds: string
}

async function fetchFlags(): Promise<FlagRow[]> {
  const res = await fetch('/api/admin/feature-flags')
  if (!res.ok) throw new Error('Failed to load flags: ' + res.status)
  const json = (await res.json()) as { data: FlagRow[] }
  return json.data
}

export function FlagsTab() {
  const qc = useQueryClient()
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'feature-flags'],
    queryFn: fetchFlags,
  })

  const [drafts, setDrafts] = useState<Record<string, FlagDraft>>({})

  useEffect(() => {
    if (!data) return
    setDrafts((prev) => {
      const next: Record<string, FlagDraft> = { ...prev }
      for (const row of data) {
        if (!next[row.key]) {
          next[row.key] = {
            enabled: row.enabled,
            enabledForRoles: row.enabledForRoles ?? '',
            enabledForUserIds: row.enabledForUserIds ?? '',
          }
        }
      }
      return next
    })
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async (vars: { key: string; draft: FlagDraft }) => {
      const res = await fetch('/api/admin/feature-flags/' + encodeURIComponent(vars.key), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled: vars.draft.enabled,
          enabledForRoles: vars.draft.enabledForRoles || null,
          enabledForUserIds: vars.draft.enabledForUserIds || null,
        }),
      })
      if (!res.ok) throw new Error('Save failed: ' + res.status)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'feature-flags'] }),
  })

  function updateDraft(key: string, patch: Partial<FlagDraft>) {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...(prev[key] ?? { enabled: false, enabledForRoles: '', enabledForUserIds: '' }), ...patch },
    }))
  }

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading flags…</div>
  if (error) return <div className="text-sm text-red-600">Failed to load feature flags.</div>

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Key</TableHead>
          <TableHead>Enabled</TableHead>
          <TableHead>Roles (csv)</TableHead>
          <TableHead>User IDs (csv)</TableHead>
          <TableHead>Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {(data ?? []).map((row) => {
          const draft =
            drafts[row.key] ?? {
              enabled: row.enabled,
              enabledForRoles: row.enabledForRoles ?? '',
              enabledForUserIds: row.enabledForUserIds ?? '',
            }
          return (
            <TableRow key={row.key}>
              <TableCell className="font-mono text-xs">{row.key}</TableCell>
              <TableCell>
                <Switch
                  checked={draft.enabled}
                  onCheckedChange={(v) => updateDraft(row.key, { enabled: Boolean(v) })}
                />
              </TableCell>
              <TableCell>
                <Input
                  value={draft.enabledForRoles}
                  placeholder="admin,super_admin"
                  onChange={(e) => updateDraft(row.key, { enabledForRoles: e.target.value })}
                />
              </TableCell>
              <TableCell>
                <Textarea
                  rows={2}
                  value={draft.enabledForUserIds}
                  placeholder="1,2,3"
                  onChange={(e) => updateDraft(row.key, { enabledForUserIds: e.target.value })}
                />
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {new Date(row.updatedAt).toLocaleString()}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  size="sm"
                  onClick={() => saveMutation.mutate({ key: row.key, draft })}
                  disabled={saveMutation.isPending}
                >
                  Save
                </Button>
              </TableCell>
            </TableRow>
          )
        })}
      </TableBody>
    </Table>
  )
}
