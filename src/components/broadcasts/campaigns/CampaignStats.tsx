'use client'

import { BarChart3, CheckCircle2, Clock, Send, Users } from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { useBroadcastStats } from '@/hooks/use-broadcasts'

interface StatItem {
  key: string
  label: string
  value: string
  icon: typeof Send
  iconBg: string
  iconColor: string
}

export function CampaignStats() {
  const { data, isLoading } = useBroadcastStats()
  const stats = data?.data as
    | {
        total?: number
        sent?: number
        draft?: number
        scheduled?: number
        totalRecipients?: number
        totalBroadcasts?: number
        sentToday?: number
        scheduledCount?: number
        avgSuccessRate?: number
      }
    | undefined

  const total = stats?.total ?? stats?.totalBroadcasts ?? 0
  const scheduled = stats?.scheduled ?? stats?.scheduledCount ?? 0
  const sent = stats?.sent ?? 0
  const totalRecipients = stats?.totalRecipients ?? 0
  const successRate =
    stats?.avgSuccessRate ?? (total > 0 ? Math.round((sent / total) * 100) : 0)

  const items: StatItem[] = [
    {
      key: 'total',
      label: 'Campaigns ทั้งหมด',
      value: total.toLocaleString(),
      icon: Send,
      iconBg: 'bg-primary/10',
      iconColor: 'text-primary',
    },
    {
      key: 'scheduled',
      label: 'รอส่ง',
      value: scheduled.toLocaleString(),
      icon: Clock,
      iconBg: 'bg-blue-100',
      iconColor: 'text-blue-600',
    },
    {
      key: 'sent',
      label: 'ส่งสำเร็จ',
      value: sent.toLocaleString(),
      icon: CheckCircle2,
      iconBg: 'bg-emerald-100',
      iconColor: 'text-emerald-600',
    },
    {
      key: 'reach',
      label: 'ผู้รับสะสม',
      value: totalRecipients.toLocaleString(),
      icon: Users,
      iconBg: 'bg-amber-100',
      iconColor: 'text-amber-600',
    },
    {
      key: 'rate',
      label: 'อัตราสำเร็จเฉลี่ย',
      value: `${successRate}%`,
      icon: BarChart3,
      iconBg: 'bg-purple-100',
      iconColor: 'text-purple-600',
    },
  ]

  if (isLoading && !stats) {
    return (
      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {items.map((it) => (
          <Card key={it.key}>
            <CardContent className="flex items-center gap-3 p-4">
              <Skeleton className="h-10 w-10 rounded-lg" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-5 w-12" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
      {items.map((it) => {
        const Icon = it.icon
        return (
          <Card key={it.key}>
            <CardContent className="flex items-center gap-3 p-4">
              <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${it.iconBg}`}>
                <Icon className={`h-5 w-5 ${it.iconColor}`} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-muted-foreground">{it.label}</p>
                <p className="text-xl font-bold leading-tight">{it.value}</p>
              </div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
