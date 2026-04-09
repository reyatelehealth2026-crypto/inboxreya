/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, FileText, ImageIcon, LayoutTemplate, Video } from 'lucide-react'
import { useCreateBroadcastTemplate, useUpdateBroadcastTemplate } from '@/hooks/use-broadcasts'
import { BroadcastTemplate, FlexMessage } from '@/types/broadcast'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { useToast } from '@/hooks/use-toast'
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
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface BroadcastTemplateCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: BroadcastTemplate | null
  forceCreate?: boolean
  onSaved?: (template: BroadcastTemplate) => void
}

type TemplateType = 'text' | 'image' | 'flex' | 'video'

const typeOptions: Array<{
  value: TemplateType
  label: string
  helper: string
  icon: typeof FileText
}> = [
  { value: 'text', label: 'ข้อความ', helper: 'ข้อความธรรมดา ใช้เร็ว', icon: FileText },
  { value: 'image', label: 'รูปภาพ', helper: 'รูปภาพพร้อมลิงก์ media', icon: ImageIcon },
  { value: 'flex', label: 'Flex', helper: 'Flex JSON สำหรับ broadcast', icon: LayoutTemplate },
  { value: 'video', label: 'วิดีโอ', helper: 'ลิงก์วิดีโอสำหรับส่ง', icon: Video },
]

type CenterEditableBroadcastTemplate = BroadcastTemplate & {
  sourceTable: 'templates' | 'flex_templates'
  sourceId: number
}

function isCenterEditableTemplate(template: BroadcastTemplate | null | undefined): template is CenterEditableBroadcastTemplate {
  return !!template && typeof template.sourceId === 'number' && (template.sourceTable === 'templates' || template.sourceTable === 'flex_templates')
}

function PreviewBlock({
  type,
  content,
  mediaUrl,
  flexJson,
}: {
  type: TemplateType
  content: string
  mediaUrl: string
  flexJson: string
}) {
  if (type === 'text') {
    return (
      <div className="rounded-2xl rounded-tl-sm bg-[#06C755] px-4 py-3 text-sm leading-6 text-white shadow-sm">
        <div className="whitespace-pre-wrap">{content || 'ตัวอย่างข้อความจะแสดงตรงนี้'}</div>
      </div>
    )
  }

  if (type === 'image') {
    return mediaUrl ? (
      <img src={mediaUrl} alt="Template media preview" className="max-h-[320px] w-full rounded-xl border object-cover" />
    ) : (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        กรอก Media URL เพื่อดู preview
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="space-y-3">
        <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          preview วิดีโอแสดงเป็นลิงก์ก่อน
        </div>
        {mediaUrl ? (
          <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
            เปิดวิดีโอในแท็บใหม่
          </a>
        ) : null}
      </div>
    )
  }

  try {
    const parsed = JSON.parse(flexJson || '{}') as FlexMessage
    return (
      <div className="rounded-2xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
        <FlexPreview flex={parsed} />
      </div>
    )
  } catch {
    return (
      <div className="flex min-h-[220px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        ใส่ Flex JSON ที่ถูกต้องเพื่อดู preview
      </div>
    )
  }
}

