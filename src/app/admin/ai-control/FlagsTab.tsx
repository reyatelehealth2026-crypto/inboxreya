'use client'

import { useEffect, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

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

const FLAG_META: Record<
  string,
  {
    title: string
    description: string
  }
> = {
  ai_draft: {
    title: 'Ghost Draft',
    description: 'ร่างข้อความตอบกลับให้แอดมินแก้ก่อนส่ง',
  },
  ai_summarizer: {
    title: 'สรุปแชท',
    description: 'สรุปประเด็นสำคัญจากบทสนทนาล่าสุด',
  },
  ai_action_suggester: {
    title: 'แนะนำขั้นตอนถัดไป',
    description: 'เสนอว่าควรตอบ, ตามงาน, เช็กออเดอร์ หรือส่งต่อ',
  },
  ai_order_parser: {
    title: 'แปลงข้อความเป็นออเดอร์',
    description: 'อ่านข้อความลูกค้าแล้วแตกเป็นรายการสินค้าเบื้องต้น',
  },
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
    <div className="space-y-4">
      <div className="rounded-md border bg-muted/20 p-4 text-sm text-muted-foreground">
        หน้านี้ใช้เปิดหรือปิดฟีเจอร์ AI ที่ผู้ใช้มองเห็นจริง ถ้าไม่แน่ใจ ให้เปิดเฉพาะฟีเจอร์ที่ต้องใช้ก่อน
        แล้วปล่อยช่อง `User IDs` ว่างไว้
      </div>

      <div className="grid gap-4">
        {(data ?? []).map((row) => {
          const draft =
            drafts[row.key] ?? {
              enabled: row.enabled,
              enabledForRoles: row.enabledForRoles ?? '',
              enabledForUserIds: row.enabledForUserIds ?? '',
            }
          const meta = FLAG_META[row.key] ?? {
            title: row.key,
            description: 'ฟีเจอร์ AI',
          }

          return (
            <section key={row.key} className="rounded-lg border bg-card p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="text-base font-semibold">{meta.title}</h3>
                    <span className="rounded border px-2 py-0.5 font-mono text-[11px] text-muted-foreground">
                      {row.key}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">{meta.description}</p>
                  <p className="text-xs text-muted-foreground">
                    อัปเดตล่าสุด {new Date(row.updatedAt).toLocaleString()}
                  </p>
                </div>

                <div className="flex items-center gap-3 rounded-md border px-3 py-2">
                  <Switch
                    checked={draft.enabled}
                    onCheckedChange={(v) => updateDraft(row.key, { enabled: Boolean(v) })}
                  />
                  <div className="text-sm">
                    <div className="font-medium">{draft.enabled ? 'เปิดใช้งาน' : 'ปิดอยู่'}</div>
                    <div className="text-xs text-muted-foreground">บันทึกหลังเปลี่ยนค่า</div>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_1fr_auto]">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium">สิทธิ์ตาม role</span>
                  <Input
                    value={draft.enabledForRoles}
                    placeholder="admin,super_admin"
                    onChange={(e) => updateDraft(row.key, { enabledForRoles: e.target.value })}
                  />
                  <span className="block text-xs text-muted-foreground">
                    ถ้าเว้นว่าง เมื่อเปิด toggle จะใช้ได้ทุก role
                  </span>
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium">เปิดเฉพาะ admin ID</span>
                  <Textarea
                    rows={2}
                    value={draft.enabledForUserIds}
                    placeholder="1,2,3"
                    onChange={(e) => updateDraft(row.key, { enabledForUserIds: e.target.value })}
                  />
                  <span className="block text-xs text-muted-foreground">
                    ใช้สำหรับเปิดให้เฉพาะคนทดลอง แม้ toggle หลักยังปิดอยู่
                  </span>
                </label>

                <div className="flex items-end">
                  <Button
                    onClick={() => saveMutation.mutate({ key: row.key, draft })}
                    disabled={saveMutation.isPending}
                  >
                    บันทึก
                  </Button>
                </div>
              </div>
            </section>
          )
        })}
      </div>
    </div>
  )
}
