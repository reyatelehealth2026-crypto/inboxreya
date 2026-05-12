'use client'

import { useMemo } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  AlertCircle,
  BarChart3,
  Calendar,
  Eye,
  ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  Tag,
  Users,
  Video,
  XCircle,
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useCancelBroadcast, useSendBroadcast } from '@/hooks/use-broadcasts'
import { useToast } from '@/hooks/use-toast'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { cn } from '@/lib/utils'
import type { Campaign, CampaignStatus } from '@/hooks/use-campaigns'
import { CAMPAIGN_STATUS_META, CAMPAIGN_MESSAGE_TYPE_META } from './CampaignCard'

interface CampaignDetailSheetProps {
  open: boolean
  campaign: Campaign | null
  onOpenChange: (open: boolean) => void
}

type LineMessage =
  | { type: 'text'; text?: string }
  | { type: 'image'; originalContentUrl?: string; previewImageUrl?: string }
  | { type: 'video'; originalContentUrl?: string; previewImageUrl?: string }
  | { type: 'flex'; altText?: string; contents?: unknown }
  | { type: string; [key: string]: unknown }

function isFlexMessage(msg: LineMessage): msg is { type: 'flex'; altText?: string; contents?: any } {
  return msg.type === 'flex' && !!(msg as any).contents
}

