'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AlertTriangle,
  Loader2,
  MessageSquare,
  RefreshCw,
  Send,
  Target,
  UserMinus,
  Users,
  Webhook,
} from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'

type BreakdownRow = { label: string; percentage: number }

type OaSnapshot = {
  account: { id: number | null; name: string | null }
  bot: {
    basicId: string
    displayName: string
    pictureUrl?: string
    chatMode: 'chat' | 'bot'
    markAsReadMode: 'auto' | 'manual'
  } | null
  quota: { type: 'none' | 'limited'; limit: number | null; used: number | null; remaining: number | null }
  followers: {
    status: 'ready' | 'unready' | 'out_of_service'
    followers?: number
    targetedReaches?: number
    blocks?: number
    date: string
  } | null
  demographic: {
    available: boolean
    genders?: Array<{ gender: string; percentage: number }>
    ages?: Array<{ age: string; percentage: number }>
    areas?: Array<{ area: string; percentage: number }>
    appTypes?: Array<{ appType: string; percentage: number }>
    subscriptionPeriods?: Array<{ subscriptionPeriod: string; percentage: number }>
  } | null
  webhook: { endpoint: string | null; active: boolean | null }
  fetchedAt: string
  errors: string[]
}

type DeliveryKey =
  | 'broadcast'
  | 'targeting'
  | 'apiBroadcast'
  | 'apiPush'
  | 'apiMulticast'
  | 'apiNarrowcast'
  | 'apiReply'
  | 'autoResponse'
  | 'welcomeResponse'
  | 'chat'

type OaDetail = {
  trend: Array<{
    date: string
    followers: number | null
    targetedReaches: number | null
    blocks: number | null
  }>
  delivery: ({ status: string; date: string } & Partial<Record<DeliveryKey, number>>) | null
  audiences: Array<{
    audienceGroupId: number
    type: string
    description: string
    status: string
    failedType?: string | null
    audienceCount: number
    created: number
    expireTimestamp?: number | null
  }>
  audienceTotal: number | null
  audienceAuthority: string | null
  fetchedAt: string
  errors: string[]
}

const DELIVERY_ROWS: Array<{ key: DeliveryKey; label: string }> = [
  { key: 'broadcast', label: 'Broadcast (OA Manager)' },
  { key: 'targeting', label: 'Narrowcast (OA Manager)' },
  { key: 'apiBroadcast', label: 'API Broadcast' },
  { key: 'apiPush', label: 'API Push' },
  { key: 'apiMulticast', label: 'API Multicast' },
  { key: 'apiNarrowcast', label: 'API Narrowcast' },
  { key: 'apiReply', label: 'API Reply (ไม่กินโควตา)' },
  { key: 'autoResponse', label: 'ตอบอัตโนมัติ' },
  { key: 'welcomeResponse', label: 'ทักทายเพื่อนใหม่' },
  { key: 'chat', label: 'แชท (คนตอบ)' },
]

const AUDIENCE_TYPE_LABELS: Record<string, string> = {
  UPLOAD: 'อัปโหลดรายชื่อ',
  CLICK: 'คนที่กดลิงก์',
  IMP: 'คนที่เห็นข้อความ',
  CHAT_TAG: 'จากแท็กแชท',
  FRIEND_PATH: 'ช่องทางที่เพิ่มเพื่อน',
  RESERVATION: 'จองล่วงหน้า',
  APP_EVENT: 'อีเวนต์ในแอป',
  VIDEO_VIEW: 'คนที่ดูวิดีโอ',
  WEBTRAFFIC: 'ทราฟฟิกเว็บ',
}

const AUDIENCE_STATUS: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' }> = {
  READY: { label: 'พร้อมใช้', variant: 'default' },
  IN_PROGRESS: { label: 'กำลังสร้าง', variant: 'secondary' },
  ACTIVATING: { label: 'กำลังเปิดใช้', variant: 'secondary' },
  INACTIVE: { label: 'ปิดใช้งาน', variant: 'secondary' },
  FAILED: { label: 'ล้มเหลว', variant: 'destructive' },
  EXPIRED: { label: 'หมดอายุ', variant: 'destructive' },
}

