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
  Layers,
  Loader2,
  MessageSquare,
  Plus,
  Send,
  Settings2,
  Tag,
  Trash2,
  Upload,
  Users,
  Video,
  X,
} from 'lucide-react'
import { BroadcastTemplate, CreateBroadcastInput, FlexMessage } from '@/types/broadcast'
import {
  useBroadcastRecipientEstimate,
  useBroadcastTemplates,
  useCreateBroadcast,
  useSendBroadcast,
} from '@/hooks/use-broadcasts'
import { useTags, useCreateTag } from '@/hooks/use-tags'
import { useToast } from '@/hooks/use-toast'
import { TemplateSelector } from './TemplateSelector'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { ImagemapRegionEditor } from './ImagemapRegionEditor'
import { ImagemapTestSendModal } from './ImagemapTestSendModal'
import { imagemapInputSchema, type ImagemapRegion, type ImagemapInput } from '@/lib/imagemap-types'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  scheduledDates?: string[]
  error?: string
}

const MAX_FLEX_PER_BROADCAST = 5

function toLocalDateInputValue(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

interface CreateBroadcastDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateBroadcastDialog({ open, onOpenChange, onSuccess }: CreateBroadcastDialogProps) {
  const [step, setStep] = useState<Step>('settings')
  const [selectedTemplate, setSelectedTemplate] = useState<BroadcastTemplate | null>(null)
  const [selectedTemplates, setSelectedTemplates] = useState<BroadcastTemplate[]>([])
  const [multiSelectMode, setMultiSelectMode] = useState(false)
  const [customFlexContent, setCustomFlexContent] = useState('')
  const [customFlexError, setCustomFlexError] = useState<string | null>(null)
  const [targetMode, setTargetMode] = useState<'all' | 'tags'>('all')
  const [selectedTagIds, setSelectedTagIds] = useState<number[]>([])
  const [tagSearch, setTagSearch] = useState('')
  const [sendMode, setSendMode] = useState<'now' | 'scheduled'>('now')
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledDates, setScheduledDates] = useState<string[]>([])
  const [scheduledTime, setScheduledTime] = useState('09:00')
  const [multiDateMode, setMultiDateMode] = useState(false)
  const [result, setResult] = useState<ResultState | null>(null)

  // Message mode: Template or Imagemap
  const [messageMode, setMessageMode] = useState<'template' | 'imagemap'>('template')

  // Imagemap state
  const [imagemapData, setImagemapData] = useState<{
    baseKey: string
    baseUrl: string
    width: 1040
    height: number
    previewUrl: string
  } | null>(null)
  const [imagemapRegions, setImagemapRegions] = useState<ImagemapRegion[]>([])
  const [imagemapAltText, setImagemapAltText] = useState('')
  const [imagemapClosingText, setImagemapClosingText] = useState('')
  const [imagemapFlexTemplate, setImagemapFlexTemplate] = useState<BroadcastTemplate | null>(null)
  const [isUploadingImage, setIsUploadingImage] = useState(false)
  const [isTestSendModalOpen, setIsTestSendModalOpen] = useState(false)

  const { toast } = useToast()
  const { data: templatesData } = useBroadcastTemplates()
  const { data: tagsData, isLoading: isTagsLoading } = useTags()
  const createTag = useCreateTag()
  const createBroadcast = useCreateBroadcast()
  const sendBroadcast = useSendBroadcast()

  const handleCreateTag = async (name: string) => {
    try {
      const res = await createTag.mutateAsync({ name })
      return res
    } catch {
      return null
    }
  }

  const templates = templatesData?.data || []
  const tags = Array.isArray(tagsData) ? tagsData : []
  const stepIndex = STEPS.findIndex((item) => item.key === step)
  const isSubmitting = createBroadcast.isPending || sendBroadcast.isPending
  const isCustomFlexSelected = !multiSelectMode && selectedTemplate?.id === -1
  const sendNow = sendMode === 'now'

  const flexCapableTemplates = useMemo(
    () => selectedTemplates.filter((tpl) => !!tpl.flexContent),
    [selectedTemplates]
  )

  const parsedCustomFlex = useMemo(() => {
    if (!isCustomFlexSelected || !customFlexContent.trim()) return null
    try {
      const parsed = JSON.parse(customFlexContent) as Partial<FlexMessage>
      return parsed.type === 'flex' && parsed.contents ? parsed as FlexMessage : null
    } catch {
      return null
    }
  }, [customFlexContent, isCustomFlexSelected])

  // Imagemap payload & validation
  const imagemapPayload = useMemo<ImagemapInput | null>(() => {
    if (!imagemapData) return null
    return {
      baseKey: imagemapData.baseKey,
      width: 1040,
      height: imagemapData.height,
      altText: imagemapAltText.trim(),
      regions: imagemapRegions,
    }
  }, [imagemapData, imagemapAltText, imagemapRegions])

  const imagemapValidationResult = useMemo(() => {
    if (messageMode !== 'imagemap') return { success: true, error: null }
    if (!imagemapData) return { success: false, error: 'กรุณาอัปโหลดรูปภาพ Imagemap' }
    if (!imagemapAltText.trim()) return { success: false, error: 'กรุณาระบุ Alt Text สำหรับแจ้งเตือน' }
    if (imagemapRegions.length === 0) return { success: false, error: 'กรุณาสร้างจุดกดอย่างน้อย 1 ช่อง' }
    if (!imagemapPayload) return { success: false, error: 'ข้อมูล Imagemap ไม่สมบูรณ์' }

    const parsed = imagemapInputSchema.safeParse(imagemapPayload)
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0]
      return {
        success: false,
        error: firstIssue ? firstIssue.message : 'ข้อมูล Imagemap ไม่ถูกต้อง',
      }
    }
    return { success: true, error: null }
  }, [messageMode, imagemapData, imagemapAltText, imagemapRegions, imagemapPayload])

  const filteredTags = tags.filter((tag) => {
    const search = tagSearch.trim().toLowerCase()
    if (!search) return true
    const haystack = [tag.name, tag.description].filter(Boolean).join(' ').toLowerCase()
    return haystack.includes(search)
  })
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(Number(tag.id)))

  const scheduledDateTimes = useMemo(() => {
    if (sendNow) return [] as Date[]
    const sources = multiDateMode ? scheduledDates : scheduledDate ? [scheduledDate] : []
    return sources
      .map((d) => new Date(`${d}T${scheduledTime}`))
      .filter((d) => !Number.isNaN(d.getTime()))
      .sort((a, b) => a.getTime() - b.getTime())
  }, [sendNow, multiDateMode, scheduledDates, scheduledDate, scheduledTime])

  const now = new Date()
  const validScheduledDateTimes = scheduledDateTimes.filter((d) => d > now)
  const hasInvalidPastDate = scheduledDateTimes.length > 0 && validScheduledDateTimes.length < scheduledDateTimes.length
  const hasValidScheduledDateTime = !sendNow && validScheduledDateTimes.length > 0 && !hasInvalidPastDate

  const isTemplateSettingsValid = multiSelectMode
    ? selectedTemplates.length > 0
    : !!selectedTemplate && (!isCustomFlexSelected || !!parsedCustomFlex)
  const isImagemapSettingsValid = messageMode === 'imagemap' && imagemapValidationResult.success
  const isSettingsValid = messageMode === 'imagemap' ? isImagemapSettingsValid : isTemplateSettingsValid

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
    setMessageMode('template')
    setSelectedTemplate(null)
    setSelectedTemplates([])
    setMultiSelectMode(false)
    setCustomFlexContent('')
    setCustomFlexError(null)
    setImagemapData(null)
    setImagemapRegions([])
    setImagemapAltText('')
    setImagemapClosingText('')
    setImagemapFlexTemplate(null)
    setTargetMode('all')
    setSelectedTagIds([])
    setTagSearch('')
    setSendMode('now')
    setScheduledDate('')
    setScheduledDates([])
    setMultiDateMode(false)
    setScheduledTime('09:00')
    setResult(null)
  }

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) resetForm()
    onOpenChange(nextOpen)
  }

  const handleImageUpload = async (file: File) => {
    if (!file) return
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      toast({ title: 'รองรับเฉพาะไฟล์รูปภาพ JPEG หรือ PNG เท่านั้น', variant: 'destructive' })
      return
    }
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: 'ขนาดไฟล์ต้องไม่เกิน 10MB', variant: 'destructive' })
      return
    }

    setIsUploadingImage(true)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const res = await fetch('/api/inbox/broadcasts/imagemap-upload', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'อัปโหลดภาพไม่สำเร็จ')
      }

      setImagemapData(data.data)
      if (!imagemapAltText) {
        const defaultAlt = file.name.replace(/\.[^/.]+$/, '').slice(0, 50)
        setImagemapAltText(defaultAlt || 'โปรโมชันพิเศษ')
      }
      toast({ title: 'อัปโหลดและประมวลผลรูปภาพ 5 ขนาดเรียบร้อย' })
    } catch (err) {
      toast({
        title: 'อัปโหลดภาพล้มเหลว',
        description: err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    } finally {
      setIsUploadingImage(false)
    }
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
      if (messageMode === 'imagemap') {
        toast({
          title: 'ข้อมูล Imagemap ไม่ถูกต้อง',
          description: imagemapValidationResult.error || 'กรุณาตรวจสอบรูปภาพและจุดกดก่อนยืนยัน',
          variant: 'destructive',
        })
      } else {
        toast({ title: 'กรุณาเลือก template ก่อน', description: 'หากใช้ Custom Flex ต้องกรอก JSON ให้ถูกต้อง', variant: 'destructive' })
      }
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
      toast({ title: 'วันเวลาส่งไม่ถูกต้อง', description: 'กรุณาเลือกวันเวลาที่มากกว่าปัจจุบันและเอาวันที่อยู่ในอดีตออก', variant: 'destructive' })
      return
    }

    const scheduledIsoList = sendNow ? [] : validScheduledDateTimes.map((d) => d.toISOString())

    const input: CreateBroadcastInput = {
      targetTagIds: targetMode === 'tags' ? selectedTagIds : undefined,
    }

    if (sendNow) {
      // no scheduled fields
    } else if (multiDateMode && scheduledIsoList.length > 1) {
      input.scheduledDates = scheduledIsoList
    } else {
      input.scheduledAt = scheduledIsoList[0]
    }

    if (messageMode === 'imagemap') {
      if (!imagemapPayload) {
        toast({ title: 'กรุณาอัปโหลดรูปภาพ Imagemap', variant: 'destructive' })
        return
      }
      input.messageType = 'imagemap'
      input.imagemap = imagemapPayload
      if (imagemapClosingText.trim()) {
        input.content = imagemapClosingText.trim()
      }
      if (imagemapFlexTemplate?.flexContent) {
        input.flexContent = imagemapFlexTemplate.flexContent
      }
    } else if (multiSelectMode && selectedTemplates.length > 0) {
      const flexContents = selectedTemplates
        .map((tpl) => tpl.flexContent)
        .filter((flex): flex is NonNullable<typeof flex> => !!flex)
      if (flexContents.length === 0) {
        toast({ title: 'ไม่พบ Flex Message ในรายการที่เลือก', variant: 'destructive' })
        return
      }
      input.flexContents = flexContents
      input.messageType = 'flex'
      input.content = flexContents[0].altText || selectedTemplates[0].name || 'Flex Broadcast'
      input.templateIds = selectedTemplates.map((tpl) => tpl.sourceId).filter((id): id is number => typeof id === 'number')
      // Use first template's source for legacy fields
      input.templateId = selectedTemplates[0]?.sourceId
      input.templateSourceTable = selectedTemplates[0]?.sourceTable
    } else {
      input.templateId = selectedTemplate?.sourceId
      input.templateSourceTable = selectedTemplate?.sourceTable
      input.messageType = selectedTemplate?.category
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
    }

    try {
      const response = await createBroadcast.mutateAsync(input)
      const data = response?.data
      const broadcastIds: number[] = Array.isArray(data?.broadcasts)
        ? data.broadcasts.map((b: { id: number }) => b.id)
        : data?.id ? [data.id] : []

      if (sendNow && broadcastIds.length > 0) {
        for (const bid of broadcastIds) await sendBroadcast.mutateAsync(bid)
      }

      setResult({
        success: true,
        mode: sendMode,
        recipientCount: recipientEstimate,
        scheduledAt: sendNow ? undefined : scheduledIsoList[0],
        scheduledDates: scheduledIsoList.length > 1 ? scheduledIsoList : undefined,
      })
      onSuccess?.()
      const successDescription = sendNow
        ? undefined
        : scheduledIsoList.length > 1
        ? `สร้าง ${scheduledIsoList.length} รอบเรียบร้อย`
        : undefined
      toast({
        title: sendNow ? 'ส่ง Broadcast สำเร็จ' : 'บันทึก Broadcast ตามเวลาสำเร็จ',
        description: successDescription,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง'
      setResult({
        success: false,
        mode: sendMode,
        recipientCount: recipientEstimate,
        scheduledAt: sendNow ? undefined : scheduledIsoList[0],
        scheduledDates: scheduledIsoList.length > 1 ? scheduledIsoList : undefined,
        error: message,
      })
      toast({ title: 'ส่ง Broadcast ไม่สำเร็จ', description: message, variant: 'destructive' })
    }
  }

  const renderPreview = () => {
    if (messageMode === 'imagemap') {
      if (!imagemapData) {
        return (
          <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            ยังไม่ได้อัปโหลดภาพ Imagemap ในขั้นตอนแรก
          </div>
        )
      }
      return (
        <div className="space-y-4 max-w-md mx-auto">
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <Badge variant="outline">Imagemap Broadcast</Badge>
            <span>{imagemapRegions.length} จุดกด</span>
          </div>

          <div className="relative overflow-hidden rounded-xl border bg-black shadow-md">
            <img
              src={imagemapData.previewUrl}
              alt={imagemapAltText || 'Imagemap Preview'}
              className="w-full object-contain"
            />
            {imagemapRegions.map((r, i) => (
              <div
                key={i}
                className="absolute border border-emerald-400 bg-emerald-500/30 flex items-center justify-center text-white text-[10px] font-bold pointer-events-none"
                style={{
                  left: `${(r.x / 1040) * 100}%`,
                  top: `${(r.y / imagemapData.height) * 100}%`,
                  width: `${(r.w / 1040) * 100}%`,
                  height: `${(r.h / imagemapData.height) * 100}%`,
                }}
              >
                <span className="rounded-full bg-emerald-700/90 h-4 w-4 flex items-center justify-center">
                  {i + 1}
                </span>
              </div>
            ))}
          </div>

          {imagemapAltText && (
            <div className="rounded-lg bg-muted/40 p-2 text-xs">
              <span className="text-muted-foreground">Alt Text (แจ้งเตือนใน LINE): </span>
              <span className="font-medium">{imagemapAltText}</span>
            </div>
          )}

          {imagemapFlexTemplate?.flexContent && (
            <div className="space-y-2">
              <span className="text-xs text-muted-foreground">Flex Message ที่แนบ:</span>
              <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
                <FlexPreview flex={imagemapFlexTemplate.flexContent} />
              </div>
            </div>
          )}

          {imagemapClosingText.trim() && (
            <div className="rounded-xl bg-[#85e243] p-3 text-sm text-neutral-900 shadow-sm ml-auto max-w-[80%] rounded-tr-none whitespace-pre-wrap">
              {imagemapClosingText}
            </div>
          )}
        </div>
      )
    }

    if (multiSelectMode && selectedTemplates.length > 0) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge>{selectedTemplates.length} Flex</Badge>
            <span className="text-xs text-muted-foreground">ส่งตามลำดับที่เลือก</span>
          </div>
          <div className="space-y-4">
            {selectedTemplates.map((tpl, idx) => (
              <div key={tpl.id} className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <Badge variant="outline">{idx + 1}</Badge>
                  <span className="font-medium text-foreground">{tpl.name}</span>
                </div>
                {tpl.flexContent ? (
                  <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
                    <FlexPreview flex={tpl.flexContent} />
                  </div>
                ) : (
                  <div className="rounded-xl border border-dashed p-4 text-xs text-muted-foreground">
                    ไม่ใช่ Flex Message
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )
    }
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
              {/* Mode Switcher: Template Broadcast vs Imagemap Broadcast */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b pb-3">
                <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1">
                  <button
                    type="button"
                    onClick={() => {
                      setMessageMode('template')
                      setResult(null)
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      messageMode === 'template'
                        ? 'bg-background text-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    Template / Flex
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMessageMode('imagemap')
                      setResult(null)
                    }}
                    className={cn(
                      'flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                      messageMode === 'imagemap'
                        ? 'bg-primary text-primary-foreground shadow-sm'
                        : 'text-muted-foreground hover:text-foreground'
                    )}
                  >
                    <ImageIcon className="h-3.5 w-3.5" />
                    Imagemap (รูปภาพแบ่งจุดกด)
                  </button>
                </div>

                {messageMode === 'imagemap' && imagemapData && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 text-xs gap-1.5 text-primary border-primary/40 hover:bg-primary/5"
                    onClick={() => setIsTestSendModalOpen(true)}
                  >
                    <Send className="h-3.5 w-3.5" />
                    ส่งทดสอบหาตัวเอง
                  </Button>
                )}
              </div>

              {/* MODE 1: IMAGEMAP */}
              {messageMode === 'imagemap' ? (
                <div className="space-y-6">
                  {!imagemapData ? (
                    <Card className="border-dashed border-2">
                      <CardContent className="flex flex-col items-center justify-center p-8 text-center space-y-3">
                        <div className="rounded-full bg-primary/10 p-3 text-primary">
                          {isUploadingImage ? (
                            <Loader2 className="h-8 w-8 animate-spin" />
                          ) : (
                            <ImageIcon className="h-8 w-8" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-semibold">อัปโหลดรูปภาพสำหรับ Imagemap</h4>
                          <p className="text-xs text-muted-foreground mt-1">
                            รองรับ JPEG หรือ PNG (สูงสุด 10MB) • ระบบจะย่อขนาด 5 ไซส์ (1040, 700, 460, 300, 240) อัตโนมัติ
                          </p>
                        </div>
                        <div>
                          <input
                            type="file"
                            id="imagemap-file-input"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            disabled={isUploadingImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImageUpload(file)
                            }}
                          />
                          <Button
                            type="button"
                            disabled={isUploadingImage}
                            onClick={() => document.getElementById('imagemap-file-input')?.click()}
                            className="gap-2"
                          >
                            {isUploadingImage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                            {isUploadingImage ? 'กำลังประมวลผลรูปภาพ...' : 'เลือกไฟล์รูปภาพ'}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <div className="space-y-5">
                      {/* Uploaded image bar */}
                      <div className="flex items-center justify-between rounded-lg border bg-muted/20 px-3 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground">รูปภาพ Imagemap:</span>
                          <span className="text-muted-foreground font-mono">1040 × {imagemapData.height} px</span>
                        </div>
                        <div>
                          <input
                            type="file"
                            id="imagemap-file-replace"
                            accept="image/jpeg,image/png"
                            className="hidden"
                            disabled={isUploadingImage}
                            onChange={(e) => {
                              const file = e.target.files?.[0]
                              if (file) handleImageUpload(file)
                            }}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs"
                            onClick={() => document.getElementById('imagemap-file-replace')?.click()}
                            disabled={isUploadingImage}
                          >
                            เปลี่ยนรูปภาพ
                          </Button>
                        </div>
                      </div>

                      {/* Region Editor Component */}
                      <ImagemapRegionEditor
                        baseKey={imagemapData.baseKey}
                        baseUrl={imagemapData.baseUrl}
                        imageWidth={1040}
                        imageHeight={imagemapData.height}
                        previewUrl={imagemapData.previewUrl}
                        regions={imagemapRegions}
                        onChangeRegions={(newRegions) => {
                          setImagemapRegions(newRegions)
                          setResult(null)
                        }}
                        tags={tags}
                        onCreateTag={handleCreateTag}
                      />

                      {/* Required Alt Text */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold">
                            Alt Text (ข้อความแจ้งเตือนแทนรูปภาพใน LINE Notification) <span className="text-destructive">*</span>
                          </label>
                          <span className="text-[10px] text-muted-foreground">{imagemapAltText.length}/400</span>
                        </div>
                        <Input
                          value={imagemapAltText}
                          onChange={(e) => setImagemapAltText(e.target.value)}
                          placeholder="เช่น โปรโมชันลดกระหน่ำรับปีใหม่ SOS Plus และสินค้าชั้นนำ"
                          maxLength={400}
                          className="text-xs"
                        />
                      </div>

                      {/* Optional Flex Attachment (ONE Flex) */}
                      <div className="space-y-2 border rounded-lg p-3 bg-muted/10">
                        <div className="flex items-center justify-between">
                          <label className="text-xs font-semibold flex items-center gap-1.5">
                            <Layers className="h-3.5 w-3.5 text-primary" />
                            แนบ Flex Message เพิ่มเติม (เป็นตัวเลือกเสริม สูงสุด 1 ใบ)
                          </label>
                          {imagemapFlexTemplate && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="h-6 text-xs text-destructive hover:bg-destructive/10"
                              onClick={() => setImagemapFlexTemplate(null)}
                            >
                              เอาออก
                            </Button>
                          )}
                        </div>

                        {imagemapFlexTemplate ? (
                          <div className="flex items-center justify-between rounded-md border bg-background p-2 text-xs">
                            <span className="font-medium">{imagemapFlexTemplate.name}</span>
                            <Badge variant="secondary">Flex Message</Badge>
                          </div>
                        ) : (
                          <Select
                            onValueChange={(tplIdStr: string) => {
                              const tpl = templates.find((t: BroadcastTemplate) => String(t.id) === tplIdStr && !!t.flexContent)
                              if (tpl) setImagemapFlexTemplate(tpl)
                            }}
                          >
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue placeholder="-- เลือก Flex Template ที่ต้องการแนบ (หรือไม่เลือก) --" />
                            </SelectTrigger>
                            <SelectContent>
                              {templates
                                .filter((t: BroadcastTemplate) => !!t.flexContent)
                                .map((t: BroadcastTemplate) => (
                                  <SelectItem key={t.id} value={String(t.id)}>
                                    {t.name}
                                  </SelectItem>
                                ))}
                            </SelectContent>
                          </Select>
                        )}
                      </div>

                      {/* Optional Closing Text Message */}
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold">
                          ข้อความปิดท้าย (เป็นตัวเลือกเสริม ส่งต่อจากภาพ Imagemap)
                        </label>
                        <Textarea
                          value={imagemapClosingText}
                          onChange={(e) => setImagemapClosingText(e.target.value)}
                          placeholder="เช่น สอบถามเพิ่มเติมหรือสั่งซื้อ ทักแอดมินได้ตลอด 24 ชม. ค่ะ"
                          rows={2}
                          className="text-xs resize-none"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* MODE 2: TEMPLATES & FLEX */
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <h3 className="flex items-center gap-2 text-sm font-medium"><Settings2 className="h-4 w-4" />ตั้งค่า Broadcast จาก Template</h3>
                    <button
                      type="button"
                      onClick={() => {
                        const next = !multiSelectMode
                        setMultiSelectMode(next)
                        setResult(null)
                        if (next) {
                          const seed = selectedTemplate && selectedTemplate.id !== -1 && selectedTemplate.flexContent
                            ? [selectedTemplate]
                            : []
                          setSelectedTemplates(seed)
                          setSelectedTemplate(seed[0] ?? null)
                          setCustomFlexContent('')
                          setCustomFlexError(null)
                        } else {
                          const first = selectedTemplates[0] || null
                          setSelectedTemplates([])
                          setSelectedTemplate(first)
                        }
                      }}
                      className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                        multiSelectMode
                          ? 'border-primary bg-primary text-primary-foreground'
                          : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                      )}
                    >
                      <Layers className="h-3.5 w-3.5" />
                      {multiSelectMode ? `เลือกหลาย Flex (${selectedTemplates.length}/${MAX_FLEX_PER_BROADCAST})` : 'เลือกหลาย Flex'}
                    </button>
                  </div>
                  {multiSelectMode ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3 text-xs text-primary">
                      เลือก Flex ได้สูงสุด {MAX_FLEX_PER_BROADCAST} ใบในการ broadcast เดียว ระบบจะส่งเรียงตามลำดับที่เลือก
                      ({flexCapableTemplates.length} จาก {selectedTemplates.length} รายการเป็น Flex)
                    </div>
                  ) : null}
                  <TemplateSelector
                    templates={templates}
                    selectedTemplateId={multiSelectMode ? undefined : selectedTemplate?.id}
                    selectedTemplateIds={multiSelectMode ? selectedTemplates.map((t) => t.id) : undefined}
                    maxSelectable={multiSelectMode ? MAX_FLEX_PER_BROADCAST : undefined}
                    onSelect={(template) => {
                      setResult(null)
                      if (!template) return
                      if (multiSelectMode) {
                        if (template.id === -1) return
                        if (!template.flexContent) {
                          toast({ title: 'รองรับเฉพาะ Flex', description: 'โหมดเลือกหลายรายการรองรับเฉพาะ Flex Message', variant: 'destructive' })
                          return
                        }
                        setSelectedTemplates((current) => {
                          const exists = current.some((t) => t.id === template.id)
                          if (exists) return current.filter((t) => t.id !== template.id)
                          if (current.length >= MAX_FLEX_PER_BROADCAST) return current
                          return [...current, template]
                        })
                      } else {
                        setSelectedTemplate(template)
                        if (template.id !== -1) setCustomFlexError(null)
                      }
                    }}
                  />
                  {multiSelectMode && selectedTemplates.length > 0 ? (
                    <Card>
                      <CardContent className="space-y-2 p-4">
                        <p className="text-xs font-medium text-muted-foreground">ลำดับการส่ง</p>
                        <div className="space-y-2">
                          {selectedTemplates.map((tpl, idx) => (
                            <div key={tpl.id} className="flex items-center gap-3 rounded-lg border bg-muted/30 p-2">
                              <Badge>{idx + 1}</Badge>
                              <span className="flex-1 truncate text-sm">{tpl.name}</span>
                              <button
                                type="button"
                                onClick={() => setSelectedTemplates((current) => current.filter((t) => t.id !== tpl.id))}
                                className="rounded-md p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                                title="เอาออก"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  ) : null}
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
                </>
              )}
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
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                      <p className="text-xs font-medium">โหมดวันที่</p>
                      <div className="inline-flex items-center gap-1 rounded-full border bg-background p-1 text-xs">
                        <button
                          type="button"
                          onClick={() => { setMultiDateMode(false); setResult(null) }}
                          className={cn('rounded-full px-3 py-1 transition-colors', !multiDateMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                          วันเดียว
                        </button>
                        <button
                          type="button"
                          onClick={() => { setMultiDateMode(true); setResult(null) }}
                          className={cn('rounded-full px-3 py-1 transition-colors inline-flex items-center gap-1', multiDateMode ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
                        >
                          <Layers className="h-3 w-3" />หลายวัน
                        </button>
                      </div>
                    </div>

                    {!multiDateMode ? (
                      <div className="space-y-2">
                        <p className="text-xs font-medium">วันที่ส่ง</p>
                        <Input type="date" value={scheduledDate} onChange={(event) => { setScheduledDate(event.target.value); setResult(null) }} min={new Date().toISOString().split('T')[0]} />
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="space-y-2">
                          <p className="text-xs font-medium">เพิ่มหลายวัน (ส่งซ้ำเวลาเดียวกัน)</p>
                          <div className="flex items-center gap-2">
                            <Input
                              type="date"
                              value={scheduledDate}
                              onChange={(event) => setScheduledDate(event.target.value)}
                              min={toLocalDateInputValue(new Date())}
                              className="flex-1"
                            />
                            <Button
                              type="button"
                              variant="secondary"
                              onClick={() => {
                                if (!scheduledDate) return
                                setScheduledDates((current) => current.includes(scheduledDate) ? current : [...current, scheduledDate].sort())
                                setScheduledDate('')
                                setResult(null)
                              }}
                              disabled={!scheduledDate || scheduledDates.includes(scheduledDate)}
                            >
                              <Plus className="mr-1 h-3.5 w-3.5" />เพิ่ม
                            </Button>
                          </div>
                        </div>
                        {scheduledDates.length > 0 ? (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">วันที่เลือกไว้ ({scheduledDates.length})</p>
                            <div className="flex flex-wrap gap-2">
                              {scheduledDates.map((d) => (
                                <Badge key={d} variant="secondary" className="gap-1 px-2 py-1">
                                  {format(new Date(`${d}T${scheduledTime}`), 'd MMM', { locale: th })}
                                  <button
                                    type="button"
                                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                                    onClick={() => { setScheduledDates((current) => current.filter((x) => x !== d)); setResult(null) }}
                                    title="ลบวันนี้"
                                  >
                                    <X className="h-3 w-3" />
                                  </button>
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs text-muted-foreground">ยังไม่ได้เพิ่มวันที่ใด</p>
                        )}
                      </div>
                    )}

                    <div className="space-y-2">
                      <p className="text-xs font-medium">เวลาที่ส่ง (ใช้กับทุกวัน)</p>
                      <Input type="time" value={scheduledTime} onChange={(event) => { setScheduledTime(event.target.value); setResult(null) }} />
                    </div>

                    {scheduledDateTimes.length > 0 ? (
                      <div className={cn('flex items-start gap-2 rounded-lg border p-3 text-xs', hasValidScheduledDateTime ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-amber-200 bg-amber-50 text-amber-700')}>
                        <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                        <div className="space-y-1">
                          {hasInvalidPastDate ? (
                            <span><strong>{scheduledDateTimes.length - validScheduledDateTimes.length}</strong> วันอยู่ในอดีต กรุณาเอาออกหรือเปลี่ยนเวลา</span>
                          ) : multiDateMode ? (
                            <>
                              <span>กำหนดส่ง <strong>{validScheduledDateTimes.length}</strong> รอบ ครั้งแรก: <strong>{format(validScheduledDateTimes[0], 'PPP p', { locale: th })}</strong></span>
                              {validScheduledDateTimes.length > 1 ? <span className="block text-[11px] opacity-80">ครั้งสุดท้าย: {format(validScheduledDateTimes[validScheduledDateTimes.length - 1], 'PPP p', { locale: th })}</span> : null}
                            </>
                          ) : (
                            <span>กำหนดส่ง: <strong>{format(validScheduledDateTimes[0] ?? scheduledDateTimes[0], 'PPP p', { locale: th })}</strong></span>
                          )}
                        </div>
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
                          {result.mode === 'scheduled' && result.scheduledDates && result.scheduledDates.length > 1 ? (
                            <p>เวลาส่ง: {result.scheduledDates.length} รอบ ({result.scheduledDates.map((iso) => format(new Date(iso), 'd MMM', { locale: th })).join(', ')})</p>
                          ) : result.mode === 'scheduled' && result.scheduledAt ? (
                            <p>เวลาส่ง: {format(new Date(result.scheduledAt), 'PPP p', { locale: th })}</p>
                          ) : null}
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
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">Template</span>
                        <span className="text-right font-medium">
                          {multiSelectMode && selectedTemplates.length > 0
                            ? `${selectedTemplates.length} Flex: ${selectedTemplates.map((t) => t.name).join(', ')}`
                            : selectedTemplate?.name || 'Broadcast'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-3"><span className="text-muted-foreground">กลุ่มเป้าหมาย</span><span className="text-right font-medium">{targetMode === 'all' ? 'ลูกค้าทั้งหมด' : selectedTags.length > 0 ? selectedTags.map((tag) => tag.name).join(', ') : 'ยังไม่ได้เลือก'}</span></div>
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-muted-foreground">เวลาส่ง</span>
                        <span className="text-right font-medium">
                          {sendNow
                            ? 'ส่งทันที'
                            : validScheduledDateTimes.length > 1
                            ? `${validScheduledDateTimes.length} รอบ — เริ่ม ${format(validScheduledDateTimes[0], 'd MMM', { locale: th })} ถึง ${format(validScheduledDateTimes[validScheduledDateTimes.length - 1], 'd MMM HH:mm', { locale: th })}`
                            : validScheduledDateTimes.length === 1
                            ? format(validScheduledDateTimes[0], 'PPP p', { locale: th })
                            : 'ยังไม่ได้เลือก'}
                        </span>
                      </div>
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
                    <>
                      <Calendar className="mr-2 h-4 w-4" />
                      {validScheduledDateTimes.length > 1
                        ? `ยืนยันตั้งเวลา ${validScheduledDateTimes.length} รอบ${hasRecipientEstimate ? ` (${recipientEstimate.toLocaleString()} คน/รอบ)` : ''}`
                        : hasRecipientEstimate ? `ยืนยันตั้งเวลา Broadcast (${recipientEstimate.toLocaleString()} คน)` : 'ยืนยันตั้งเวลา Broadcast'}
                    </>
                  )}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>

      {/* Test Send Modal */}
      <ImagemapTestSendModal
        open={isTestSendModalOpen}
        onOpenChange={setIsTestSendModalOpen}
        imagemap={imagemapPayload}
        content={imagemapClosingText.trim() || undefined}
        flexContent={imagemapFlexTemplate?.flexContent || null}
      />
    </Dialog>
  )
}
