'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  AlertCircle,
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Loader2,
  MessageSquare,
  Send,
  Tag,
  Users,
} from 'lucide-react'
import { BroadcastTemplate, CreateBroadcastInput, FlexMessage } from '@/types/broadcast'
import {
  useBroadcastRecipientEstimate,
  useBroadcastTemplates,
  useCreateBroadcast,
  useSendBroadcast,
} from '@/hooks/use-broadcasts'
import { useTags } from '@/hooks/use-tags'
import { useToast } from '@/hooks/use-toast'
import { TemplateSelector } from './TemplateSelector'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Form } from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

const createBroadcastSchema = z.object({
  targetSegmentId: z.number().optional(),
  targetCustomerIds: z.array(z.number()).optional(),
  targetTagIds: z.array(z.number()).optional(),
})

type CreateBroadcastForm = z.infer<typeof createBroadcastSchema>

interface CreateBroadcastDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateBroadcastDialog({
  open,
  onOpenChange,
  onSuccess,
}: CreateBroadcastDialogProps) {
  const [step, setStep] = useState(1)
  const [selectedTemplate, setSelectedTemplate] = useState<BroadcastTemplate | null>(null)
  const [customFlexContent, setCustomFlexContent] = useState('')
  const [customFlexError, setCustomFlexError] = useState<string | null>(null)
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [targetMode, setTargetMode] = useState<'all' | 'tags'>('all')
  const [tagSearch, setTagSearch] = useState('')

  const { toast } = useToast()
  const { data: templatesData } = useBroadcastTemplates()
  const { data: tagsData, isLoading: isTagsLoading } = useTags()
  const createBroadcast = useCreateBroadcast()
  const sendBroadcast = useSendBroadcast()

  const templates = templatesData?.data || []
  const tags = Array.isArray(tagsData) ? tagsData : []
  const sendNow = sendMode === 'now'
  const isSubmitting = createBroadcast.isPending || sendBroadcast.isPending
  const isCustomFlexSelected = selectedTemplate?.id === -1
  const isSubmissionSupported = !!selectedTemplate
  const totalSteps = 3

  const form = useForm<CreateBroadcastForm>({
    resolver: zodResolver(createBroadcastSchema),
    defaultValues: {
      targetCustomerIds: [],
      targetTagIds: [],
    },
  })

  const selectedTagIds = form.watch('targetTagIds') || []
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(Number(tag.id)))
  const filteredTags = tags.filter((tag) => {
    const search = tagSearch.trim().toLowerCase()
    if (!search) return true

    const haystack = [tag.name, tag.description]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()

    return haystack.includes(search)
  })
  const isTargetSelectionValid = targetMode === 'all' || selectedTagIds.length > 0
  const scheduledDateTime = !sendNow && scheduledDate
    ? new Date(`${scheduledDate}T${scheduledTime}`)
    : null
  const hasValidScheduledDateTime = !scheduledDateTime
    ? false
    : !Number.isNaN(scheduledDateTime.getTime()) && scheduledDateTime > new Date()
  const shouldEstimateRecipients = open && step >= 2 && (targetMode === 'all' || selectedTagIds.length > 0)

  const {
    data: recipientEstimateData,
    isLoading: isRecipientEstimateLoading,
    error: recipientEstimateError,
  } = useBroadcastRecipientEstimate(
    {
      targetTagIds: targetMode === 'tags' ? selectedTagIds : undefined,
    },
    { enabled: shouldEstimateRecipients }
  )

  const recipientEstimate = recipientEstimateData?.data?.totalRecipients ?? null
  const hasRecipientEstimate = recipientEstimate !== null
  const canSubmit = !isSubmitting
    && isSubmissionSupported
    && isTargetSelectionValid
    && (sendNow || hasValidScheduledDateTime)
    && !isRecipientEstimateLoading
    && !recipientEstimateError
    && hasRecipientEstimate
    && recipientEstimate > 0

  const toggleTargetTag = (tagId: number) => {
    const nextTargetTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]

    form.setValue('targetTagIds', nextTargetTagIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const resetForm = () => {
    setStep(1)
    setSelectedTemplate(null)
    setCustomFlexContent('')
    setCustomFlexError(null)
    setSendMode('now')
    setScheduledDate('')
    setScheduledTime('09:00')
    setTargetMode('all')
    setTagSearch('')
    form.reset()
  }

  const moveToNextStep = () => {
    if (step === 1) {
      if (!isSubmissionSupported) return
      setStep(2)
      return
    }

    if (step === 2) {
      if (!isTargetSelectionValid) return
      setStep(3)
    }
  }

  const onSubmit = async () => {
    if (step < totalSteps) {
      moveToNextStep()
      return
    }

    if (!isSubmissionSupported) {
      setCustomFlexError('กรุณาเลือก template หรือ custom flex ก่อนส่ง broadcast')
      return
    }

    if (isRecipientEstimateLoading) {
      toast({
        title: 'กำลังคำนวณจำนวนผู้รับ',
        description: 'กรุณารอสักครู่แล้วค่อยยืนยันอีกครั้ง',
        variant: 'destructive',
      })
      return
    }

    if (recipientEstimateError) {
      toast({
        title: 'ไม่สามารถตรวจสอบจำนวนผู้รับได้',
        description: recipientEstimateError instanceof Error ? recipientEstimateError.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
      return
    }

    if (!hasRecipientEstimate || recipientEstimate <= 0) {
      toast({
        title: 'ไม่พบผู้รับสำหรับ Broadcast นี้',
        description: 'กรุณาตรวจสอบกลุ่มเป้าหมายก่อนยืนยันส่ง',
        variant: 'destructive',
      })
      return
    }

    if (!sendNow) {
      if (!scheduledDateTime || Number.isNaN(scheduledDateTime.getTime())) {
        toast({
          title: 'กรุณาเลือกวันและเวลาที่ต้องการส่ง',
          variant: 'destructive',
        })
        return
      }

      if (scheduledDateTime <= new Date()) {
        toast({
          title: 'เวลาที่ตั้งต้องมากกว่าปัจจุบัน',
          description: 'กรุณาเลือกวันหรือเวลาส่งใหม่อีกครั้ง',
          variant: 'destructive',
        })
        return
      }
    }

    const input: CreateBroadcastInput = {
      templateId: selectedTemplate?.sourceId,
      templateSourceTable: selectedTemplate?.sourceTable,
      messageType: selectedTemplate?.category,
      scheduledAt: sendNow ? undefined : scheduledDateTime?.toISOString(),
    }

    if (isCustomFlexSelected) {
      try {
        const flexContent: FlexMessage = JSON.parse(customFlexContent)
        input.flexContent = flexContent
        input.content = flexContent.altText || 'Flex Message'
        input.messageType = 'flex'
      } catch {
        setCustomFlexError('JSON ไม่ถูกต้อง')
        return
      }
    } else if (selectedTemplate) {
      if (selectedTemplate.flexContent) {
        input.flexContent = selectedTemplate.flexContent
      }

      if (selectedTemplate.content) {
        input.content = selectedTemplate.content
      }

      if (selectedTemplate.mediaUrl) {
        input.mediaUrl = selectedTemplate.mediaUrl

        if (!input.content) {
          input.content = selectedTemplate.description || selectedTemplate.name || `[${selectedTemplate.category} broadcast]`
        }
      }
    }

    if (targetMode === 'tags') {
      input.targetTagIds = selectedTagIds
    }

    try {
      const response = await createBroadcast.mutateAsync(input)
      const broadcastId = response?.data?.id

      if (sendNow && broadcastId) {
        await sendBroadcast.mutateAsync(broadcastId)
      }

      toast({
        title: sendNow ? 'ส่ง Broadcast สำเร็จ' : 'บันทึก Broadcast ตามเวลาสำเร็จ',
      })
      onOpenChange(false)
      onSuccess?.()
      resetForm()
    } catch (error) {
      console.error('Failed to create/send broadcast:', error)
      toast({
        title: 'ส่ง Broadcast ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">สร้าง Broadcast ใหม่</DialogTitle>
              <DialogDescription>
                ส่งข้อความถึงลูกค้าหลายคนพร้อมกัน
              </DialogDescription>
            </div>

            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, index) => (
                <div
                  key={index}
                  className={cn(
                    'flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium transition-colors',
                    step > index + 1
                      ? 'bg-primary text-primary-foreground'
                      : step === index + 1
                      ? 'border-2 border-primary bg-primary/10 text-primary'
                      : 'bg-muted text-muted-foreground'
                  )}
                >
                  {step > index + 1 ? '✓' : index + 1}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex h-full flex-col">
            <ScrollArea className="flex-1 px-6 py-4">
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <MessageSquare className="h-4 w-4" />
                    เลือก template หรือสร้าง custom flex
                  </h3>

                  <TemplateSelector
                    templates={templates}
                    selectedTemplateId={selectedTemplate?.id}
                    onSelect={setSelectedTemplate}
                  />

                  {selectedTemplate?.id === -1 && (
                    <Card className="mt-4">
                      <CardContent className="space-y-4 p-4">
                        <label className="text-sm font-medium">Flex Message JSON</label>
                        <Textarea
                          value={customFlexContent}
                          onChange={(event) => {
                            setCustomFlexContent(event.target.value)
                            setCustomFlexError(null)

                            try {
                              JSON.parse(event.target.value)
                            } catch {
                              setCustomFlexError('JSON ไม่ถูกต้อง')
                            }
                          }}
                          placeholder={`{\n  "type": "flex",\n  "altText": "ข้อความ",\n  "contents": {\n    "type": "bubble"\n  }\n}`}
                          className="min-h-[200px] font-mono text-sm"
                        />

                        {customFlexError && (
                          <div className="flex items-center gap-2 text-sm text-destructive">
                            <AlertCircle className="h-4 w-4" />
                            {customFlexError}
                          </div>
                        )}

                        {customFlexContent && !customFlexError && (
                          <div className="mt-4">
                            <p className="mb-2 text-sm font-medium">ตัวอย่าง:</p>
                            <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
                              <FlexPreview flex={JSON.parse(customFlexContent)} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {step === 2 && (
                <div className="space-y-6">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Users className="h-4 w-4" />
                    เลือกกลุ่มเป้าหมาย
                  </h3>

                  <Tabs value={targetMode} onValueChange={(value) => setTargetMode(value as 'all' | 'tags')}>
                    <TabsList className="grid w-full grid-cols-2">
                      <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                      <TabsTrigger value="tags">Tag</TabsTrigger>
                    </TabsList>

                    <TabsContent value="all" className="space-y-4">
                      <Card>
                        <CardContent className="p-6 text-center">
                          <Users className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
                          <p className="font-medium">ส่งถึงลูกค้าทั้งหมด</p>
                          <p className="text-sm text-muted-foreground">
                            ส่งข้อความถึงลูกค้าทุกคนที่เคยติดต่อ
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="tags" className="space-y-4">
                      <Card>
                        <CardContent className="space-y-4 p-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Tag className="h-4 w-4" />
                            เลือกอย่างน้อย 1 Tag เพื่อส่ง broadcast เฉพาะกลุ่ม
                          </div>

                          <Input
                            value={tagSearch}
                            onChange={(event) => setTagSearch(event.target.value)}
                            placeholder="ค้นหา Tag จากชื่อหรือคำอธิบาย"
                          />

                          {isTagsLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              กำลังโหลด Tag...
                            </div>
                          ) : tags.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                              ยังไม่มี Tag ให้เลือก
                            </div>
                          ) : filteredTags.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                              ไม่พบ Tag ที่ตรงกับคำค้นหา
                            </div>
                          ) : (
                            <ScrollArea className="h-[280px] pr-2">
                              <div className="space-y-2">
                                {filteredTags.map((tag) => {
                                  const numericTagId = Number(tag.id)
                                  const isSelected = selectedTagIds.includes(numericTagId)

                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() => toggleTargetTag(numericTagId)}
                                      className={cn(
                                        'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors',
                                        isSelected
                                          ? 'border-primary bg-primary/5 ring-1 ring-primary'
                                          : 'hover:border-primary/40 hover:bg-muted/40'
                                      )}
                                    >
                                      <div className="flex items-center gap-3">
                                        <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                        <div>
                                          <p className="text-sm font-medium text-foreground">{tag.name}</p>
                                          <p className="text-xs text-muted-foreground">{tag.usageCount} ลูกค้า</p>
                                        </div>
                                      </div>
                                      {isSelected ? <Badge>เลือกแล้ว</Badge> : null}
                                    </button>
                                  )
                                })}
                              </div>
                            </ScrollArea>
                          )}
                        </CardContent>
                      </Card>

                      {selectedTags.length > 0 ? (
                        <Card className="bg-muted/40">
                          <CardContent className="flex flex-wrap gap-2 p-4">
                            {selectedTags.map((tag) => (
                              <Badge key={tag.id} variant="outline" style={{ borderColor: tag.color, color: tag.color }}>
                                {tag.name}
                              </Badge>
                            ))}
                          </CardContent>
                        </Card>
                      ) : null}
                    </TabsContent>
                  </Tabs>
                </div>
              )}

              {step === 3 && (
                <div className="space-y-6">
                  <h3 className="flex items-center gap-2 text-sm font-medium">
                    <Clock className="h-4 w-4" />
                    สรุปและยืนยันการส่ง
                  </h3>

                  <div className="space-y-4">
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => setSendMode('now')}
                        className={cn(
                          'rounded-xl border-2 p-4 text-left transition-all',
                          sendNow
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Send className={cn('h-4 w-4', sendNow ? 'text-primary' : 'text-muted-foreground')} />
                          <span className={cn('text-sm font-semibold', sendNow ? 'text-primary' : 'text-foreground')}>
                            ส่งทันที
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          จะสร้าง broadcast แล้วส่งทันทีหลังจากกดยืนยันปุ่มด้านล่าง
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setSendMode('scheduled')}
                        className={cn(
                          'rounded-xl border-2 p-4 text-left transition-all',
                          !sendNow
                            ? 'border-primary bg-primary/5'
                            : 'border-border hover:border-primary/40'
                        )}
                      >
                        <div className="mb-1 flex items-center gap-2">
                          <Calendar className={cn('h-4 w-4', !sendNow ? 'text-primary' : 'text-muted-foreground')} />
                          <span className={cn('text-sm font-semibold', !sendNow ? 'text-primary' : 'text-foreground')}>
                            ตั้งเวลาส่ง
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          จะบันทึกคิว broadcast และรอส่งอัตโนมัติตามวันเวลาที่กำหนด
                        </p>
                      </button>
                    </div>

                    {!sendNow && (
                      <Card className="border-border bg-muted/30">
                        <CardContent className="space-y-4 p-4">
                          <div className="space-y-2">
                            <p className="text-xs font-medium">วันที่ส่ง</p>
                            <Input
                              type="date"
                              value={scheduledDate}
                              onChange={(event) => setScheduledDate(event.target.value)}
                              min={new Date().toISOString().split('T')[0]}
                            />
                          </div>

                          <div className="space-y-2">
                            <p className="text-xs font-medium">เวลาที่ส่ง</p>
                            <Input
                              type="time"
                              value={scheduledTime}
                              onChange={(event) => setScheduledTime(event.target.value)}
                            />
                          </div>

                          {scheduledDateTime && !Number.isNaN(scheduledDateTime.getTime()) ? (
                            <div
                              className={cn(
                                'flex items-start gap-2 rounded-lg border p-3 text-xs',
                                hasValidScheduledDateTime
                                  ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                                  : 'border-amber-200 bg-amber-50 text-amber-700'
                              )}
                            >
                              <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                              <span>
                                {hasValidScheduledDateTime ? 'กำหนดส่ง:' : 'เวลาที่เลือกอยู่ในอดีต:'}{' '}
                                <strong>{format(scheduledDateTime, 'PPP p', { locale: th })}</strong>
                              </span>
                            </div>
                          ) : null}
                        </CardContent>
                      </Card>
                    )}
                  </div>

                  <Card className="border-amber-200 bg-amber-50">
                    <CardContent className="space-y-3 p-4">
                      <div className="flex items-start gap-2 text-amber-800">
                        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                        <div className="space-y-1">
                          <p className="text-sm font-medium">Broadcast จะยังไม่ถูกส่งจนกว่าจะกดปุ่มยืนยันด้านล่าง</p>
                          <p className="text-xs text-amber-700">
                            ระบบรีเช็คจำนวนผู้รับล่าสุดก่อนส่งจริง เพื่อให้คุณเห็นผลกระทบก่อนตัดสินใจ
                          </p>
                        </div>
                      </div>

                      <div className="rounded-lg border border-amber-200 bg-white/70 p-3 text-sm">
                        {isRecipientEstimateLoading ? (
                          <div className="flex items-center gap-2 text-muted-foreground">
                            <Loader2 className="h-4 w-4 animate-spin" />
                            กำลังคำนวณจำนวนผู้รับ...
                          </div>
                        ) : recipientEstimateError ? (
                          <div className="text-destructive">
                            ไม่สามารถคำนวณจำนวนผู้รับได้ในตอนนี้
                          </div>
                        ) : hasRecipientEstimate ? (
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-muted-foreground">จำนวนผู้รับล่าสุด</span>
                            <span className={cn('font-semibold', recipientEstimate > 0 ? 'text-foreground' : 'text-destructive')}>
                              {recipientEstimate.toLocaleString()} คน
                            </span>
                          </div>
                        ) : (
                          <div className="text-muted-foreground">รอเลือกกลุ่มเป้าหมายเพื่อคำนวณจำนวนผู้รับ</div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-muted">
                    <CardContent className="space-y-2 p-4">
                      <p className="font-medium">สรุป</p>
                      <div className="space-y-1 text-sm">
                        <p>
                          <span className="text-muted-foreground">Template:</span>{' '}
                          {selectedTemplate?.name || 'Broadcast'}
                        </p>
                        <p>
                          <span className="text-muted-foreground">กลุ่มเป้าหมาย:</span>{' '}
                          {targetMode === 'tags'
                            ? selectedTags.length > 0
                              ? selectedTags.map((tag) => tag.name).join(', ')
                              : 'ยังไม่ได้เลือก Tag'
                            : 'ลูกค้าทั้งหมด'}
                        </p>
                        <p>
                          <span className="text-muted-foreground">เวลาส่ง:</span>{' '}
                          {sendNow
                            ? 'ส่งทันที'
                            : scheduledDateTime && !Number.isNaN(scheduledDateTime.getTime())
                            ? format(scheduledDateTime, 'PPP p', { locale: th })
                            : 'ยังไม่ได้เลือกวันเวลา'}
                        </p>
                        <p>
                          <span className="text-muted-foreground">จำนวนผู้รับล่าสุด:</span>{' '}
                          {isRecipientEstimateLoading
                            ? 'กำลังคำนวณ...'
                            : hasRecipientEstimate
                            ? `${recipientEstimate.toLocaleString()} คน`
                            : 'ยังไม่พร้อม'}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="gap-2 border-t px-6 py-4">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                >
                  <ChevronLeft className="mr-2 h-4 w-4" />
                  ย้อนกลับ
                </Button>
              )}

              {step < totalSteps ? (
                <Button
                  type="button"
                  onClick={moveToNextStep}
                  disabled={(step === 1 && !isSubmissionSupported) || (step === 2 && !isTargetSelectionValid)}
                >
                  ถัดไป
                  <ChevronRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button type="submit" disabled={!canSubmit}>
                  {isSubmitting ? (
                    <>กำลังดำเนินการ...</>
                  ) : sendNow ? (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      {hasRecipientEstimate ? `ยืนยันส่ง Broadcast (${recipientEstimate.toLocaleString()} คน)` : 'ยืนยันส่ง Broadcast'}
                    </>
                  ) : (
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      {hasRecipientEstimate ? `ยืนยันตั้งเวลา Broadcast (${recipientEstimate.toLocaleString()} คน)` : 'ยืนยันตั้งเวลา Broadcast'}
                    </>
                  )}
                </Button>
              )}
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  )
}