function TypeSelector({
  value,
  onChange,
  isOptionDisabled,
}: {
  value: TemplateType
  onChange: (value: TemplateType) => void
  isOptionDisabled: (value: TemplateType) => boolean
}) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      {typeOptions.map((option) => {
        const Icon = option.icon
        const active = value === option.value
        const disabled = isOptionDisabled(option.value)

        return (
          <button
            key={option.value}
            type="button"
            disabled={disabled}
            onClick={() => onChange(option.value)}
            className={cn(
              'flex min-h-[92px] flex-col items-start justify-between rounded-2xl border p-4 text-left transition-all',
              active
                ? 'border-primary bg-primary/5 shadow-sm'
                : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30',
              disabled && 'cursor-not-allowed opacity-45 hover:border-border hover:bg-background'
            )}
          >
            <div className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl',
              active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
            )}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-semibold">{option.label}</div>
              <div className="text-xs leading-5 text-muted-foreground">{option.helper}</div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

export function BroadcastTemplateCreateDialog({
  open,
  onOpenChange,
  template,
  forceCreate = false,
  onSaved,
}: BroadcastTemplateCreateDialogProps) {
  const [templateType, setTemplateType] = useState<TemplateType>('text')
  const [name, setName] = useState('')
  const [categoryLabel, setCategoryLabel] = useState('')
  const [content, setContent] = useState('')
  const [mediaUrl, setMediaUrl] = useState('')
  const [flexJson, setFlexJson] = useState('')

  const { toast } = useToast()
  const createTemplate = useCreateBroadcastTemplate()
  const updateTemplate = useUpdateBroadcastTemplate()
  const isEditMode = !!template && !forceCreate
  const canEditInCenter = isCenterEditableTemplate(template)
  const isFlexEditMode = isEditMode && template?.sourceTable === 'flex_templates'

  useEffect(() => {
    if (!open) {
      setTemplateType('text')
      setName('')
      setCategoryLabel('')
      setContent('')
      setMediaUrl('')
      setFlexJson('')
      return
    }

    if (template) {
      setTemplateType(template.category)
      const baseName = template.name || ''
      setName(forceCreate ? (baseName.includes('(copy)') ? baseName : `${baseName} (copy)`) : baseName)
      setCategoryLabel(template.description || '')
      setContent(template.category === 'text' ? template.content || '' : '')
      setMediaUrl(template.category === 'image' || template.category === 'video' ? template.mediaUrl || '' : '')
      setFlexJson(template.category === 'flex' && template.flexContent ? JSON.stringify(template.flexContent, null, 2) : '')
      return
    }

    setTemplateType('text')
    setName('')
    setCategoryLabel('')
    setContent('')
    setMediaUrl('')
    setFlexJson('')
  }, [open, template, forceCreate])

  const flexError = useMemo(() => {
    if (templateType !== 'flex' || !flexJson.trim()) return ''
    try {
      const parsed = JSON.parse(flexJson)
      if (!parsed || typeof parsed !== 'object') return 'Flex JSON ไม่ถูกต้อง'
      return ''
    } catch {
      return 'Flex JSON ไม่ถูกต้อง'
    }
  }, [templateType, flexJson])

  const currentTypeOption = typeOptions.find((option) => option.value === templateType)
  const disableTypeOption = (value: TemplateType) => (
    isFlexEditMode
      ? value !== 'flex'
      : (isEditMode && template?.sourceTable === 'templates' ? value === 'flex' : false)
  )

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!name.trim()) {
      toast({ title: 'กรอกชื่อ template ก่อน', variant: 'destructive' })
      return
    }

    if (templateType === 'text' && !content.trim()) {
      toast({ title: 'Text template ต้องมีข้อความ', variant: 'destructive' })
      return
    }

    if ((templateType === 'image' || templateType === 'video') && !mediaUrl.trim()) {
      toast({ title: 'Media template ต้องมี URL', variant: 'destructive' })
      return
    }

    if (templateType === 'flex' && (!flexJson.trim() || flexError)) {
      toast({ title: flexError || 'Flex template ต้องมี JSON ที่ถูกต้อง', variant: 'destructive' })
      return
    }

    if (isEditMode && !canEditInCenter) {
      toast({ title: 'template นี้ต้องไปแก้ในหน้า Quick Reply เดิม', variant: 'destructive' })
      return
    }

    try {
      const payload = {
        name: name.trim(),
        templateType,
        categoryLabel: categoryLabel.trim() || undefined,
        content: templateType === 'text' ? content.trim() : undefined,
        mediaUrl: templateType === 'image' || templateType === 'video' ? mediaUrl.trim() : undefined,
        flexContent: templateType === 'flex' ? JSON.parse(flexJson) : undefined,
      }

      let response
      if (isEditMode && isCenterEditableTemplate(template)) {
        response = await updateTemplate.mutateAsync({
          sourceTable: template.sourceTable,
          sourceId: template.sourceId,
          data: payload,
        })
      } else {
        response = await createTemplate.mutateAsync(payload)
      }

      toast({ title: isEditMode ? 'บันทึก template สำเร็จ' : 'สร้าง template สำเร็จ' })
      onSaved?.(response.data)
      onOpenChange(false)
    } catch (error) {
      toast({
        title: isEditMode ? 'บันทึก template ไม่สำเร็จ' : 'สร้าง template ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-6xl overflow-hidden p-0 flex flex-col gap-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>
            {forceCreate
              ? 'ทำสำเนา Template'
              : (isEditMode ? 'แก้ไข Broadcast Template' : 'สร้าง Broadcast Template')}
          </DialogTitle>
          <DialogDescription>
            เริ่มจาก text / image / flex / video แบบง่ายก่อน แล้วค่อยต่อ duplicate / archive / publish ในเฟสถัดไป
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-hidden">
            <div className="grid h-full min-h-0 grid-cols-1 lg:grid-cols-[minmax(0,1.05fr)_minmax(360px,0.95fr)]">
              <div className="min-h-0 overflow-y-auto px-6 py-5">
                <div className="space-y-6">
                  <section className="space-y-3">
                    <div className="space-y-1">
                      <Label>ประเภท template</Label>
                      <p className="text-xs text-muted-foreground">เลือกชนิดของ message ก่อน ระบบจะปรับฟอร์มตามประเภทที่เลือก</p>
                    </div>
                    <TypeSelector
                      value={templateType}
                      onChange={setTemplateType}
                      isOptionDisabled={disableTypeOption}
                    />
                  </section>

                  <section className="grid gap-4 xl:grid-cols-2">
                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="template-name">ชื่อ template</Label>
                      <Input
                        id="template-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="เช่น โปรโมชั่นประจำเดือน"
                        maxLength={100}
                      />
                    </div>

                    <div className="space-y-2 xl:col-span-2">
                      <Label htmlFor="template-category">หมวดหมู่ / โฟลเดอร์</Label>
                      <Input
                        id="template-category"
                        value={categoryLabel}
                        onChange={(e) => setCategoryLabel(e.target.value)}
                        placeholder="เช่น โปรโมชั่น, Follow-up, Flex Catalog"
                        maxLength={100}
                      />
                    </div>
                  </section>

                  {templateType === 'text' ? (
                    <section className="space-y-2">
                      <Label htmlFor="template-content">ข้อความ</Label>
                      <Textarea
                        id="template-content"
                        value={content}
                        onChange={(e) => setContent(e.target.value)}
                        rows={10}
                        placeholder="ข้อความที่จะใช้ใน broadcast"
                      />
                    </section>
                  ) : null}

                  {templateType === 'image' || templateType === 'video' ? (
                    <section className="space-y-2">
                      <Label htmlFor="template-media-url">Media URL</Label>
                      <Input
                        id="template-media-url"
                        value={mediaUrl}
                        onChange={(e) => setMediaUrl(e.target.value)}
                        placeholder="https://..."
                      />
                      <p className="text-xs text-muted-foreground">ใช้ URL ที่เปิดจากภายนอกได้และโหลดไฟล์ได้จริง</p>
                    </section>
                  ) : null}

                  {templateType === 'flex' ? (
                    <section className="space-y-2">
                      <div className="space-y-1">
                        <Label htmlFor="template-flex-json">Flex JSON</Label>
                        <p className="text-xs text-muted-foreground">รองรับ payload แบบเต็ม (`type:flex`) หรือ bubble/carousel ที่ระบบจะ normalize ให้</p>
                      </div>
                      <Textarea
                        id="template-flex-json"
                        value={flexJson}
                        onChange={(e) => setFlexJson(e.target.value)}
                        rows={16}
                        className="min-h-[320px] font-mono text-xs"
                        placeholder={'{"type":"flex","altText":"ข้อความ","contents":{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Hello"}]}}}'}
                      />
                      {flexError ? (
                        <div className="flex items-center gap-2 text-sm text-destructive">
                          <AlertCircle className="h-4 w-4" />
                          {flexError}
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                </div>
              </div>

              <div className="min-h-0 border-t bg-muted/20 lg:border-l lg:border-t-0">
                <div className="h-full overflow-y-auto px-6 py-5">
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-sm font-semibold">Preview</h3>
                        {currentTypeOption ? <Badge variant="outline">{currentTypeOption.label}</Badge> : null}
                      </div>
                      <p className="text-xs text-muted-foreground">เช็กหน้าตา template ก่อนบันทึก</p>
                    </div>

                    <Card className="shadow-none">
                      <CardContent className="space-y-4 p-5">
                        <PreviewBlock type={templateType} content={content} mediaUrl={mediaUrl} flexJson={flexJson} />
                      </CardContent>
                    </Card>

                    <Card className="border-dashed bg-background/70 shadow-none">
                      <CardContent className="space-y-3 p-5 text-sm">
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">ชื่อ template</span>
                          <span className="text-right font-medium">{name.trim() || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">ประเภท</span>
                          <span className="font-medium">{currentTypeOption?.label || '-'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span className="text-muted-foreground">หมวดหมู่</span>
                          <span className="text-right font-medium">{categoryLabel.trim() || '-'}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter className="border-t bg-background px-6 py-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ยกเลิก
            </Button>
            <Button type="submit" disabled={createTemplate.isPending || updateTemplate.isPending}>
              {createTemplate.isPending || updateTemplate.isPending
                ? (isEditMode ? 'กำลังบันทึก...' : 'กำลังสร้าง...')
                : (isEditMode ? 'บันทึกการแก้ไข' : 'บันทึก template')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
