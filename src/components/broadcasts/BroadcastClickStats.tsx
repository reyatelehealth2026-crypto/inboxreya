'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Loader2, MousePointerClick, Users, AlertCircle, BarChart2 } from 'lucide-react'

export interface EngagementSummary {
  totalEvents: number
  totalsByEvent: Record<string, number>
  uniqueUsersByEvent: Record<string, number>
  clicksByRegion: Record<string, number>
  uniqueClickers: number
  anonymousClicks: number
}

interface BroadcastClickStatsProps {
  broadcastId: number
  totalRecipients: number
  mediaUrl?: string | null
}

export function useBroadcastEngagement(broadcastId: number) {
  const [data, setData] = useState<EngagementSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch(`/api/inbox/broadcasts/${broadcastId}/engagement`)
      .then(async (res) => {
        if (!res.ok) throw new Error('Failed to load engagement stats')
        return res.json()
      })
      .then((json) => {
        if (active && json.success && json.data?.summary) {
          setData(json.data.summary)
        }
      })
      .catch((err) => {
        if (active) setError(err instanceof Error ? err.message : 'Error loading stats')
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [broadcastId])

  return { data, loading, error }
}

/**
 * Compact CTR Badge for tables / cards (fetched lazily when mounted).
 */
export function BroadcastCtrBadge({
  broadcastId,
  totalRecipients,
}: {
  broadcastId: number
  totalRecipients: number
}) {
  const { data: summary, loading, error } = useBroadcastEngagement(broadcastId)

  if (loading) {
    return (
      <Badge variant="outline" className="text-[10px] h-5 gap-1 font-mono text-muted-foreground animate-pulse">
        <Loader2 className="h-2.5 w-2.5 animate-spin" /> CTR...
      </Badge>
    )
  }

  if (error || !summary) {
    return null
  }

  const uniqueClickers = summary.uniqueClickers ?? 0
  const anonymousClicks = summary.anonymousClicks ?? 0
  const safeTotal = totalRecipients > 0 ? totalRecipients : 0

  // If audience was 'all' (only anonymous clicks logged, uniqueClickers = 0)
  if (anonymousClicks > 0 && uniqueClickers === 0) {
    return (
      <Badge variant="secondary" className="text-[10px] h-5 gap-1 font-normal bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300">
        <MousePointerClick className="h-2.5 w-2.5" />
        คลิกรวม {anonymousClicks.toLocaleString()} (ไม่ระบุตัวตน)
      </Badge>
    )
  }

  const ctrPercentage = safeTotal > 0
    ? ((uniqueClickers / safeTotal) * 100).toFixed(1)
    : '0.0'

  return (
    <Badge
      variant="default"
      className="text-[10px] h-5 gap-1 font-medium bg-emerald-600 hover:bg-emerald-700 text-white"
    >
      <MousePointerClick className="h-2.5 w-2.5" />
      CTR {ctrPercentage}% ({uniqueClickers.toLocaleString()} คน)
    </Badge>
  )
}

/**
 * Detailed expanded view of Imagemap Click Stats:
 * Displays CTR, total clicks, breakdown by region, and image preview.
 */
export function BroadcastClickStats({
  broadcastId,
  totalRecipients,
  mediaUrl,
}: BroadcastClickStatsProps) {
  const { data: summary, loading, error } = useBroadcastEngagement(broadcastId)

  if (loading) {
    return (
      <div className="flex items-center justify-center p-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> กำลังโหลดสถิติการคลิก...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 p-4 text-xs text-destructive">
        <AlertCircle className="h-4 w-4" />
        ไม่สามารถโหลดสถิติได้: {error}
      </div>
    )
  }

  if (!summary) {
    return (
      <div className="p-4 text-center text-xs text-muted-foreground">
        ยังไม่มีข้อมูลสถิติการคลิกสำหรับ Broadcast นี้
      </div>
    )
  }

  const uniqueClickers = summary.uniqueClickers ?? 0
  const anonymousClicks = summary.anonymousClicks ?? 0
  const safeTotal = totalRecipients > 0 ? totalRecipients : 0
  const totalClicks = summary.totalsByEvent?.click ?? (uniqueClickers + anonymousClicks)

  const ctrPercentage = safeTotal > 0
    ? ((uniqueClickers / safeTotal) * 100).toFixed(1)
    : '0.0'

  // Image 700 preview URL derived from 460
  const preview700Url = mediaUrl ? mediaUrl.replace(/\/460$/, '/700') : null

  // Sort regions by region index (e.g. "region:0", "region:1")
  const regionEntries = Object.entries(summary.clicksByRegion || {}).sort((a, b) => {
    const idxA = parseInt(a[0].replace('region:', '')) || 0
    const idxB = parseInt(b[0].replace('region:', '')) || 0
    return idxA - idxB
  })

  return (
    <div className="space-y-4 rounded-lg border bg-muted/10 p-4">
      {/* Metric Highlights */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">CTR (อัตราการคลิก)</p>
          <p className="text-lg font-bold text-emerald-600">
            {anonymousClicks > 0 && uniqueClickers === 0
              ? 'ไม่ระบุตัวตน'
              : `${ctrPercentage}%`}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {safeTotal > 0 ? `จากผู้รับ ${safeTotal.toLocaleString()} คน` : '-'}
          </span>
        </div>

        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">ผู้กดคลิก (Unique)</p>
          <p className="text-lg font-bold text-primary">
            {uniqueClickers.toLocaleString()}
          </p>
          <span className="text-[10px] text-muted-foreground">
            {anonymousClicks > 0 ? `+ ไม่ระบุตัวตน ${anonymousClicks} ครั้ง` : 'ระบุตัวตนครบ'}
          </span>
        </div>

        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">ยอดคลิกรวมทั้งหมด</p>
          <p className="text-lg font-bold">{totalClicks.toLocaleString()}</p>
          <span className="text-[10px] text-muted-foreground">รวมคลิกซ้ำ</span>
        </div>

        <div className="rounded-md border bg-background p-3">
          <p className="text-xs text-muted-foreground">จำนวนจุดกดที่มีการคลิก</p>
          <p className="text-lg font-bold text-indigo-600">{regionEntries.length} ช่อง</p>
          <span className="text-[10px] text-muted-foreground">จากทุกจุดใน Imagemap</span>
        </div>
      </div>

      {/* Region Click Breakdown & Image Preview */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
        {/* Table of Regions */}
        <div className={preview700Url ? 'md:col-span-7' : 'md:col-span-12'}>
          <div className="rounded-md border bg-background overflow-hidden">
            <div className="px-3 py-2 border-b bg-muted/30 text-xs font-semibold flex items-center justify-between">
              <span>ยอดคลิกแยกตามจุดกด (Per-Region Clicks)</span>
              <BarChart2 className="h-3.5 w-3.5 text-muted-foreground" />
            </div>

            {regionEntries.length === 0 ? (
              <div className="p-4 text-center text-xs text-muted-foreground">
                ยังไม่มีการคลิกในจุดใด
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="text-[11px]">
                    <TableHead className="w-16">ช่อง</TableHead>
                    <TableHead>จำนวนคลิก</TableHead>
                    <TableHead className="text-right">สัดส่วน</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {regionEntries.map(([actionKey, count]) => {
                    const regionNum = (parseInt(actionKey.replace('region:', '')) || 0) + 1
                    const sharePct = totalClicks > 0 ? Math.round((count / totalClicks) * 100) : 0
                    return (
                      <TableRow key={actionKey} className="text-xs">
                        <TableCell>
                          <Badge variant="outline" className="font-mono text-[10px] h-5 w-5 p-0 flex items-center justify-center">
                            {regionNum}
                          </Badge>
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-2">
                            <span>{count.toLocaleString()} ครั้ง</span>
                            <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                              <div
                                className="h-full bg-emerald-500 rounded-full"
                                style={{ width: `${sharePct}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">
                          {sharePct}%
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Imagemap Image preview */}
        {preview700Url && (
          <div className="md:col-span-5 flex flex-col items-center">
            <div className="overflow-hidden rounded-lg border bg-black shadow-sm max-h-56">
              <img
                src={preview700Url}
                alt="Imagemap Visual"
                className="w-full h-auto object-contain max-h-56"
              />
            </div>
            <p className="mt-1 text-[10px] text-muted-foreground">ภาพ Imagemap ที่ส่ง</p>
          </div>
        )}
      </div>
    </div>
  )
}