export function CampaignDetailSheet({ open, campaign, onOpenChange }: CampaignDetailSheetProps) {
  const { toast } = useToast()
  const cancelBroadcast = useCancelBroadcast()
  const sendBroadcast = useSendBroadcast()

  const status = campaign ? CAMPAIGN_STATUS_META[campaign.status as CampaignStatus] : null
  const messageMeta = campaign
    ? CAMPAIGN_MESSAGE_TYPE_META[campaign.messageType] || CAMPAIGN_MESSAGE_TYPE_META.text
    : null

  const messages = useMemo(() => (campaign?.messages || []) as LineMessage[], [campaign])

  const canSendNow = campaign ? campaign.status === 'draft' || campaign.status === 'scheduled' : false
  const canCancel = canSendNow

  const successRate =
    campaign && campaign.totalRecipients > 0
      ? Math.round((campaign.deliveredCount / campaign.totalRecipients) * 100)
      : 0
  const readRate =
    campaign && campaign.totalRecipients > 0
      ? Math.round((campaign.readCount / campaign.totalRecipients) * 100)
      : 0

  const handleCancel = async () => {
    if (!campaign) return
    try {
      await cancelBroadcast.mutateAsync(campaign.id)
      toast({ title: 'ยกเลิก Campaign สำเร็จ' })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง'
      toast({ title: 'ยกเลิกไม่สำเร็จ', description: message, variant: 'destructive' })
    }
  }

  const handleSendNow = async () => {
    if (!campaign) return
    try {
      await sendBroadcast.mutateAsync(campaign.id)
      toast({ title: 'ส่ง Campaign สำเร็จ' })
      onOpenChange(false)
    } catch (error) {
      const message = error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง'
      toast({ title: 'ส่งไม่สำเร็จ', description: message, variant: 'destructive' })
    }
  }

  if (!campaign || !status || !messageMeta) return null

  const StatusIcon = status.Icon
  const MessageIcon = messageMeta.Icon

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1 space-y-1">
                <DialogTitle className="truncate text-xl">{campaign.title}</DialogTitle>
                <DialogDescription>
                  สร้างเมื่อ {format(new Date(campaign.createdAt), 'PPp', { locale: th })}
                </DialogDescription>
              </div>
            </div>
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
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          <Tabs defaultValue="messages" className="space-y-4">
            <TabsList className="grid w-full grid-cols-4">
              <TabsTrigger value="messages">
                <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                ข้อความ
              </TabsTrigger>
              <TabsTrigger value="audience">
                <Users className="mr-1.5 h-3.5 w-3.5" />
                กลุ่ม
              </TabsTrigger>
              <TabsTrigger value="schedule">
                <Calendar className="mr-1.5 h-3.5 w-3.5" />
                เวลา
              </TabsTrigger>
              <TabsTrigger value="stats">
                <BarChart3 className="mr-1.5 h-3.5 w-3.5" />
                สถิติ
              </TabsTrigger>
            </TabsList>

            <TabsContent value="messages" className="space-y-3">
              {messages.length === 0 ? (
                <Card>
                  <CardContent className="flex items-center justify-center gap-2 p-6 text-sm text-muted-foreground">
                    <AlertCircle className="h-4 w-4" />
                    ไม่พบข้อมูลข้อความ
                  </CardContent>
                </Card>
              ) : (
                messages.map((msg, idx) => (
                  <Card key={idx}>
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Badge variant="outline">ข้อความที่ {idx + 1}</Badge>
                        <span className="capitalize">{msg.type}</span>
                      </div>

                      {msg.type === 'text' ? (
                        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-tl-sm bg-[#06C755] p-4 text-sm text-white">
                          {(msg as { text?: string }).text || '(ไม่มีข้อความ)'}
                        </div>
                      ) : isFlexMessage(msg) ? (
                        <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
                          <FlexPreview flex={msg as any} />
                        </div>
                      ) : msg.type === 'image' ? (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          <ImageIcon className="h-4 w-4" />
                          {(msg as { originalContentUrl?: string }).originalContentUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={(msg as { originalContentUrl?: string }).originalContentUrl}
                              alt={`message ${idx + 1}`}
                              className="max-h-60 rounded-lg object-contain"
                            />
                          ) : (
                            <span>ไม่มี URL รูปภาพ</span>
                          )}
                        </div>
                      ) : msg.type === 'video' ? (
                        <div className="flex items-center gap-2 rounded-lg border border-dashed p-3 text-sm text-muted-foreground">
                          <Video className="h-4 w-4" />
                          {(msg as { originalContentUrl?: string }).originalContentUrl ? (
                            <a
                              href={(msg as { originalContentUrl?: string }).originalContentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary underline-offset-4 hover:underline"
                            >
                              เปิดวิดีโอ
                            </a>
                          ) : (
                            <span>ไม่มี URL วิดีโอ</span>
                          )}
                        </div>
                      ) : (
                        <div className="rounded-lg border border-dashed p-3 text-xs text-muted-foreground">
                          ประเภทข้อความที่ไม่รองรับการแสดงผล: {msg.type}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>

            <TabsContent value="audience" className="space-y-3">
              <Card>
                <CardContent className="space-y-3 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">โหมดกลุ่มเป้าหมาย</span>
                    <span className="font-medium">
                      {campaign.targetMode === 'all'
                        ? 'ลูกค้าทั้งหมด'
                        : campaign.targetMode === 'tags'
                        ? 'เลือกตาม Tag'
                        : campaign.targetMode === 'segment'
                        ? 'Segment'
                        : 'รายบุคคล'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">จำนวนผู้รับ</span>
                    <span className="font-semibold">{campaign.totalRecipients.toLocaleString()} คน</span>
                  </div>
                </CardContent>
              </Card>
              {campaign.tags.length > 0 ? (
                <Card>
                  <CardContent className="space-y-2 p-4">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Tag className="h-3.5 w-3.5" />
                      Tags ({campaign.tags.length})
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {campaign.tags.map((tag) => (
                        <Badge
                          key={tag.id}
                          variant="outline"
                          className="font-normal"
                          style={{ borderColor: tag.color, color: tag.color }}
                        >
                          {tag.name}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </TabsContent>

            <TabsContent value="schedule" className="space-y-3">
              <Card>
                <CardContent className="space-y-3 p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">วันเวลาส่ง</span>
                    <span className="font-medium">
                      {campaign.scheduledAt
                        ? format(new Date(campaign.scheduledAt), 'PPPp', { locale: th })
                        : 'ส่งทันทีเมื่อสร้าง'}
                    </span>
                  </div>
                  {campaign.sentAt ? (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">ส่งเมื่อ</span>
                      <span className="font-medium">
                        {format(new Date(campaign.sentAt), 'PPPp', { locale: th })}
                      </span>
                    </div>
                  ) : null}
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">สร้างเมื่อ</span>
                    <span className="font-medium">
                      {format(new Date(campaign.createdAt), 'PPPp', { locale: th })}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="stats" className="space-y-3">
              <Card>
                <CardContent className="space-y-4 p-4">
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">ส่งสำเร็จ</span>
                      <span className="font-medium">
                        {campaign.deliveredCount.toLocaleString()} / {campaign.totalRecipients.toLocaleString()} ({successRate}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500 transition-all"
                        style={{ width: `${successRate}%` }}
                      />
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 flex justify-between text-xs">
                      <span className="text-muted-foreground">อ่านแล้ว</span>
                      <span className="font-medium">
                        {campaign.readCount.toLocaleString()} / {campaign.totalRecipients.toLocaleString()} ({readRate}%)
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all"
                        style={{ width: `${readRate}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </ScrollArea>

        {sendBroadcast.progress ? (
          <div className="border-t bg-blue-50 px-6 py-3">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <Loader2 className="h-4 w-4 animate-spin" />
              กำลังส่ง {sendBroadcast.progress.sent.toLocaleString()} / {sendBroadcast.progress.total.toLocaleString()} คน
            </div>
          </div>
        ) : null}

        <DialogFooter className="gap-2 border-t px-6 py-4 sm:justify-end">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            <Eye className="mr-2 h-4 w-4" />
            ปิด
          </Button>
          {canCancel ? (
            <Button
              variant="outline"
              onClick={handleCancel}
              disabled={cancelBroadcast.isPending}
              className="text-destructive hover:text-destructive"
            >
              <XCircle className="mr-2 h-4 w-4" />
              ยกเลิก
            </Button>
          ) : null}
          {canSendNow ? (
            <Button onClick={handleSendNow} disabled={sendBroadcast.isPending}>
              {sendBroadcast.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              ส่งทันที
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
