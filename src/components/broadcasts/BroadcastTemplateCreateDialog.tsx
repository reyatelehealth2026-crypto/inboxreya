'use client'

import { useEffect, useMemo, useState } from 'react'
import { AlertCircle, FileText, ImageIcon, LayoutTemplate, Video } from 'lucide-react'
import { BroadcastTemplateMutationInput, useCreateBroadcastTemplate, useUpdateBroadcastTemplate } from '@/hooks/use-broadcasts'
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
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'

interface BroadcastTemplateCreateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: BroadcastTemplate | null
  forceCreate?: boolean
  onSaved?: (template: BroadcastTemplate) => void
}

type TemplateType = 'text' | 'image' | 'flex' | 'video'

const typeOptions: Array<{ value: TemplateType; label: string; icon: typeof FileText }> = [
  { value: 'text', label: 'ข้อความ', icon: FileText },
  { value: 'image', label: 'รูปภาพ', icon: ImageIcon },
  { value: 'flex', label: 'Flex', icon: LayoutTemplate },
  { value: 'video', label: 'วิดีโอ', icon: Video },
]

function PreviewBlock({ type, content, mediaUrl, flexJson }: { type: TemplateType; content: string; mediaUrl: string; flexJson: string }) {
  if (type === 'text') {
    return (
      <div className="rounded-2xl rounded-tl-sm bg-[#06C755] px-4 py-3 text-sm leading-6 text-white shadow-sm">
        <div className="whitespace-pre-wrap">{content || 'ตัวอย่างข้อความจะขึ้นตรงนี้'}</div>
      </div>
    )
  }

  if (type === 'image') {
    return mediaUrl ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={mediaUrl} alt="Template media preview" className="max-h-[280px] w-full rounded-xl border object-cover" />
    ) : (
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        กรอก Media URL เพื่อดู preview
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="space-y-3">
        <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
          เฟสนี้ preview วิดีโอเป็นลิงก์ก่อน
        </div>
        {mediaUrl ? <a href={mediaUrl} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">เปิดวิดีโอในแท็บใหม่</a> : null}
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
      <div className="flex min-h-[200px] items-center justify-center rounded-xl border border-dashed text-sm text-muted-foreground">
        ใส่ Flex JSON ที่ถูกต้องเพื่อดู preview
      </div>
    )
  }
}

export function BroadcastTemplateCreateDialog({ open, onOpenChange, template, forceCreate = false, onSaved }: BroadcastTemplateCreateDialogProps) {
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
  const canEditInCenter = template?.sourceTable === 'templates' || template?.sourceTable === 'flex_templates'
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
      const payload: BroadcastTemplateMutationInput = {
        name: name.trim(),
        templateType,
        categoryLabel: categoryLabel.trim() || undefined,
        content: templateType === 'text' ? content.trim() : undefined,
        mediaUrl: templateType === 'image' || templateType === 'video' ? mediaUrl.trim() : undefined,
        flexContent: templateType === 'flex' ? JSON.parse(flexJson) : undefined,
      }

      const response = isEditMode && template?.sourceTable && template.sourceId
        ? await updateTemplate.mutateAsync({
            sourceTable: template.sourceTable as 'templates' | 'flex_templates',
            sourceId: template.sourceId,
            data: payload,
          })
        : await createTemplate.mutateAsync(payload)

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
      <DialogContent className="!block max-w-5xl p-0 overflow-hidden">
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

        <form onSubmit={handleSubmit} className="grid gap-0 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="space-y-4 px-6 py-5">
            <div className="space-y-2">
              <Label>ประเภท template</Label>
              <Tabs value={templateType} onValueChange={(value) => setTemplateType(value as TemplateType)}>
                <TabsList className="grid w-full grid-cols-4">
                  {typeOptions.map((option) => {
                    const Icon = option.icon
                    const isDisabled = isFlexEditMode
                      ? option.value !== 'flex'
                      : (isEditMode && template?.sourceTable === 'templates' ? option.value === 'flex' : false)

                    return (
                      <TabsTrigger key={option.value} value={option.value} className="gap-1" disabled={isDisabled}>
                        <Icon className="h-4 w-4" />
                        <span className="hidden sm:inline">{option.label}</span>
                      </TabsTrigger>
                    )
                  })}
                </TabsList>
              </Tabs>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-name">ชื่อ template</Label>
              <Input id="template-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="เช่น โปรโมชันยาประจำเดือน" maxLength={100} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="template-category">หมวดหมู่ / โฟลเดอร์</Label>
              <Input id="template-category" value={categoryLabel} onChange={(e) => setCategoryLabel(e.target.value)} placeholder="เช่น โปรโมชั่น, Follow-up, Flex Catalog" maxLength={100} />
            </div>

            {templateType === 'text' && (
              <div className="space-y-2">
                <Label htmlFor="template-content">ข้อความ</Label>
                <Textarea id="template-content" value={content} onChange={(e) => setContent(e.target.value)} rows={8} placeholder="ข้อความที่จะใช้ใน broadcast" />
              </div>
            )}

            {(templateType === 'image' || templateType === 'video') && (
              <div className="space-y-2">
                <Label htmlFor="template-media-url">Media URL</Label>
                <Input id="template-media-url" value={mediaUrl} onChange={(e) => setMediaUrl(e.target.value)} placeholder="https://..." />
              </div>
            )}

            {templateType === 'flex' && (
              <div className="space-y-2">
                <Label htmlFor="template-flex-json">Flex JSON</Label>
                <Textarea
                  id="template-flex-json"
                  value={flexJson}
                  onChange={(e) => setFlexJson(e.target.value)}
                  rows={12}
                  className="font-mono text-xs"
                  placeholder={'{"type":"flex","altText":"ข้อความ","contents":{"type":"bubble","body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"Hello"}]}}}'}
                />
                {flexError ? (
                  <div className="flex items-center gap-2 text-sm text-destructive">
                    <AlertCircle className="h-4 w-4" />
                    {flexError}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">รองรับทั้ง payload แบบเต็ม (`type:flex`) หรือ bubble/carousel โดยระบบจะ normalize ให้</p>
                )}
              </div>
            )}
          </div>

          <div className="border-t bg-muted/20 px-6 py-5 lg:border-l lg:border-t-0">
            <div className="mb-3">
              <h3 className="text-sm font-medium">Preview</h3>
              <p className="text-xs text-muted-foreground">เช็กหน้าตา template ก่อนบันทึก</p>
            </div>
            <Card className="shadow-none">
              <CardContent className="pt-6">
                <PreviewBlock type={templateType} content={content} mediaUrl={mediaUrl} flexJson={flexJson} />
              </CardContent>
            </Card>
          </div>

          <DialogFooter className="border-t px-6 py-4 lg:col-span-2">
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
