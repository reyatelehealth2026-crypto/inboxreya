'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Eye,
  MousePointerClick,
  Sparkles,
  Users,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Alert, AlertDescription } from '@/components/ui/alert'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type EventType = 'impression' | 'postback' | 'conversion'

interface EngagementRow {
  id: number
  eventType: EventType | string
  action: string | null
  payload: Record<string, unknown> | null
  source: string
  createdAt: string
  lineUserId: string
  displayName: string | null
  pictureUrl: string | null
  lineUserPkId: number | null
}

interface EngagementResponse {
  success: boolean
  data?: {
    broadcast: {
      id: number
      totalRecipients: number
      deliveredCount: number
      readCount: number
      sentAt: string | null
      createdAt: string
    }
    summary: {
      totalEvents: number
      totalsByEvent: Record<string, number>
      uniqueUsersByEvent: Record<string, number>
    }
    events: EngagementRow[]
    pagination: {
      page: number
      limit: number
      total: number
      totalPages: number
    }
  }
  error?: string
}

const EVENT_TABS: { key: 'all' | EventType; label: string; icon: typeof Eye }[] = [
  { key: 'all', label: 'ทั้งหมด', icon: Sparkles },
  { key: 'impression', label: 'เปิดอ่าน', icon: Eye },
  { key: 'postback', label: 'แตะปุ่ม', icon: MousePointerClick },
  { key: 'conversion', label: 'Conversion', icon: Users },
]

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso)
    return d.toLocaleString('th-TH', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function eventBadgeStyles(eventType: string): string {
  switch (eventType) {
    case 'impression':
      return 'bg-blue-50 text-blue-700 border-blue-200'
    case 'postback':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200'
    case 'conversion':
      return 'bg-purple-50 text-purple-700 border-purple-200'
    default:
      return 'bg-gray-50 text-gray-700 border-gray-200'
  }
}

function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string
  value: number | string
  hint?: string
  icon: typeof Eye
  accent: string
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="text-2xl font-semibold mt-1">{value}</p>
            {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
          </div>
          <div className={cn('rounded-lg p-2', accent)}>
            <Icon className="h-4 w-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export default function BroadcastEngagementPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const searchParams = useSearchParams()
  const broadcastId = params?.id

  const initialEvent = (searchParams?.get('event') as 'all' | EventType | null) ?? 'all'
  const initialPage = Number.parseInt(searchParams?.get('page') ?? '1', 10) || 1

  const [activeEvent, setActiveEvent] = useState<'all' | EventType>(initialEvent)
  const [page, setPage] = useState<number>(initialPage)
  const [data, setData] = useState<EngagementResponse['data'] | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(
    async (mode: 'load' | 'refresh' = 'load') => {
      if (!broadcastId) return
      if (mode === 'refresh') setRefreshing(true)
      else setLoading(true)
      setError(null)

      try {
        const qs = new URLSearchParams()
        qs.set('page', String(page))
        qs.set('limit', '50')
        if (activeEvent !== 'all') qs.set('event', activeEvent)

        const res = await fetch(
          `/api/inbox/broadcasts/${broadcastId}/engagement?${qs.toString()}`,
          { cache: 'no-store' }
        )
        const json: EngagementResponse = await res.json()
        if (!res.ok || !json.success || !json.data) {
          throw new Error(json.error || 'Failed to load engagement')
        }
        setData(json.data)
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error'
        setError(message)
        setData(null)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [broadcastId, page, activeEvent]
  )

  useEffect(() => {
    void fetchData('load')
  }, [fetchData])

  useEffect(() => {
    const qs = new URLSearchParams(searchParams?.toString() ?? '')
    if (activeEvent === 'all') qs.delete('event')
    else qs.set('event', activeEvent)
    if (page === 1) qs.delete('page')
    else qs.set('page', String(page))
    const next = qs.toString()
    const path = `/inbox/broadcasts/${broadcastId}/engagement${next ? `?${next}` : ''}`
    router.replace(path, { scroll: false })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEvent, page, broadcastId])

  const summary = data?.summary
  const totalsByEvent = summary?.totalsByEvent ?? {}
  const uniqueByEvent = summary?.uniqueUsersByEvent ?? {}

  const impressionCount = totalsByEvent.impression ?? 0
  const postbackCount = totalsByEvent.postback ?? 0
  const conversionCount = totalsByEvent.conversion ?? 0
  const uniqueImpressionUsers = uniqueByEvent.impression ?? 0
  const uniquePostbackUsers = uniqueByEvent.postback ?? 0

  const broadcast = data?.broadcast
  const deliveredCount = broadcast?.deliveredCount ?? broadcast?.totalRecipients ?? 0
  const openRate =
    deliveredCount > 0 ? Math.round((uniqueImpressionUsers / deliveredCount) * 100) : null
  const intentRate =
    uniqueImpressionUsers > 0
      ? Math.round((uniquePostbackUsers / uniqueImpressionUsers) * 100)
      : null

  const events = data?.events ?? []
  const pagination = data?.pagination

  const groupedActions = useMemo(() => {
    const map = new Map<string, number>()
    for (const e of events) {
      const key = `${e.eventType}:${e.action ?? '-'}`
      map.set(key, (map.get(key) ?? 0) + 1)
    }
    return Array.from(map.entries()).map(([k, count]) => {
      const [event, action] = k.split(':')
      return { event, action, count }
    })
  }, [events])

  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <Link
                href="/inbox/broadcasts"
                className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                กลับไปยัง Broadcasts
              </Link>
              <h1 className="text-2xl font-bold mt-2">Engagement #{broadcastId}</h1>
              <p className="text-sm text-muted-foreground mt-1">
                ผู้ใช้ที่เปิดอ่าน / แตะปุ่ม / ทำ conversion ใน broadcast นี้
              </p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => void fetchData('refresh')}
              disabled={refreshing || loading}
            >
              {refreshing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              <span className="ml-1.5">รีเฟรช</span>
            </Button>
          </div>

          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Impressions"
              value={impressionCount}
              hint={`${uniqueImpressionUsers} unique users`}
              icon={Eye}
              accent="bg-blue-50 text-blue-600"
            />
            <StatCard
              label="Postback (intent)"
              value={postbackCount}
              hint={`${uniquePostbackUsers} unique users`}
              icon={MousePointerClick}
              accent="bg-emerald-50 text-emerald-600"
            />
            <StatCard
              label="Conversions"
              value={conversionCount}
              icon={Sparkles}
              accent="bg-purple-50 text-purple-600"
            />
            <StatCard
              label="Open rate"
              value={openRate !== null ? `${openRate}%` : '—'}
              hint={
                intentRate !== null
                  ? `Intent rate: ${intentRate}%`
                  : `${deliveredCount} delivered`
              }
              icon={Users}
              accent="bg-amber-50 text-amber-600"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {EVENT_TABS.map((tab) => {
              const isActive = activeEvent === tab.key
              const Icon = tab.icon
              const count =
                tab.key === 'all'
                  ? data?.summary.totalEvents ?? 0
                  : totalsByEvent[tab.key] ?? 0
              return (
                <button
                  key={tab.key}
                  onClick={() => {
                    setActiveEvent(tab.key)
                    setPage(1)
                  }}
                  className={cn(
                    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-sm transition-colors',
                    isActive
                      ? 'border-green-300 bg-green-50 text-green-700'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span>{tab.label}</span>
                  <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-xs">
                    {count}
                  </Badge>
                </button>
              )
            })}
          </div>

          <Card>
            <CardContent className="p-0">
              {loading ? (
                <div className="p-6 space-y-3">
                  {Array.from({ length: 6 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full" />
                  ))}
                </div>
              ) : events.length === 0 ? (
                <div className="p-12 text-center text-sm text-muted-foreground">
                  ยังไม่มี engagement ในตัวกรองนี้
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[260px]">ผู้ใช้</TableHead>
                      <TableHead className="w-[140px]">Event</TableHead>
                      <TableHead className="w-[160px]">Action</TableHead>
                      <TableHead>Payload</TableHead>
                      <TableHead className="w-[170px] text-right">เวลา</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {events.map((row) => (
                      <TableRow key={row.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Avatar className="h-8 w-8">
                              {row.pictureUrl && (
                                <AvatarImage src={row.pictureUrl} alt={row.displayName ?? ''} />
                              )}
                              <AvatarFallback>
                                {(row.displayName ?? row.lineUserId).slice(0, 1).toUpperCase()}
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {row.displayName ?? '(ไม่ได้เป็น follower)'}
                              </p>
                              <p className="text-xs text-muted-foreground font-mono truncate">
                                {row.lineUserId}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={cn('font-normal', eventBadgeStyles(row.eventType))}
                          >
                            {row.eventType}
                          </Badge>
                          <span className="ml-2 text-xs text-muted-foreground">
                            {row.source}
                          </span>
                        </TableCell>
                        <TableCell>
                          {row.action ? (
                            <span className="text-sm">{row.action}</span>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.payload && Object.keys(row.payload).length > 0 ? (
                            <code className="text-xs bg-gray-50 px-2 py-1 rounded">
                              {JSON.stringify(row.payload)}
                            </code>
                          ) : (
                            <span className="text-sm text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right text-sm text-muted-foreground">
                          {formatDateTime(row.createdAt)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {pagination && pagination.totalPages > 1 && (
            <div className="flex items-center justify-between text-sm">
              <p className="text-muted-foreground">
                หน้า {pagination.page} / {pagination.totalPages} · {pagination.total} รายการ
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1 || loading}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  ก่อนหน้า
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= pagination.totalPages || loading}
                  onClick={() => setPage((p) => p + 1)}
                >
                  ถัดไป
                </Button>
              </div>
            </div>
          )}

          {groupedActions.length > 0 && (
            <Card>
              <CardContent className="p-4">
                <p className="text-xs font-medium text-muted-foreground mb-2">
                  Action breakdown (หน้านี้)
                </p>
                <div className="flex flex-wrap gap-2">
                  {groupedActions.map((g) => (
                    <Badge
                      key={`${g.event}-${g.action}`}
                      variant="outline"
                      className={eventBadgeStyles(g.event)}
                    >
                      {g.event} · {g.action} × {g.count}
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </InboxLayout>
  )
}
