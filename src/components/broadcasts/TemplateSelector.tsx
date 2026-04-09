'use client'

import { useMemo, useState } from 'react'
import { BroadcastTemplate, FlexMessage } from '@/types/broadcast'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { FileText, Image, Layout, Check, Video } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TemplateSelectorProps {
  templates: BroadcastTemplate[]
  selectedTemplateId?: number
  onSelect: (template: BroadcastTemplate | null) => void
  onCustomFlex?: (flexContent: FlexMessage) => void
}

const categoryIcons = {
  text: FileText,
  image: Image,
  flex: Layout,
  video: Video,
}

const categoryLabels = {
  text: 'ข้อความ',
  image: 'รูปภาพ',
  flex: 'Flex Message',
  video: 'วิดีโอ',
}

const filterOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'text', label: 'ข้อความ' },
  { value: 'flex', label: 'Flex' },
  { value: 'image', label: 'รูปภาพ' },
  { value: 'video', label: 'วิดีโอ' },
] as const

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
}: TemplateSelectorProps) {
  const [previewTemplate, setPreviewTemplate] = useState<BroadcastTemplate | null>(null)
  const [activeFilter, setActiveFilter] = useState<(typeof filterOptions)[number]['value']>('all')

  const filteredTemplates = useMemo(() => (
    activeFilter === 'all'
      ? templates
      : templates.filter((template) => template.category === activeFilter)
  ), [activeFilter, templates])

  const selectedTemplate = templates.find((template) => template.id === selectedTemplateId)
  const activePreview = previewTemplate || selectedTemplate || null

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(320px,0.95fr)]">
      <Card className="flex min-h-[560px] flex-col">
        <CardHeader className="space-y-4">
          <CardTitle className="text-lg">เลือกเทมเพลต</CardTitle>
          <div className="flex flex-wrap gap-2">
            {filterOptions.map((option) => {
              const active = activeFilter === option.value
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setActiveFilter(option.value)}
                  className={cn(
                    'rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
                    active
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-muted-foreground hover:border-primary/40 hover:text-foreground'
                  )}
                >
                  {option.label}
                </button>
              )
            })}
          </div>
        </CardHeader>

        <CardContent className="min-h-0 flex-1 pt-0">
          <ScrollArea className="h-[420px] pr-1">
            <div className="space-y-3">
              {filteredTemplates.map((template) => {
                const Icon = categoryIcons[template.category]
                const isSelected = selectedTemplateId === template.id

                return (
                  <button
                    key={template.id}
                    type="button"
                    className={cn(
                      'flex w-full items-start gap-3 rounded-2xl border p-4 text-left transition-all',
                      isSelected
                        ? 'border-primary bg-primary/5 ring-1 ring-primary'
                        : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30'
                    )}
                    onClick={() => {
                      onSelect(template)
                      setPreviewTemplate(template)
                    }}
                    onMouseEnter={() => setPreviewTemplate(template)}
                  >
                    <div className={cn(
                      'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                      isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                    )}>
                      {isSelected ? <Check className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>

                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{template.name}</p>
                        <Badge variant={isSelected ? 'default' : 'secondary'}>
                          {categoryLabels[template.category]}
                        </Badge>
                      </div>
                      <p className="line-clamp-2 text-sm text-muted-foreground">
                        {template.description || template.content || 'ไม่มีคำอธิบายเพิ่มเติม'}
                      </p>
                    </div>
                  </button>
                )
              })}

              <button
                type="button"
                className={cn(
                  'flex w-full items-start gap-3 rounded-2xl border border-dashed p-4 text-left transition-all',
                  selectedTemplateId === -1
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border bg-background hover:border-primary/40 hover:bg-muted/30'
                )}
                onClick={() => {
                  onSelect({ id: -1 } as BroadcastTemplate)
                  setPreviewTemplate(null)
                }}
              >
                <div className={cn(
                  'flex h-11 w-11 shrink-0 items-center justify-center rounded-xl',
                  selectedTemplateId === -1 ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}>
                  <Layout className="h-5 w-5" />
                </div>
                <div className="space-y-1">
                  <p className="font-medium">สร้าง Flex เอง</p>
                  <p className="text-sm text-muted-foreground">ใช้ custom JSON สำหรับ Flex Message</p>
                </div>
              </button>
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="flex min-h-[560px] flex-col">
        <CardHeader className="space-y-2">
          <CardTitle className="text-lg">Preview</CardTitle>
          <p className="text-sm text-muted-foreground">ดูตัวอย่างเทมเพลตก่อนเลือกใช้งาน</p>
        </CardHeader>

        <CardContent className="min-h-0 flex-1">
          <ScrollArea className="h-[440px] pr-1">
            {activePreview?.flexContent ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{activePreview.name}</span>
                  <span>•</span>
                  <span>{categoryLabels[activePreview.category]}</span>
                </div>

                <div className="rounded-xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
                  <FlexPreview flex={activePreview.flexContent} />
                </div>

                {activePreview.content ? (
                  <div className="rounded-lg bg-muted p-4">
                    <p className="mb-1 text-sm font-medium">ข้อความ:</p>
                    <p className="whitespace-pre-wrap text-sm">{activePreview.content}</p>
                  </div>
                ) : null}
              </div>
            ) : activePreview?.mediaUrl ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{activePreview.name}</span>
                  <span>•</span>
                  <span>{categoryLabels[activePreview.category]}</span>
                </div>

                {activePreview.category === 'image' ? (
                  <img src={activePreview.mediaUrl} alt={activePreview.name} className="w-full rounded-xl border object-cover" />
                ) : (
                  <div className="space-y-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    <p>ตัวอย่างวิดีโอในเฟสนี้จะแสดงเป็นลิงก์ก่อน</p>
                    <a href={activePreview.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
                      เปิดวิดีโอในแท็บใหม่
                    </a>
                  </div>
                )}
              </div>
            ) : activePreview?.content ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{activePreview.name}</span>
                  <span>•</span>
                  <span>{categoryLabels[activePreview.category]}</span>
                </div>

                <div className="max-w-[85%] rounded-2xl rounded-tl-sm bg-[#06C755] p-4 text-white">
                  <p className="whitespace-pre-wrap">{activePreview.content}</p>
                </div>
              </div>
            ) : selectedTemplateId === -1 ? (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
                <Layout className="mb-3 h-12 w-12 opacity-50" />
                <p>เลือก "สร้าง Flex เอง" แล้วกรอก JSON ในขั้นตอนถัดไป</p>
              </div>
            ) : (
              <div className="flex h-full min-h-[320px] flex-col items-center justify-center rounded-xl border border-dashed text-center text-muted-foreground">
                <p>เลือกหรือวางเมาส์บนเทมเพลตเพื่อดูตัวอย่าง</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
