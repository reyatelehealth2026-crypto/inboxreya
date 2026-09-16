'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Gift, Loader2, Pencil, Plus, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'

/**
 * Next.js twin of the PHP /membership "รางวัลแลกแต้ม" tab. Same tables, same
 * rules — the PHP page keeps working alongside this one.
 */

interface Reward {
  id: number
  name: string
  description: string | null
  image_url: string | null
  points_required: number
  reward_type: RewardType | null
  reward_value: string | number | null
  stock: number
  max_per_user: number
  is_active: boolean
  terms: string | null
  start_date: string | null
  end_date: string | null
  redeemed: number
}

interface Redemption {
  id: number
  user_id: number
  points_used: number
  status: 'pending' | 'approved' | 'delivered' | 'cancelled' | 'expired'
  redemption_code: string | null
  notes: string | null
  created_at: string
  reward_name: string
  reward_image: string | null
  display_name: string | null
  picture_url: string | null
}

interface Summary {
  total_issued: number
  total_redeemed: number
  active_rewards: number
  pending_redemptions: number
}

type RewardType = 'discount' | 'product' | 'voucher' | 'shipping'

const TYPE_LABEL: Record<RewardType, string> = {
  discount: 'ส่วนลด',
  product: 'สินค้า',
  voucher: 'บัตรกำนัล',
  shipping: 'ค่าส่งฟรี',
}

const STATUS_LABEL: Record<Redemption['status'], string> = {
  pending: 'รอดำเนินการ',
  approved: 'อนุมัติแล้ว',
  delivered: 'ส่งมอบแล้ว',
  cancelled: 'ยกเลิก',
  expired: 'หมดอายุ',
}

const STATUS_CLASS: Record<Redemption['status'], string> = {
  pending: 'bg-orange-100 text-orange-700',
  approved: 'bg-green-100 text-green-700',
  delivered: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-red-100 text-red-700',
  expired: 'bg-gray-100 text-gray-600',
}

const STATUS_FILTERS: Array<{ value: string; label: string }> = [
  { value: '', label: 'ทั้งหมด' },
  { value: 'pending', label: 'รอดำเนินการ' },
  { value: 'approved', label: 'อนุมัติแล้ว' },
  { value: 'delivered', label: 'ส่งมอบแล้ว' },
  { value: 'cancelled', label: 'ยกเลิก' },
]

// Same confirmation copy as the PHP Swal dialogs.
const CONFIRM = {
  approve: 'อนุมัติการแลกรางวัล?\nระบบจะส่งแจ้งเตือนไปยังผู้ใช้',
  deliver: 'ยืนยันการส่งมอบ?\nบันทึกว่าได้ส่งมอบรางวัลแล้ว',
  cancel: 'ยกเลิกการแลกรางวัล?\nแต้มจะถูกคืนให้ผู้ใช้',
}

type SortKey = 'points_asc' | 'points_desc' | 'stock_asc' | 'stock_desc'

const SORT_LABEL: Record<SortKey, string> = {
  points_asc: 'แต้มน้อย → มาก',
  points_desc: 'แต้มมาก → น้อย',
  stock_asc: 'เหลือน้อย → มาก',
  stock_desc: 'เหลือมาก → น้อย',
}

// Unlimited stock (-1) sorts as "most left", never as "running out".
const stockOf = (r: Reward) => (r.stock < 0 ? Number.POSITIVE_INFINITY : r.stock)

const SORT_FN: Record<SortKey, (a: Reward, b: Reward) => number> = {
  points_asc: (a, b) => a.points_required - b.points_required,
  points_desc: (a, b) => b.points_required - a.points_required,
  stock_asc: (a, b) => stockOf(a) - stockOf(b) || 0,
  stock_desc: (a, b) => stockOf(b) - stockOf(a) || 0,
}

const emptyForm = {
  name: '',
  description: '',
  points_required: '',
  reward_type: 'product' as RewardType,
  reward_value: '',
  stock: '-1',
  max_per_user: '0',
  is_active: true,
  image_url: '',
  terms: '',
  start_date: '',
  end_date: '',
}
type RewardForm = typeof emptyForm

const dateInput = (s: string | null) => (s ? s.slice(0, 10) : '')
const fmtDate = (s: string) => new Date(s).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'short' })