const GENDER_LABELS: Record<string, string> = { male: 'ชาย', female: 'หญิง', unknown: 'ไม่ระบุ' }
const APP_TYPE_LABELS: Record<string, string> = { ios: 'iOS', android: 'Android', others: 'อื่นๆ' }
const SUBSCRIPTION_LABELS: Record<string, string> = {
  within7days: 'ไม่เกิน 7 วัน',
  within30days: 'ไม่เกิน 30 วัน',
  within90days: 'ไม่เกิน 90 วัน',
  within180days: 'ไม่เกิน 180 วัน',
  within365days: 'ไม่เกิน 1 ปี',
  over365days: 'มากกว่า 1 ปี',
  unknown: 'ไม่ระบุ',
}

const num = (value: number | null | undefined) =>
  typeof value === 'number' ? value.toLocaleString('th-TH') : '—'

/** yyyyMMdd → 22 ส.ค. 69 */
const thaiDate = (stamp: string) => {
  const parsed = new Date(`${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}`)
  if (!Number.isFinite(parsed.getTime())) return stamp
  return parsed.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })
}

/** LINE ส่ง created/expireTimestamp มาเป็น epoch วินาที ไม่ใช่มิลลิวินาที */
const thaiEpochDate = (epochSeconds: number | null | undefined) => {
  if (typeof epochSeconds !== 'number' || epochSeconds <= 0) return '—'
  return new Date(epochSeconds * 1000).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: '2-digit',
  })
}

/** from15to19 → 15–19 · from50 → 50+ */
const prettyAge = (age: string) => {
  const range = age.match(/^from(\d+)to(\d+)$/)
  if (range) return `${range[1]}–${range[2]}`
  const open = age.match(/^from(\d+)$/)
  if (open) return `${open[1]}+`
  return age === 'unknown' ? 'ไม่ระบุ' : age
}

function StatRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  )
}

