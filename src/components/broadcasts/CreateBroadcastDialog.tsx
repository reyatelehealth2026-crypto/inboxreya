'use client'

import { useMemo, useState } from 'react'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock,
  Eye,
  ImageIcon,
  Loader2,
  MessageSquare,
  Send,
  Settings2,
  Tag,
  Users,
  Video,
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
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

type Step = 'settings' | 'preview' | 'tags' | 'schedule' | 'confirm'

const STEPS: { key: Step; label: string; icon: typeof Settings2 }[] = [
  { key: 'settings', label: 'ตั้งค่า', icon: Settings2 },
  { key: 'preview', label: 'Preview', icon: Eye },
  { key: 'tags', label: 'Tags', icon: Tag },
  { key: 'schedule', label: 'กำหนดเวลา', icon: Calendar },
  { key: 'confirm', label: 'ยืนยัน', icon: CheckCircle2 },
]

interface ResultState {
  success: boolean
  mode: 'now' | 'scheduled'
  recipientCount: number
  scheduledAt?: string
  error?: string
}

interface CreateBroadcastDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateBroadcastDialog({ open, onOpenChange, onSuccess }: CreateBroadcastDialogProps) {
  const [step, setStep] = useState<Step>('settings')
  const [selectedTemplate, setSelectedTemplate] = useState<BroadcastTemplate | null>(null)
  const [customFlexContent, setCustomFlexContent] = useState('')
  const [customFlexError, setCustomFlexError] = useState<string | null>(null)
  const [targetMode, setTargetMode] = useState<'all' | 'tags'>('all')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [result, setResult] = useState<ResultState | null>(null)

  const { toast } = useToast()
  const { data: templatesData } = useBroadcastTemplates()
  const { data: tagsData, isLoading: isTagsLoading } = useTags()
  const createBroadcast = useCreateBroadcast()
  const sendBroadcast = useSendBroadcast()

  const templates = templatesData?.data || []
  const tags = Array.isArray(tagsData) ? tagsData : []
  const stepIndex = STEPS.findIndex((item) => item.key === step)
  const isSubmitting = createBroadcast.isPending || sendBroadcast.isPending
  const isCustomFlexSelected = selectedTemplate?.id === -1
  const sendNow = sendMode === 'now'

  const parsedCustomFlex = useMemo(() => {
    if (!isCustomFlexSelected || !customFlexContent.trim()) return null
    try {
      const parsed = JSON.parse(customFlexContent) as Partial<FlexMessage>
      return parsed.type === 'flex' && parsed.contents ? parsed as FlexMessage : null
    } catch {
      return null
    }
  }, [customFlexContent, isCustomFlexSelected])

