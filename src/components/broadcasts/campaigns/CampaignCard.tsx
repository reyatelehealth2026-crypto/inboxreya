'use client'

import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  Calendar,
  CheckCircle2,
  Clock,
  Eye,
  ImageIcon,
  Layers,
  Loader2,
  MessageSquareText,
  MoreVertical,
  Send,
  Users,
  Video,
  XCircle,
} from 'lucide-react'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { cn } from '@/lib/utils'
import type { Campaign, CampaignStatus } from '@/hooks/use-campaigns'

interface StatusMeta {
  label: string
  badgeClass: string
  borderClass: string
  Icon: typeof Clock
  spin?: boolean
}

const STATUS_META: Record<CampaignStatus, StatusMeta> = {
  draft: {
    label: 'ฉบับร่าง',
    badgeClass: 'bg-gray-100 text-gray-700 border-gray-200',
    borderClass: 'border-gray-200',
    Icon: Clock,
  },
  scheduled: {
    label: 'ตั้งเวลา',
    badgeClass: 'bg-blue-100 text-blue-700 border-blue-200',
    borderClass: 'border-blue-200',
    Icon: Calendar,
  },
  sending: {
    label: 'กำลังส่ง',
    badgeClass: 'bg-amber-100 text-amber-700 border-amber-200',
    borderClass: 'border-amber-200',
    Icon: Loader2,
    spin: true,
  },
  sent: {
    label: 'ส่งแล้ว',
    badgeClass: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    borderClass: 'border-emerald-200',
    Icon: CheckCircle2,
  },
  failed: {
    label: 'ล้มเหลว',
    badgeClass: 'bg-red-100 text-red-700 border-red-200',
    borderClass: 'border-red-200',
    Icon: XCircle,
  },
  cancelled: {
    label: 'ยกเลิก',
    badgeClass: 'bg-gray-100 text-gray-500 border-gray-200',
    borderClass: 'border-gray-200',
    Icon: XCircle,
  },
}

const MESSAGE_TYPE_META: Record<Campaign['messageType'], { label: string; Icon: typeof MessageSquareText }> = {
  text: { label: 'Text', Icon: MessageSquareText },
  image: { label: 'Image', Icon: ImageIcon },
  video: { label: 'Video', Icon: Video },
  flex: { label: 'Flex', Icon: Layers },
  multi: { label: 'Multi', Icon: Layers },
}

interface CampaignCardProps {
  campaign: Campaign
  onOpen: (campaign: Campaign) => void
  onCancel: (campaign: Campaign) => void
  onSendNow: (campaign: Campaign) => void
  isCancelling?: boolean
  isSending?: boolean
}

export function CampaignCard({
  campaign,
  onOpen,
  onCancel,
  onSendNow,
  isCancelling,
  isSending,
}: CampaignCardProps) {
  const status = STATUS_META[campaign.status]
  const StatusIcon = status.Icon
  const messageMeta = MESSAGE_TYPE_META[campaign.messageType] || MESSAGE_TYPE_META.text
  const MessageIcon = messageMeta.Icon

  const successRate =
    campaign.totalRecipients > 0
      ? Math.round((campaign.deliveredCount / campaign.totalRecipients) * 100)
      : 0

  const canSendNow = campaign.status === 'draft' || campaign.status === 'scheduled'
  const canCancel = campaign.status === 'draft' || campaign.status === 'scheduled'
  const showProgress = campaign.status === 'sent' || campaign.status === 'sending'

  const stopPropagation = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => onOpen(campaign)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onOpen(campaign)
        }
      }}
      className={cn(
        'group relative cursor-pointer overflow-hidden border transition-all hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/30',
        status.borderClass
      )}
    >
      <CardHeader className="space-y-2 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1 space-y-1">
            <h3 className="truncate font-semibold leading-tight">{campaign.title}</h3>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={cn('gap-1', status.badgeClass)}>
                <StatusIcon className={cn('h-3 w-3', status.spin && 'animate-spin')} />
                {status.label}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <MessageIcon className="h-3 w-3" />
                {messageMeta.label}
                {campaign.messageCount > 1 ? ` × ${campaign.messageCount}` : null}
              </Badge>
            </div>
          </div>

          <div onClick={stopPropagation}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => onOpen(campaign)}>
                  <Eye className="mr-2 h-4 w-4" />
                  ดูรายละเอียด
                </DropdownMenuItem>
                {canSendNow ? (
                  <DropdownMenuItem onClick={() => onSendNow(campaign)} disabled={isSending}>
                    <Send className="mr-2 h-4 w-4" />
                    ส่งทันที
                  </DropdownMenuItem>
                ) : null}
                {canCancel ? (
                  <>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => onCancel(campaign)}
                      disabled={isCancelling}
                      className="text-destructive focus:text-destructive"
                    >
                      <XCircle className="mr-2 h-4 w-4" />
                      ยกเลิก
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 pb-4 pt-0">
        {/* Audience */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            กลุ่มเป้าหมาย:
          </span>
          {campaign.targetMode === 'all' ? (
            <Badge variant="secondary" className="font-normal">ลูกค้าทั้งหมด</Badge>
          ) : campaign.tags.length > 0 ? (
            campaign.tags.slice(0, 4).map((tag) => (
              <Badge
                key={tag.id}
                variant="outline"
                className="font-normal"
                style={{ borderColor: tag.color, color: tag.color }}
              >
                {tag.name}
              </Badge>
            ))
          ) : (
            <Badge variant="secondary" className="font-normal">ไม่ระบุ</Badge>
          )}
          {campaign.tags.length > 4 ? (
            <span className="text-xs text-muted-foreground">+{campaign.tags.length - 4}</span>
          ) : null}
        </div>

        {/* Schedule */}
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="inline-flex items-center gap-1 text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            {campaign.scheduledAt ? (
              <span>
                {campaign.status === 'sent' && campaign.sentAt
                  ? `ส่งเมื่อ ${format(new Date(campaign.sentAt), 'd MMM yy HH:mm', { locale: th })}`
                  : `${format(new Date(campaign.scheduledAt), 'd MMM yy HH:mm', { locale: th })}`}
              </span>
            ) : campaign.sentAt ? (
              <span>ส่งเมื่อ {format(new Date(campaign.sentAt), 'd MMM yy HH:mm', { locale: th })}</span>
            ) : (
              <span>สร้าง {format(new Date(campaign.createdAt), 'd MMM yy', { locale: th })}</span>
            )}
          </div>
          <div className="inline-flex items-center gap-1 text-muted-foreground">
            <Users className="h-3.5 w-3.5" />
            <span>{campaign.totalRecipients.toLocaleString()} คน</span>
          </div>
        </div>

        {/* Progress */}
        {showProgress ? (
          <div className="space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-muted-foreground">ส่งสำเร็จ</span>
              <span className="font-medium">
                {campaign.deliveredCount.toLocaleString()} / {campaign.totalRecipients.toLocaleString()} ({successRate}%)
              </span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${successRate}%` }}
              />
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}

export { STATUS_META as CAMPAIGN_STATUS_META, MESSAGE_TYPE_META as CAMPAIGN_MESSAGE_TYPE_META }