export function RewardsAdmin() {
  const { toast } = useToast()
  const [rewards, setRewards] = useState<Reward[]>([])
  const [redemptions, setRedemptions] = useState<Redemption[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<number | null>(null)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<Reward | null>(null)
  const [form, setForm] = useState<RewardForm>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [search, setSearch] = useState('')
  const [sort, setSort] = useState<SortKey>('points_asc')
  const [showInactive, setShowInactive] = useState(false)

  const visibleRewards = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rewards
      .filter((r) => showInactive || r.is_active)
      .filter((r) => !q || r.name.toLowerCase().includes(q))
      .sort(SORT_FN[sort])
  }, [rewards, search, sort, showInactive])

  const loadRewards = useCallback(async () => {
    const res = await fetch('/api/inbox/rewards')
    const data = await res.json()
    if (data.success) setRewards(data.rewards)
  }, [])

  const loadRedemptions = useCallback(async () => {
    const query = statusFilter ? `?status=${statusFilter}` : ''
    const res = await fetch(`/api/inbox/redemptions${query}`)
    const data = await res.json()
    if (data.success) {
      setRedemptions(data.redemptions)
      setSummary(data.summary)
    }
  }, [statusFilter])

  useEffect(() => {
    setLoading(true)
    Promise.all([loadRewards(), loadRedemptions()])
      .catch(() => toast({ title: 'โหลดข้อมูลไม่สำเร็จ', variant: 'destructive' }))
      .finally(() => setLoading(false))
  }, [loadRewards, loadRedemptions, toast])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setDialogOpen(true)
  }

  const openEdit = (r: Reward) => {
    setEditing(r)
    setForm({
      name: r.name,
      description: r.description ?? '',
      points_required: String(r.points_required),
      reward_type: r.reward_type ?? 'product',
      reward_value: r.reward_value === null ? '' : String(r.reward_value),
      stock: String(r.stock),
      max_per_user: String(r.max_per_user),
      is_active: r.is_active,
      image_url: r.image_url ?? '',
      terms: r.terms ?? '',
      start_date: dateInput(r.start_date),
      end_date: dateInput(r.end_date),
    })
    setDialogOpen(true)
  }

  const saveReward = async () => {
    setSaving(true)
    const body = {
      name: form.name,
      description: form.description || null,
      points_required: Number(form.points_required),
      reward_type: form.reward_type,
      reward_value: form.reward_value === '' ? null : Number(form.reward_value),
      stock: form.stock === '' ? -1 : Number(form.stock),
      max_per_user: Number(form.max_per_user || 0),
      is_active: form.is_active,
      image_url: form.image_url || null,
      terms: form.terms || null,
      start_date: form.start_date || null,
      end_date: form.end_date || null,
    }
    try {
      const res = await fetch(editing ? `/api/inbox/rewards/${editing.id}` : '/api/inbox/rewards', {
        method: editing ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!data.success) throw new Error(data.error)
      toast({ title: data.message })
      setDialogOpen(false)
      await Promise.all([loadRewards(), loadRedemptions()])
    } catch (e) {
      toast({ title: e instanceof Error ? e.message : 'บันทึกไม่สำเร็จ', variant: 'destructive' })
    } finally {
      setSaving(false)
    }
  }

  const toggleReward = async (r: Reward) => {
    setBusy(r.id)
    const res = await fetch(`/api/inbox/rewards/${r.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_active: !r.is_active }),
    })
    const data = await res.json()
    if (!data.success) toast({ title: data.error ?? 'อัปเดตไม่สำเร็จ', variant: 'destructive' })
    await loadRewards()
    setBusy(null)
  }

  const removeReward = async (r: Reward) => {
    if (!window.confirm(`ลบรางวัล "${r.name}"?`)) return
    setBusy(r.id)
    const res = await fetch(`/api/inbox/rewards/${r.id}`, { method: 'DELETE' })
    const data = await res.json()
    toast({ title: data.message ?? data.error, variant: data.success ? undefined : 'destructive' })
    await Promise.all([loadRewards(), loadRedemptions()])
    setBusy(null)
  }

  const act = async (rd: Redemption, action: keyof typeof CONFIRM) => {
    if (!window.confirm(CONFIRM[action])) return
    setBusy(rd.id)
    try {
      const res = await fetch(`/api/inbox/redemptions/${rd.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      toast({ title: data.message ?? data.error, variant: data.success ? undefined : 'destructive' })
      await Promise.all([loadRedemptions(), loadRewards()])
    } finally {
      setBusy(null)
    }
  }

  const field = (key: keyof RewardForm) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }))

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Gift className="h-6 w-6 text-purple-600" /> รางวัลแลกแต้ม
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          เพิ่ม/แก้ของรางวัล และอนุมัติคำขอแลก — ข้อมูลชุดเดียวกับหน้า membership เดิม
        </p>
      </div>

      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Stat label="แต้มที่แจกไปทั้งหมด" value={summary.total_issued} />
          <Stat label="แต้มที่ถูกแลกไป" value={summary.total_redeemed} />
          <Stat label="รางวัลที่เปิดใช้" value={summary.active_rewards} />
          <Stat label="รอดำเนินการ" value={summary.pending_redemptions} highlight={summary.pending_redemptions > 0} />
        </div>
      )}

      {loading ? (
        <div className="flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> กำลังโหลด…</div>
      ) : (
        <Tabs defaultValue={summary?.pending_redemptions ? 'redemptions' : 'rewards'}>
          <TabsList>
            <TabsTrigger value="rewards">รางวัล ({visibleRewards.length}/{rewards.length})</TabsTrigger>
            <TabsTrigger value="redemptions">คำขอแลก{summary?.pending_redemptions ? ` (${summary.pending_redemptions} รอ)` : ''}</TabsTrigger>
          </TabsList>

          <TabsContent value="rewards" className="space-y-4">
            <div className="flex flex-wrap items-center gap-3">
              <Input
                placeholder="ค้นหาชื่อรางวัล…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-56"
              />
              <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
                <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(Object.keys(SORT_LABEL) as SortKey[]).map((k) => (
                    <SelectItem key={k} value={k}>{SORT_LABEL[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <Checkbox checked={showInactive} onCheckedChange={(v) => setShowInactive(v === true)} />
                แสดงที่ปิดใช้งาน
              </label>
              <Button className="ml-auto" onClick={openCreate}><Plus className="h-4 w-4 mr-1" /> เพิ่มรางวัล</Button>
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">รางวัล</th>
                    <th className="p-3 text-right">แต้ม</th>
                    <th className="p-3 text-right">สต็อก</th>
                    <th className="p-3 text-right">แลกแล้ว</th>
                    <th className="p-3">ช่วงเวลา</th>
                    <th className="p-3 text-center">เปิดใช้</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {visibleRewards.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">
                      {rewards.length === 0 ? 'ยังไม่มีรางวัล' : 'ไม่มีรางวัลที่ตรงตัวกรอง'}
                    </td></tr>
                  )}
                  {visibleRewards.map((r) => (
                    <tr key={r.id} className={`border-t ${r.is_active ? '' : 'opacity-60'}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-3">
                          {r.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={r.image_url} alt="" className="h-10 w-10 rounded object-cover" />
                          ) : (
                            <div className="h-10 w-10 rounded bg-muted flex items-center justify-center"><Gift className="h-4 w-4" /></div>
                          )}
                          <div>
                            <div className="font-medium">{r.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {TYPE_LABEL[r.reward_type ?? 'product']}
                              {r.reward_value !== null && ` · ${Number(r.reward_value).toLocaleString('th-TH')}`}
                              {r.max_per_user > 0 && ` · สูงสุด ${r.max_per_user}/คน`}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-3 text-right font-semibold">{r.points_required.toLocaleString('th-TH')}</td>
                      <td className="p-3 text-right">{r.stock < 0 ? 'ไม่จำกัด' : r.stock}</td>
                      <td className="p-3 text-right">{r.redeemed}</td>
                      <td className="p-3 text-xs text-muted-foreground">
                        {r.start_date || r.end_date ? `${dateInput(r.start_date) || '…'} → ${dateInput(r.end_date) || '…'}` : '—'}
                      </td>
                      <td className="p-3 text-center">
                        <Switch checked={r.is_active} disabled={busy === r.id} onCheckedChange={() => toggleReward(r)} />
                      </td>
                      <td className="p-3 text-right whitespace-nowrap">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(r)}><Pencil className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="sm" disabled={busy === r.id} onClick={() => removeReward(r)}>
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>

          <TabsContent value="redemptions" className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {STATUS_FILTERS.map((f) => (
                <Button
                  key={f.value}
                  size="sm"
                  variant={statusFilter === f.value ? 'default' : 'outline'}
                  onClick={() => setStatusFilter(f.value)}
                >
                  {f.label}
                </Button>
              ))}
            </div>
            <Card className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <th className="p-3">ลูกค้า</th>
                    <th className="p-3">รางวัล</th>
                    <th className="p-3">รหัส</th>
                    <th className="p-3 text-right">แต้ม</th>
                    <th className="p-3">สถานะ</th>
                    <th className="p-3">วันที่</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {redemptions.length === 0 && (
                    <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">ไม่มีรายการ</td></tr>
                  )}
                  {redemptions.map((rd) => (
                    <tr key={rd.id} className={`border-t ${rd.status === 'pending' ? 'bg-orange-50' : ''}`}>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          {rd.picture_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={rd.picture_url} alt="" className="h-8 w-8 rounded-full object-cover" />
                          ) : (
                            <div className="h-8 w-8 rounded-full bg-muted" />
                          )}
                          <div>
                            <div className="font-medium">{rd.display_name ?? `#${rd.user_id}`}</div>
                            {rd.notes && <div className="text-xs text-muted-foreground">{rd.notes}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="p-3">{rd.reward_name}</td>
                      <td className="p-3 font-mono text-xs">{rd.redemption_code ?? '—'}</td>
                      <td className="p-3 text-right">{rd.points_used.toLocaleString('th-TH')}</td>
                      <td className="p-3"><Badge className={STATUS_CLASS[rd.status]}>{STATUS_LABEL[rd.status]}</Badge></td>
                      <td className="p-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(rd.created_at)}</td>
                      <td className="p-3 text-right whitespace-nowrap space-x-1">
                        {rd.status === 'pending' && (
                          <Button size="sm" disabled={busy === rd.id} onClick={() => act(rd, 'approve')}>อนุมัติ</Button>
                        )}
                        {rd.status === 'approved' && (
                          <Button size="sm" variant="secondary" disabled={busy === rd.id} onClick={() => act(rd, 'deliver')}>ส่งมอบแล้ว</Button>
                        )}
                        {(rd.status === 'pending' || rd.status === 'approved') && (
                          <Button size="sm" variant="outline" className="text-red-600" disabled={busy === rd.id} onClick={() => act(rd, 'cancel')}>ยกเลิก</Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? 'แก้ไขรางวัล' : 'เพิ่มรางวัล'}</DialogTitle>
            <DialogDescription>รางวัลจะแสดงในเมนูแลกแต้ม (LIFF) ทันทีเมื่อเปิดใช้</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label>ชื่อรางวัล *</Label>
              <Input value={form.name} onChange={field('name')} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>แต้มที่ใช้แลก *</Label>
                <Input type="number" min={1} value={form.points_required} onChange={field('points_required')} />
              </div>
              <div>
                <Label>ประเภท</Label>
                <Select value={form.reward_type} onValueChange={(v) => setForm((f) => ({ ...f, reward_type: v as RewardType }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(Object.keys(TYPE_LABEL) as RewardType[]).map((t) => (
                      <SelectItem key={t} value={t}>{TYPE_LABEL[t]}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>มูลค่า (บาท/%)</Label>
                <Input type="number" value={form.reward_value} onChange={field('reward_value')} />
              </div>
              <div>
                <Label>สต็อก (-1 = ไม่จำกัด)</Label>
                <Input type="number" min={-1} value={form.stock} onChange={field('stock')} />
              </div>
              <div>
                <Label>สูงสุด/คน (0 = ไม่จำกัด)</Label>
                <Input type="number" min={0} value={form.max_per_user} onChange={field('max_per_user')} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>เริ่ม</Label>
                <Input type="date" value={form.start_date} onChange={field('start_date')} />
              </div>
              <div>
                <Label>สิ้นสุด</Label>
                <Input type="date" value={form.end_date} onChange={field('end_date')} />
              </div>
            </div>
            <div>
              <Label>รูปภาพ (URL)</Label>
              <Input value={form.image_url} onChange={field('image_url')} placeholder="https://…" />
            </div>
            <div>
              <Label>รายละเอียด</Label>
              <Textarea rows={2} value={form.description} onChange={field('description')} />
            </div>
            <div>
              <Label>เงื่อนไข</Label>
              <Textarea rows={2} value={form.terms} onChange={field('terms')} />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))} />
              <Label>เปิดใช้งาน</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>ยกเลิก</Button>
            <Button onClick={saveReward} disabled={saving || !form.name || !form.points_required}>
              {saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />} บันทึก
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function Stat({ label, value, highlight }: { label: string; value: number; highlight?: boolean }) {
  return (
    <Card className={`p-4 ${highlight ? 'border-orange-300 bg-orange-50' : ''}`}>
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="text-2xl font-bold">{value.toLocaleString('th-TH')}</div>
    </Card>
  )
}