  const filteredTags = tags.filter((tag) => {
    const search = tagSearch.trim().toLowerCase()
    if (!search) return true
    const haystack = [tag.name, tag.description].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search)
  })
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(Number(tag.id)))
  const scheduledDateTime = !sendNow && scheduledDate ? new Date(`${scheduledDate}T${scheduledTime}`) : null
  const hasValidScheduledDateTime = !!scheduledDateTime
    && !Number.isNaN(scheduledDateTime.getTime())
    && scheduledDateTime > new Date()

  const isSettingsValid = !!selectedTemplate && (!isCustomFlexSelected || !!parsedCustomFlex)
  const isTargetValid = targetMode === 'all' || selectedTagIds.length > 0
  const isScheduleValid = sendNow || hasValidScheduledDateTime
  const shouldEstimate = open
    && ['tags', 'schedule', 'confirm'].includes(step)
    && (targetMode === 'all' || selectedTagIds.length > 0)

  const {
    data: estimateData,
    isLoading: isEstimateLoading,
    error: estimateError,
  } = useBroadcastRecipientEstimate(
    { targetTagIds: targetMode === 'tags' ? selectedTagIds : undefined },
    { enabled: shouldEstimate }
  )

  const recipientEstimate = estimateData?.data?.totalRecipients ?? null
  const hasRecipientEstimate = recipientEstimate !== null
  const canConfirm = !isSubmitting
    && isSettingsValid
    && isTargetValid
    && isScheduleValid
    && !isEstimateLoading
    && !estimateError
    && hasRecipientEstimate
    && recipientEstimate > 0
    && !result?.success

  const resetForm = () => {
    setStep('settings')
    setSelectedTemplate(null)
    setCustomFlexContent('')
    setCustomFlexError(null)
    setTargetMode('all')
    setSelectedTagIds([])
    setTagSearch('')
    setSendMode('now')
    setScheduledDate('')
    setScheduledTime('09:00')
    setResult(null)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleCustomFlexChange = (value: string) => {
    setCustomFlexContent(value)
    setResult(null)
    if (!value.trim()) {
      setCustomFlexError(null)
      return
    }
    try {
      const parsed = JSON.parse(value) as Partial<FlexMessage>
      setCustomFlexError(parsed.type === 'flex' && parsed.contents ? null : 'JSON ต้องเป็น Flex Message')
    } catch {
      setCustomFlexError('JSON ไม่ถูกต้อง')
    }
  }

  const toggleTargetTag = (tagId: number) => {
    setSelectedTagIds((current) => current.includes(tagId)
      ? current.filter((id) => id !== tagId)
      : [...current, tagId]
    )
    setResult(null)
  }

  const canGoNext = step === 'settings' ? isSettingsValid
    : step === 'preview' ? isSettingsValid
    : step === 'tags' ? isTargetValid
    : step === 'schedule' ? isScheduleValid
    : false

  const goNext = () => {
    if (!canGoNext) return
    const next = STEPS[stepIndex + 1]
    if (next) setStep(next.key)
  }

  const goPrev = () => {
    if (result?.success) return
    const prev = STEPS[stepIndex - 1]
    if (prev) setStep(prev.key)
  }

  const handleConfirm = async () => {
    setResult(null)

    if (!isSettingsValid) {
      toast({ title: 'กรุณาเลือก template ก่อน', description: 'หากใช้ Custom Flex ต้องกรอก JSON ให้ถูกต้อง', variant: 'destructive' })
      return
    }
    if (!isTargetValid) {
      toast({ title: 'กรุณาเลือกกลุ่มเป้าหมายก่อน', variant: 'destructive' })
      return
    }
    if (isEstimateLoading) {
      toast({ title: 'กำลังคำนวณจำนวนผู้รับ', description: 'กรุณารอสักครู่แล้วค่อยยืนยันอีกครั้ง', variant: 'destructive' })
      return
    }
    if (estimateError) {
      toast({
        title: 'ไม่สามารถตรวจสอบจำนวนผู้รับได้',
        description: estimateError instanceof Error ? estimateError.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
      return
    }
    if (!hasRecipientEstimate || recipientEstimate <= 0) {
      toast({ title: 'ไม่พบผู้รับสำหรับ Broadcast นี้', description: 'กรุณาตรวจสอบ tags หรือกลุ่มเป้าหมายก่อนยืนยัน', variant: 'destructive' })
      return
    }
    if (!sendNow && !hasValidScheduledDateTime) {
      toast({ title: 'วันเวลาส่งไม่ถูกต้อง', description: 'กรุณาเลือกวันเวลาที่มากกว่าปัจจุบัน', variant: 'destructive' })
      return
    }

    const input: CreateBroadcastInput = {
      templateId: selectedTemplate?.sourceId,
      templateSourceTable: selectedTemplate?.sourceTable,
      messageType: selectedTemplate?.category,
      scheduledAt: sendNow ? undefined : scheduledDateTime?.toISOString(),
      targetTagIds: targetMode === 'tags' ? selectedTagIds : undefined,
    }

    if (isCustomFlexSelected && parsedCustomFlex) {
      input.flexContent = parsedCustomFlex
      input.content = parsedCustomFlex.altText || 'Flex Message'
      input.messageType = 'flex'
    } else if (selectedTemplate) {
      if (selectedTemplate.flexContent) input.flexContent = selectedTemplate.flexContent
      if (selectedTemplate.content) input.content = selectedTemplate.content
      if (selectedTemplate.mediaUrl) {
        input.mediaUrl = selectedTemplate.mediaUrl
        if (!input.content) input.content = selectedTemplate.description || selectedTemplate.name || `[${selectedTemplate.category} broadcast]`
      }
    }

    try {
      const response = await createBroadcast.mutateAsync(input)
      const broadcastId = response?.data?.id
      if (sendNow && broadcastId) await sendBroadcast.mutateAsync(broadcastId)

      setResult({
        success: true,
        mode: sendMode,
        recipientCount: recipientEstimate,
        scheduledAt: sendNow ? undefined : scheduledDateTime?.toISOString(),
      })
      onSuccess?.()
      toast({ title: sendNow ? 'ส่ง Broadcast สำเร็จ' : 'บันทึก Broadcast ตามเวลาสำเร็จ' })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง'
      setResult({
        success: false,
        mode: sendMode,
        recipientCount: recipientEstimate,
        scheduledAt: sendNow ? undefined : scheduledDateTime?.toISOString(),
        error: message,
      })
      toast({ title: 'ส่ง Broadcast ไม่สำเร็จ', description: message, variant: 'destructive' })
    }
  }

  const renderPreview = () => {
    if (isCustomFlexSelected && parsedCustomFlex) {
      return (
        <div className="space-y-4">
          <Badge variant="outline">Custom Flex</Badge>
          <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
            <FlexPreview flex={parsedCustomFlex} />
          </div>
        </div>
      )
    }
    if (selectedTemplate?.flexContent) {
      return (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline">{selectedTemplate.name}</Badge>
            <Badge>Flex</Badge>
          </div>
          <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
            <FlexPreview flex={selectedTemplate.flexContent} />
          </div>
          {selectedTemplate.content ? <div className="rounded-lg border bg-muted/40 p-4 text-sm whitespace-pre-wrap">{selectedTemplate.content}</div> : null}
        </div>
      )
    }
    if (selectedTemplate?.category === 'image' && selectedTemplate.mediaUrl) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm"><ImageIcon className="h-4 w-4" />{selectedTemplate.name}</div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={selectedTemplate.mediaUrl} alt={selectedTemplate.name} className="w-full rounded-xl border object-cover" />
        </div>
      )
    }
    if (selectedTemplate?.category === 'video' && selectedTemplate.mediaUrl) {
      return (
        <div className="space-y-4 rounded-xl border border-dashed p-6 text-sm">
          <div className="flex items-center gap-2"><Video className="h-4 w-4" />{selectedTemplate.name}</div>
          <a href={selectedTemplate.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">เปิดลิงก์ตัวอย่าง</a>
        </div>
      )
    }
    if (selectedTemplate?.content) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 text-sm"><MessageSquare className="h-4 w-4" />{selectedTemplate.name}</div>
          <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#06C755] p-4 text-sm text-white whitespace-pre-wrap">{selectedTemplate.content}</div>
        </div>
      )
    }
    return <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">{customFlexError || 'เลือก template ในขั้นตอนแรกก่อนเพื่อดูตัวอย่าง'}</div>
  }

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden p-0 flex flex-col gap-0">
        <DialogHeader className="border-b px-6 py-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <DialogTitle className="text-xl">สร้าง Broadcast ใหม่</DialogTitle>
              <DialogDescription>flow เดียวกับ Promotions: ตั้งค่า → Preview → Tags → กำหนดเวลา → ยืนยัน</DialogDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2 lg:justify-end">
              {STEPS.map((item, index) => {
                const Icon = item.icon
                const active = item.key === step
                const done = index < stepIndex
                return (
                  <div key={item.key} className="flex items-center gap-2">
                    <div className="flex flex-col items-center gap-1">
                      <div className={cn(
                        'flex h-9 w-9 items-center justify-center rounded-full border-2 transition-colors',
                        active ? 'border-primary bg-primary text-primary-foreground' : done ? 'border-primary/40 bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground'
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <span className={cn('hidden text-[10px] font-medium sm:block', active ? 'text-primary' : done ? 'text-primary/80' : 'text-muted-foreground')}>{item.label}</span>
                    </div>
                    {index < STEPS.length - 1 ? <div className={cn('hidden h-0.5 w-6 sm:block', index < stepIndex ? 'bg-primary/50' : 'bg-border')} /> : null}
                  </div>
                )
              })}
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="min-h-0 flex-1 px-6 py-4">
          {step === 'settings' ? (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium"><Settings2 className="h-4 w-4" />ตั้งค่า Broadcast จาก Template</h3>
              <TemplateSelector templates={templates} selectedTemplateId={selectedTemplate?.id} onSelect={(template) => {
                setSelectedTemplate(template)
                if (template?.id !== -1) setCustomFlexError(null)
                setResult(null)
              }} />
              {isCustomFlexSelected ? (
                <Card>
                  <CardContent className="space-y-4 p-4">
                    <label className="text-sm font-medium">Flex Message JSON</label>
                    <Textarea
                      value={customFlexContent}
                      onChange={(event) => handleCustomFlexChange(event.target.value)}
                      placeholder={`{\n  "type": "flex",\n  "altText": "ข้อความ",\n  "contents": {\n    "type": "bubble"\n  }\n}`}
                      className="min-h-[220px] font-mono text-sm"
                    />
                    {customFlexError ? <div className="flex items-center gap-2 text-sm text-destructive"><AlertCircle className="h-4 w-4" />{customFlexError}</div> : null}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {step === 'preview' ? (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium"><Eye className="h-4 w-4" />Preview Broadcast</h3>
              <Card><CardContent className="space-y-4 p-4">{renderPreview()}</CardContent></Card>
            </div>
          ) : null}

          {step === 'tags' ? (
            <div className="space-y-6">
              <h3 className="flex items-center gap-2 text-sm font-medium"><Users className="h-4 w-4" />เลือกกลุ่มเป้าหมาย</h3>
              <Tabs value={targetMode} onValueChange={(value) => { setTargetMode(value as 'all' | 'tags'); setResult(null) }}>
                <TabsList className="grid h-auto w-full grid-cols-2 gap-2 bg-muted/50 p-1">
                  <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                  <TabsTrigger value="tags">Tags</TabsTrigger>
                </TabsList>
                <TabsContent value="all" className="space-y-4">
                  <Card><CardContent className="space-y-3 p-6 text-center"><Users className="mx-auto h-12 w-12 text-muted-foreground" /><p className="font-medium">ส่งถึงลูกค้าทั้งหมด</p><p className="text-sm text-muted-foreground">ระบบจะคำนวณจำนวนผู้รับล่าสุดก่อนให้ยืนยัน</p></CardContent></Card>
                </TabsContent>
                <TabsContent value="tags" className="space-y-4">
                  <Card>
                    <CardContent className="space-y-4 p-4">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground"><Tag className="h-4 w-4" />เลือกอย่างน้อย 1 Tag เพื่อ broadcast เฉพาะกลุ่ม</div>
                      <Input value={tagSearch} onChange={(event) => setTagSearch(event.target.value)} placeholder="ค้นหา Tag จากชื่อหรือคำอธิบาย" />
                      {isTagsLoading ? (
                        <div className="flex items-center justify-center py-10 text-sm text-muted-foreground"><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังโหลด Tag...</div>
                      ) : tags.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">ยังไม่มี Tag ให้เลือก</div>
                      ) : filteredTags.length === 0 ? (
                        <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">ไม่พบ Tag ที่ตรงกับคำค้นหา</div>
                      ) : (
                        <ScrollArea className="h-[300px] pr-2">
                          <div className="space-y-2">
                            {filteredTags.map((tag) => {
                              const numericTagId = Number(tag.id)
                              const selected = selectedTagIds.includes(numericTagId)
                              return (
                                <button
                                  key={tag.id}
                                  type="button"
                                  onClick={() => toggleTargetTag(numericTagId)}
                                  className={cn('flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors', selected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/40 hover:bg-muted/40')}
                                >
                                  <div className="flex items-center gap-3">
                                    <div className="h-3 w-3 rounded-full" style={{ backgroundColor: tag.color }} />
                                    <div><p className="text-sm font-medium">{tag.name}</p><p className="text-xs text-muted-foreground">{tag.usageCount} ลูกค้า</p></div>
                                  </div>
                                  {selected ? <Badge>เลือกแล้ว</Badge> : null}
                                </button>
                              )
                            })}
                          </div>
                        </ScrollArea>
                      )}
                    </CardContent>
                  </Card>
                  {selectedTags.length > 0 ? (
                    <Card className="bg-muted/40"><CardContent className="flex flex-wrap gap-2 p-4">{selectedTags.map((tag) => <Badge key={tag.id} variant="outline" style={{ borderColor: tag.color, color: tag.color }}>{tag.name}</Badge>)}</CardContent></Card>
                  ) : null}
                </TabsContent>
              </Tabs>
              <Card className="bg-muted/40">
                <CardContent className="space-y-2 p-4 text-sm">
                  <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">กลุ่มเป้าหมาย</span><span className="font-medium">{targetMode === 'all' ? 'ลูกค้าทั้งหมด' : selectedTags.length > 0 ? `${selectedTags.length} Tag` : 'ยังไม่ได้เลือก'}</span></div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-muted-foreground">จำนวนผู้รับล่าสุด</span>
                    {isEstimateLoading ? (
                      <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />กำลังคำนวณ...</span>
                    ) : estimateError ? (
                      <span className="text-destructive">ตรวจสอบไม่ได้</span>
                    ) : hasRecipientEstimate ? (
                      <span className={cn('font-semibold', recipientEstimate > 0 ? 'text-foreground' : 'text-destructive')}>{recipientEstimate.toLocaleString()} คน</span>
                    ) : (
                      <span className="text-muted-foreground">รอการเลือกกลุ่ม</span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {step === 'schedule' ? (
            <div className="space-y-6">
              <h3 className="flex items-center gap-2 text-sm font-medium"><Calendar className="h-4 w-4" />กำหนดเวลาส่ง</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <button type="button" onClick={() => { setSendMode('now'); setResult(null) }} className={cn('rounded-xl border-2 p-4 text-left transition-all', sendNow ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                  <div className="mb-1 flex items-center gap-2"><Send className={cn('h-4 w-4', sendNow ? 'text-primary' : 'text-muted-foreground')} /><span className={cn('text-sm font-semibold', sendNow ? 'text-primary' : 'text-foreground')}>ส่งทันที</span></div>
                  <p className="text-xs text-muted-foreground">ระบบจะยังไม่ส่งจนกว่าจะกดยืนยันในขั้นตอนสุดท้าย</p>
                </button>
                <button type="button" onClick={() => { setSendMode('scheduled'); setResult(null) }} className={cn('rounded-xl border-2 p-4 text-left transition-all', !sendNow ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/40')}>
                  <div className="mb-1 flex items-center gap-2"><Calendar className={cn('h-4 w-4', !sendNow ? 'text-primary' : 'text-muted-foreground')} /><span className={cn('text-sm font-semibold', !sendNow ? 'text-primary' : 'text-foreground')}>ตั้งเวลาส่ง</span></div>
                  <p className="text-xs text-muted-foreground">บันทึกคิว broadcast และรอส่งอัตโนมัติตามวันเวลาที่กำหนด</p>
                </button>
              </div>
              {!sendNow ? (
                <Card className="border-border bg-muted/30">
                  <CardContent className="space-y-4 p-4">
                    <div className="space-y-2"><p className="text-xs font-medium">วันที่ส่ง</p><Input type="date" value={scheduledDate} onChange={(event) => setScheduledDate(event.target.value)} min={new Date().toISOString().split('T')[0]} /></div>
                    <div className="space-y-2"><p className="text-xs font-medium">เวลาที่ส่ง</p><Input type="time" value={scheduledTime} onChange={(event) => setScheduledTime(event.target.value)} /></div>
                    {scheduledDateTime && !Number.isNaN(scheduledDateTime.getTime()) ? (
                      <div className={cn('flex items-start gap-2 rounded-lg border p-3 text-xs', hasValidScheduledDateTime ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <span>{hasValidScheduledDateTime ? 'กำหนดส่ง:' : 'เวลาที่เลือกอยู่ในอดีต:'} <strong>{format(scheduledDateTime, 'PPP p', { locale: th })}</strong></span>
                      </div>
                    ) : null}
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {step === 'confirm' ? (
            <div className="space-y-4">
              <h3 className="flex items-center gap-2 text-sm font-medium"><Clock className="h-4 w-4" />ยืนยันก่อนส่ง</h3>

              {/* Progress bar — shown while sending */}
              {sendBroadcast.progress && isSubmitting ? (
                <Card className="border-blue-200 bg-blue-50">
                  <CardContent className="space-y-3 p-4">
                    <div className="flex items-center gap-2 text-sm font-medium text-blue-700">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      กำลังส่ง {sendBroadcast.progress.sent.toLocaleString()} / {sendBroadcast.progress.total.toLocaleString()} คน
                    </div>
                    <div className="h-2.5 w-full overflow-hidden rounded-full bg-blue-100">
                      <div
                        className="h-full rounded-full bg-blue-500 transition-all duration-300"
                        style={{ width: `${sendBroadcast.progress.total > 0 ? Math.round((sendBroadcast.progress.sent / sendBroadcast.progress.total) * 100) : 0}%` }}
                      />
                    </div>
                    <div className="flex justify-between text-xs text-blue-600">
                      <span>สำเร็จ {sendBroadcast.progress.success.toLocaleString()} คน</span>
                      {sendBroadcast.progress.failed > 0 ? <span className="text-red-500">ผิดพลาด {sendBroadcast.progress.failed.toLocaleString()} คน</span> : null}
                      <span>{sendBroadcast.progress.total > 0 ? Math.round((sendBroadcast.progress.sent / sendBroadcast.progress.total) * 100) : 0}%</span>
                    </div>
                  </CardContent>
                </Card>
              ) : null}

              {result ? (
                <Card className={cn(result.success ? 'border-emerald-200 bg-emerald-50' : 'border-destructive/30 bg-destructive/5')}>
                  <CardContent className="space-y-3 p-4">
                    {result.success ? (
                      <>
                        <div className="flex items-center gap-2 font-medium text-emerald-700">{result.mode === 'scheduled' ? <Calendar className="h-5 w-5" /> : <CheckCircle2 className="h-5 w-5" />}{result.mode === 'scheduled' ? 'บันทึก Broadcast ตามเวลาสำเร็จ' : 'ส่ง Broadcast สำเร็จ'}</div>
                        <div className="space-y-1 text-sm text-emerald-800">
                          <p>จำนวนผู้รับ: {result.recipientCount.toLocaleString()} คน</p>
                          {result.mode === 'scheduled' && result.scheduledAt ? <p>เวลาส่ง: {format(new Date(result.scheduledAt), 'PPP p', { locale: th })}</p> : null}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-start gap-2 text-destructive"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="space-y-1"><p className="font-medium">ส่ง Broadcast ไม่สำเร็จ</p><p className="text-sm">{result.error}</p></div></div>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <>
                  <Card className="border-amber-200 bg-amber-50"><CardContent className="space-y-3 p-4"><div className="flex items-start gap-2 text-amber-800"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /><div className="space-y-1"><p className="text-sm font-medium">ระบบจะยังไม่ส่งจนกว่าจะกดปุ่มยืนยันด้านล่าง</p><p className="text-xs text-amber-700">ขั้นตอนนี้คือจุดเดียวที่ระบบจะสร้างและส่ง Broadcast จริง</p></div></div></CardContent></Card>
                  <Card>
                    <CardContent className="space-y-3 p-4 text-sm">
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">Template</span><span className="font-medium">{selectedTemplate?.name || 'Broadcast'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">กลุ่มเป้าหมาย</span><span className="text-right font-medium">{targetMode === 'all' ? 'ลูกค้าทั้งหมด' : selectedTags.length > 0 ? selectedTags.map((tag) => tag.name).join(', ') : 'ยังไม่ได้เลือก'}</span></div>
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">เวลาส่ง</span><span className="font-medium">{sendNow ? 'ส่งทันที' : scheduledDateTime && !Number.isNaN(scheduledDateTime.getTime()) ? format(scheduledDateTime, 'PPP p', { locale: th }) : 'ยังไม่ได้เลือก'}</span></div>
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-muted-foreground">จำนวนผู้รับล่าสุด</span>
                        {isEstimateLoading ? (
                          <span className="inline-flex items-center gap-2 text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />กำลังคำนวณ...</span>
                        ) : estimateError ? (
                          <span className="text-destructive">ตรวจสอบไม่ได้</span>
                        ) : hasRecipientEstimate ? (
                          <span className={cn('font-semibold', recipientEstimate > 0 ? 'text-foreground' : 'text-destructive')}>{recipientEstimate.toLocaleString()} คน</span>
                        ) : (
                          <span className="text-muted-foreground">ยังไม่พร้อม</span>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          ) : null}
        </ScrollArea>

        <DialogFooter className="gap-2 border-t px-6 py-4">
          {result?.success ? (
            <Button type="button" onClick={() => handleDialogOpenChange(false)}>ปิด</Button>
          ) : (
            <>
              {stepIndex > 0 ? <Button type="button" variant="outline" onClick={goPrev}><ChevronLeft className="mr-2 h-4 w-4" />ย้อนกลับ</Button> : null}
              {step !== 'confirm' ? (
                <Button type="button" onClick={goNext} disabled={!canGoNext}>ถัดไป<ChevronRight className="ml-2 h-4 w-4" /></Button>
              ) : (
                <Button type="button" onClick={handleConfirm} disabled={!canConfirm}>
                  {isSubmitting ? (
                    sendBroadcast.progress ? (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />ส่งแล้ว {sendBroadcast.progress.sent.toLocaleString()} / {sendBroadcast.progress.total.toLocaleString()} คน</>
                    ) : (
                      <><Loader2 className="mr-2 h-4 w-4 animate-spin" />กำลังเตรียมส่ง...</>
                    )
                  ) : sendNow ? (
                    <><Send className="mr-2 h-4 w-4" />{hasRecipientEstimate ? `ยืนยันส่ง Broadcast (${recipientEstimate.toLocaleString()} คน)` : 'ยืนยันส่ง Broadcast'}</>
                  ) : (
                    <><Calendar className="mr-2 h-4 w-4" />{hasRecipientEstimate ? `ยืนยันตั้งเวลา Broadcast (${recipientEstimate.toLocaleString()} คน)` : 'ยืนยันตั้งเวลา Broadcast'}</>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