/** percentage จาก LINE เป็นสเกล 0–100 อยู่แล้ว ห้ามคูณ 100 ซ้ำ */
function Breakdown({ title, rows, limit }: { title: string; rows?: BreakdownRow[]; limit?: number }) {
  if (!rows?.length) return null
  const sorted = [...rows].sort((a, b) => b.percentage - a.percentage)
  const shown = limit ? sorted.slice(0, limit) : sorted

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</p>
      {shown.map((row) => (
        <div key={row.label} className="space-y-1">
          <div className="flex justify-between text-sm">
            <span>{row.label}</span>
            <span className="tabular-nums text-muted-foreground">{row.percentage.toFixed(1)}%</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-muted">
            <div
              className="h-1.5 rounded-full bg-primary"
              style={{ width: `${Math.min(100, Math.max(0, row.percentage))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}

function ErrorCard({ errors }: { errors: string[] }) {
  if (!errors.length) return null
  return (
    <Card className="border-amber-500/40">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm text-amber-600">
          <AlertTriangle className="h-4 w-4" /> ดึงข้อมูลบางส่วนไม่ได้
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1">
        {errors.map((message) => (
          <p key={message} className="break-all text-xs text-muted-foreground">
            {message}
          </p>
        ))}
      </CardContent>
    </Card>
  )
}

function LoadingCard({ text }: { text: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-2 p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {text}
      </CardContent>
    </Card>
  )
}

export default function OaStatusPage() {
  const [snapshot, setSnapshot] = useState<OaSnapshot | null>(null)
  const [detail, setDetail] = useState<OaDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [detailLoading, setDetailLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/inbox/oa-status', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || `โหลดไม่สำเร็จ (${response.status})`)
      }
      setSnapshot(payload.data as OaSnapshot)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ')
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async () => {
    setDetailLoading(true)
    setDetailError(null)
    try {
      const response = await fetch('/api/inbox/oa-status/detail', { cache: 'no-store' })
      const payload = await response.json().catch(() => ({}))
      if (!response.ok || payload.success === false) {
        throw new Error(payload.error || `โหลดไม่สำเร็จ (${response.status})`)
      }
      setDetail(payload.data as OaDetail)
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : 'โหลดไม่สำเร็จ')
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  // โหลดตอนเปิดแท็บครั้งแรกเท่านั้น — ยิง LINE ~10 ครั้ง ไม่ควรถ่วงหน้าแรก
  const onTabChange = (value: string) => {
    if (value !== 'overview' && !detail && !detailLoading) void loadDetail()
  }

  const refresh = () => {
    void load()
    if (detail) void loadDetail()
  }

  const quotaPercent =
    snapshot?.quota.limit && snapshot.quota.used !== null
      ? Math.min(100, (snapshot.quota.used / snapshot.quota.limit) * 100)
      : null

  const deliveryTotal = detail?.delivery
    ? DELIVERY_ROWS.reduce((sum, row) => sum + (detail.delivery?.[row.key] ?? 0), 0)
    : null

  const demographic = snapshot?.demographic

  return (
    <InboxLayout>
      <div className="mx-auto w-full max-w-5xl space-y-4 p-4 md:p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">สถานะ OA</h1>
            <p className="text-sm text-muted-foreground">
              {snapshot?.account.name ?? 'บัญชี LINE'}
              {snapshot?.fetchedAt
                ? ` · อัปเดต ${new Date(snapshot.fetchedAt).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}`
                : ''}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={refresh} disabled={loading || detailLoading}>
            {loading || detailLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="mr-2 h-4 w-4" />
            )}
            รีเฟรช
          </Button>
        </div>

        {error && (
          <Card className="border-destructive/50">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              {error}
            </CardContent>
          </Card>
        )}

        <Tabs defaultValue="overview" onValueChange={onTabChange} className="space-y-4">
          <TabsList>
            <TabsTrigger value="overview">ภาพรวม</TabsTrigger>
            <TabsTrigger value="insight">Insight</TabsTrigger>
            <TabsTrigger value="audience">Audience</TabsTrigger>
          </TabsList>

          {/* ───────────── ภาพรวม ───────────── */}
          <TabsContent value="overview" className="space-y-4">
            {snapshot && (
              <>
                <div className="grid gap-4 md:grid-cols-2">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <MessageSquare className="h-4 w-4" /> บัญชี
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {snapshot.bot ? (
                        <>
                          <StatRow label="ชื่อ OA" value={snapshot.bot.displayName} />
                          <StatRow label="LINE ID" value={`@${snapshot.bot.basicId}`} />
                          <div className="flex items-baseline justify-between gap-4 py-1.5">
                            <span className="text-sm text-muted-foreground">โหมดแชท</span>
                            <Badge variant={snapshot.bot.chatMode === 'chat' ? 'default' : 'secondary'}>
                              {snapshot.bot.chatMode === 'chat' ? 'คนตอบ (chat)' : 'บอทตอบ (bot)'}
                            </Badge>
                          </div>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">ดึงข้อมูลบัญชีไม่ได้</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">โควตาข้อความเดือนนี้</CardTitle>
                    </CardHeader>
                    <CardContent>
                      {snapshot.quota.type === 'none' ? (
                        <p className="text-sm text-muted-foreground">แพ็กเกจนี้ไม่จำกัดโควตา</p>
                      ) : (
                        <>
                          <StatRow label="ส่งไปแล้ว" value={num(snapshot.quota.used)} />
                          <StatRow label="โควตาทั้งหมด" value={num(snapshot.quota.limit)} />
                          <StatRow label="เหลือ" value={num(snapshot.quota.remaining)} />
                          {quotaPercent !== null && (
                            <div className="mt-3 h-2 w-full rounded-full bg-muted">
                              <div
                                className={`h-2 rounded-full ${quotaPercent > 80 ? 'bg-destructive' : 'bg-primary'}`}
                                style={{ width: `${quotaPercent}%` }}
                              />
                            </div>
                          )}
                        </>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Users className="h-4 w-4" /> เพื่อน
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {snapshot.followers?.status === 'ready' ? (
                        <>
                          <StatRow label="เพื่อนทั้งหมด" value={num(snapshot.followers.followers)} />
                          <StatRow label="ส่งข้อความถึงได้" value={num(snapshot.followers.targetedReaches)} />
                          <div className="flex items-baseline justify-between gap-4 py-1.5">
                            <span className="flex items-center gap-1.5 text-sm text-muted-foreground">
                              <UserMinus className="h-3.5 w-3.5" /> บล็อก
                            </span>
                            <span className="font-semibold tabular-nums">{num(snapshot.followers.blocks)}</span>
                          </div>
                          <p className="pt-2 text-xs text-muted-foreground">
                            ข้อมูลวันที่ {thaiDate(snapshot.followers.date)} (LINE สรุปย้อนหลัง 1 วัน)
                          </p>
                        </>
                      ) : (
                        <p className="text-sm text-muted-foreground">LINE ยังไม่สรุปข้อมูลช่วงนี้</p>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Webhook className="h-4 w-4" /> Webhook
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-baseline justify-between gap-4 py-1.5">
                        <span className="text-sm text-muted-foreground">สถานะ</span>
                        <Badge variant={snapshot.webhook.active ? 'default' : 'destructive'}>
                          {snapshot.webhook.active ? 'เปิดใช้งาน' : 'ปิด / ไม่ทราบ'}
                        </Badge>
                      </div>
                      <p className="break-all pt-2 text-xs text-muted-foreground">
                        {snapshot.webhook.endpoint ?? 'ยังไม่ได้ตั้ง endpoint'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                {demographic?.available && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">กลุ่มลูกค้า (Top 3)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-3">
                      <Breakdown
                        title="เพศ"
                        limit={3}
                        rows={demographic.genders?.map((g) => ({
                          label: GENDER_LABELS[g.gender] ?? g.gender,
                          percentage: g.percentage,
                        }))}
                      />
                      <Breakdown
                        title="อายุ"
                        limit={3}
                        rows={demographic.ages?.map((a) => ({
                          label: prettyAge(a.age),
                          percentage: a.percentage,
                        }))}
                      />
                      <Breakdown
                        title="พื้นที่"
                        limit={3}
                        rows={demographic.areas?.map((a) => ({ label: a.area, percentage: a.percentage }))}
                      />
                    </CardContent>
                  </Card>
                )}

                <ErrorCard errors={snapshot.errors} />
              </>
            )}
          </TabsContent>

          {/* ───────────── Insight ───────────── */}
          <TabsContent value="insight" className="space-y-4">
            {detailLoading && <LoadingCard text="กำลังดึงข้อมูลย้อนหลัง 7 วันจาก LINE…" />}

            {detailError && (
              <Card className="border-destructive/50">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {detailError}
                </CardContent>
              </Card>
            )}

            {detail && (
              <>
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">แนวโน้มเพื่อน 7 วัน</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>วันที่</TableHead>
                          <TableHead className="text-right">เพื่อน</TableHead>
                          <TableHead className="text-right">เปลี่ยนแปลง</TableHead>
                          <TableHead className="text-right">ส่งถึงได้</TableHead>
                          <TableHead className="text-right">บล็อก</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.trend.map((point, index) => {
                          const previous = index > 0 ? detail.trend[index - 1].followers : null
                          const delta =
                            point.followers !== null && previous !== null ? point.followers - previous : null
                          const deltaClass =
                            delta === null || delta === 0
                              ? ''
                              : delta > 0
                                ? 'text-green-600'
                                : 'text-destructive'
                          return (
                            <TableRow key={point.date}>
                              <TableCell>{thaiDate(point.date)}</TableCell>
                              <TableCell className="text-right tabular-nums">{num(point.followers)}</TableCell>
                              <TableCell className={`text-right tabular-nums ${deltaClass}`}>
                                {delta === null ? '—' : delta > 0 ? `+${num(delta)}` : num(delta)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">
                                {num(point.targetedReaches)}
                              </TableCell>
                              <TableCell className="text-right tabular-nums">{num(point.blocks)}</TableCell>
                            </TableRow>
                          )
                        })}
                      </TableBody>
                    </Table>
                    {detail.trend.every((point) => point.followers === null) && (
                      <p className="pt-3 text-sm text-muted-foreground">
                        LINE ยังไม่สรุปข้อมูลช่วงนี้ (บัญชีใหม่ต้องรอ 1–2 วัน)
                      </p>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Send className="h-4 w-4" /> ข้อความที่ส่ง
                      {detail.delivery ? (
                        <span className="text-sm font-normal text-muted-foreground">
                          · {thaiDate(detail.delivery.date)}
                        </span>
                      ) : null}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {detail.delivery?.status === 'ready' ? (
                      <>
                        <div className="grid gap-x-8 md:grid-cols-2">
                          {DELIVERY_ROWS.filter((row) => (detail.delivery?.[row.key] ?? 0) > 0).map((row) => (
                            <StatRow key={row.key} label={row.label} value={num(detail.delivery?.[row.key])} />
                          ))}
                        </div>
                        <div className="mt-3 flex items-baseline justify-between border-t pt-3">
                          <span className="text-sm font-medium">รวมทั้งวัน</span>
                          <span className="text-lg font-bold tabular-nums">{num(deliveryTotal)}</span>
                        </div>
                        {deliveryTotal === 0 && (
                          <p className="pt-2 text-sm text-muted-foreground">วันนั้นไม่มีการส่งข้อความ</p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm text-muted-foreground">LINE ยังไม่สรุปข้อมูลช่วงนี้</p>
                    )}
                  </CardContent>
                </Card>

                {demographic?.available && (
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">กลุ่มลูกค้า (ทั้งหมด)</CardTitle>
                    </CardHeader>
                    <CardContent className="grid gap-6 md:grid-cols-2">
                      <Breakdown
                        title="เพศ"
                        rows={demographic.genders?.map((g) => ({
                          label: GENDER_LABELS[g.gender] ?? g.gender,
                          percentage: g.percentage,
                        }))}
                      />
                      <Breakdown
                        title="อายุ"
                        rows={demographic.ages?.map((a) => ({
                          label: prettyAge(a.age),
                          percentage: a.percentage,
                        }))}
                      />
                      <Breakdown
                        title="พื้นที่"
                        rows={demographic.areas?.map((a) => ({ label: a.area, percentage: a.percentage }))}
                      />
                      <div className="space-y-6">
                        <Breakdown
                          title="ระบบปฏิบัติการ"
                          rows={demographic.appTypes?.map((a) => ({
                            label: APP_TYPE_LABELS[a.appType] ?? a.appType,
                            percentage: a.percentage,
                          }))}
                        />
                        <Breakdown
                          title="ติดตามมานาน"
                          rows={demographic.subscriptionPeriods?.map((s) => ({
                            label: SUBSCRIPTION_LABELS[s.subscriptionPeriod] ?? s.subscriptionPeriod,
                            percentage: s.percentage,
                          }))}
                        />
                      </div>
                    </CardContent>
                  </Card>
                )}

                <ErrorCard errors={detail.errors} />
              </>
            )}
          </TabsContent>

          {/* ───────────── Audience ───────────── */}
          <TabsContent value="audience" className="space-y-4">
            {detailLoading && <LoadingCard text="กำลังดึงรายการ Audience…" />}

            {detailError && (
              <Card className="border-destructive/50">
                <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {detailError}
                </CardContent>
              </Card>
            )}

            {detail && (
              <>
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="flex items-center gap-2 text-base">
                        <Target className="h-4 w-4" /> กลุ่มทั้งหมด
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold tabular-nums">{num(detail.audienceTotal)}</p>
                      <p className="text-xs text-muted-foreground">
                        แสดง {detail.audiences.length} รายการล่าสุด
                      </p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">พร้อมใช้งาน</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold tabular-nums">
                        {num(detail.audiences.filter((audience) => audience.status === 'READY').length)}
                      </p>
                      <p className="text-xs text-muted-foreground">ยิง narrowcast ได้ทันที</p>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base">สิทธิ์เข้าถึง</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-2xl font-bold">{detail.audienceAuthority ?? '—'}</p>
                      <p className="text-xs text-muted-foreground">
                        {detail.audienceAuthority === 'PUBLIC'
                          ? 'ทุก channel ในบัญชีเห็นกลุ่มนี้'
                          : 'เฉพาะ channel นี้เท่านั้น'}
                      </p>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base">รายการ Audience</CardTitle>
                  </CardHeader>
                  <CardContent className="overflow-x-auto">
                    {detail.audiences.length === 0 ? (
                      <p className="text-sm text-muted-foreground">ยังไม่มี audience ในบัญชีนี้</p>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>ชื่อกลุ่ม</TableHead>
                            <TableHead>ที่มา</TableHead>
                            <TableHead className="text-right">จำนวนคน</TableHead>
                            <TableHead>สถานะ</TableHead>
                            <TableHead>สร้างเมื่อ</TableHead>
                            <TableHead>หมดอายุ</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {detail.audiences.map((audience) => {
                            const status = AUDIENCE_STATUS[audience.status] ?? {
                              label: audience.status,
                              variant: 'secondary' as const,
                            }
                            return (
                              <TableRow key={audience.audienceGroupId}>
                                <TableCell className="max-w-[220px] truncate font-medium">
                                  {audience.description}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {AUDIENCE_TYPE_LABELS[audience.type] ?? audience.type}
                                </TableCell>
                                <TableCell className="text-right tabular-nums">
                                  {num(audience.audienceCount)}
                                </TableCell>
                                <TableCell>
                                  <Badge variant={status.variant}>{status.label}</Badge>
                                  {audience.failedType ? (
                                    <span className="block pt-1 text-xs text-destructive">
                                      {audience.failedType}
                                    </span>
                                  ) : null}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {thaiEpochDate(audience.created)}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {thaiEpochDate(audience.expireTimestamp)}
                                </TableCell>
                              </TableRow>
                            )
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>

                <ErrorCard errors={detail.errors} />
              </>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </InboxLayout>
  )
}
