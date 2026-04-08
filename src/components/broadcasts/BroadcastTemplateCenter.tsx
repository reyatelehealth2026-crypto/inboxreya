/* eslint-disable @next/next/no-img-element */
'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { Copy, Edit3, Eye, FileText, ImageIcon, LayoutTemplate, Plus, RefreshCw, Search, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { useBroadcastTemplates, useDeleteBroadcastTemplate } from '@/hooks/use-broadcasts'
import { BroadcastTemplate } from '@/types/broadcast'
import { BroadcastTemplateCreateDialog } from '@/components/broadcasts/BroadcastTemplateCreateDialog'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { Input } from '@/components/ui/input'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { Separator } from '@/components/ui/separator'
import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'

const categoryLabels: Record<BroadcastTemplate['category'], string> = {
  text: 'ข้อความ',
  image: 'รูปภาพ',
  flex: 'Flex',
  video: 'วิดีโอ',
}

const categoryIcons: Record<BroadcastTemplate['category'], typeof FileText> = {
  text: FileText,
  image: ImageIcon,
  flex: LayoutTemplate,
  video: ImageIcon,
}

function TextBubblePreview({ text }: { text?: string }) {
  return (
    <div className="rounded-2xl rounded-tl-sm bg-[#06C755] px-4 py-3 text-sm leading-6 text-white shadow-sm">
      <div className="whitespace-pre-wrap">{text || '-'}</div>
    </div>
  )
}

function MediaPreview({ url, type }: { url?: string; type: 'image' | 'video' }) {
  if (!url) {
    return (
      <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-400">
        ไม่มี URL สำหรับ preview
      </div>
    )
  }

  if (type === 'video') {
    return (
      <div className="space-y-3">
        <div className="flex min-h-[180px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 text-sm text-slate-500">
          Preview วิดีโอแบบ inline ยังไม่เปิดในเฟสนี้
        </div>
        <a href={url} target="_blank" rel="noopener noreferrer" className="text-sm text-primary underline-offset-4 hover:underline">
          เปิดไฟล์วิดีโอในแท็บใหม่
        </a>
      </div>
    )
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt="Template preview" className="h-auto w-full object-cover" />
    </div>
  )
}

export function BroadcastTemplateCenter() {
  const [search, setSearch] = useState('')
  const [activeTab, setActiveTab] = useState<'all' | BroadcastTemplate['category']>('all')
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<BroadcastTemplate | null>(null)
  const [duplicatingTemplate, setDuplicatingTemplate] = useState<BroadcastTemplate | null>(null)
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const { toast } = useToast()
  const { data, isLoading, isFetching, refetch } = useBroadcastTemplates({ search })
  const deleteTemplate = useDeleteBroadcastTemplate()
  const templates: BroadcastTemplate[] = data?.data || []
  const meta = data?.meta

  const filteredTemplates = useMemo(() => {
    if (activeTab === 'all') return templates
    return templates.filter((template) => template.category === activeTab)
  }, [activeTab, templates])

  const [selectedId, setSelectedId] = useState<number | null>(null)

  useEffect(() => {
    if (!filteredTemplates.length) {
      setSelectedId(null)
      return
    }
    if (!filteredTemplates.some((template) => template.id === selectedId)) {
      setSelectedId(filteredTemplates[0].id)
    }
  }, [filteredTemplates, selectedId])

  const selectedTemplate = filteredTemplates.find((template) => template.id === selectedId) || null
  const canManageSelectedTemplate = selectedTemplate?.sourceTable === 'templates' || selectedTemplate?.sourceTable === 'flex_templates'

  const handleDeleteTemplate = async () => {
    if (!selectedTemplate?.sourceTable || !selectedTemplate.sourceId || !canManageSelectedTemplate) return

    try {
      await deleteTemplate.mutateAsync({
        sourceTable: selectedTemplate.sourceTable,
        sourceId: selectedTemplate.sourceId,
      })
      toast({ title: 'ลบ template สำเร็จ' })
      setIsDeleteOpen(false)
      setSelectedId(null)
    } catch (error) {
      toast({
        title: 'ลบ template ไม่สำเร็จ',
        description: error instanceof Error ? error.message : 'กรุณาลองใหม่อีกครั้ง',
        variant: 'destructive',
      })
    }
  }

  return (
    <>
      <BroadcastTemplateCreateDialog
        open={isCreateOpen}
        onOpenChange={setIsCreateOpen}
        onSaved={(template) => {
          setSearch('')
          setActiveTab('all')
          setSelectedId(template.id)
        }}
      />

      <BroadcastTemplateCreateDialog
        open={!!editingTemplate}
        template={editingTemplate}
        onOpenChange={(open) => {
          if (!open) setEditingTemplate(null)
        }}
        onSaved={(template) => {
          setEditingTemplate(null)
          setSelectedId(template.id)
        }}
      />

      <BroadcastTemplateCreateDialog
        open={!!duplicatingTemplate}
        template={duplicatingTemplate}
        forceCreate
        onOpenChange={(open) => {
          if (!open) setDuplicatingTemplate(null)
        }}
        onSaved={(template) => {
          setDuplicatingTemplate(null)
          setSelectedId(template.id)
        }}
      />

      <AlertDialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>ลบ template นี้?</AlertDialogTitle>
            <AlertDialogDescription>
              การลบจะมีผลกับ template กลางใน Broadcast Center โดยตรง และไม่สามารถกู้คืนได้จากหน้านี้
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>ยกเลิก</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTemplate} className="bg-red-600 text-white hover:bg-red-700">
              ยืนยันการลบ
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card className="min-h-[620px]">
        <CardHeader className="space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <CardTitle className="text-xl">Template Library</CardTitle>
              <CardDescription>
                รวม template จาก quick reply, generic templates และ flex templates เพื่อใช้กับ broadcast
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Button size="sm" onClick={() => setIsCreateOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                สร้าง template
              </Button>
              <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                <RefreshCw className={cn('mr-2 h-4 w-4', isFetching && 'animate-spin')} />
                รีเฟรช
              </Button>
              <Button asChild variant="secondary" size="sm">
                <Link href="/inbox/templates">เปิด quick reply เดิม</Link>
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
                placeholder="ค้นหาชื่อ template หรือคำอธิบาย"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">รวม {templates.length}</Badge>
              {meta?.quickReplyCount != null && <Badge variant="outline">quick reply {meta.quickReplyCount}</Badge>}
              {meta?.genericTemplateCount != null && <Badge variant="outline">generic {meta.genericTemplateCount}</Badge>}
              {meta?.flexTemplateCount != null && <Badge variant="outline">flex {meta.flexTemplateCount}</Badge>}
            </div>
          </div>

          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'all' | BroadcastTemplate['category'])}>
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="text">ข้อความ</TabsTrigger>
              <TabsTrigger value="image">รูปภาพ</TabsTrigger>
              <TabsTrigger value="flex">Flex</TabsTrigger>
              <TabsTrigger value="video">วิดีโอ</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardHeader>

        <CardContent>
          <ScrollArea className="h-[420px] pr-1">
            <div className="space-y-2">
              {isLoading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="rounded-xl border p-4">
                    <div className="h-4 w-40 animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-3 w-full animate-pulse rounded bg-muted" />
                    <div className="mt-2 h-3 w-32 animate-pulse rounded bg-muted" />
                  </div>
                ))
              ) : filteredTemplates.length === 0 ? (
                <div className="rounded-xl border border-dashed p-10 text-center text-sm text-muted-foreground">
                  ไม่พบ template ที่ตรงเงื่อนไข
                </div>
              ) : (
                filteredTemplates.map((template) => {
                  const Icon = categoryIcons[template.category]
                  const isSelected = template.id === selectedId
                  return (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setSelectedId(template.id)}
                      className={cn(
                        'w-full rounded-xl border p-4 text-left transition-colors',
                        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/40 hover:bg-muted/40'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn('rounded-lg p-2', isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground')}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="truncate font-medium">{template.name}</p>
                            <Badge variant={isSelected ? 'default' : 'secondary'}>{categoryLabels[template.category]}</Badge>
                            {template.sourceTable && <Badge variant="outline">{template.sourceTable}</Badge>}
                          </div>
                          <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                            {template.description || template.content || 'ไม่มีคำอธิบาย'}
                          </p>
                        </div>
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      <Card className="min-h-[620px]">
        <CardHeader>
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-primary" />
            <CardTitle className="text-xl">Preview</CardTitle>
          </div>
          <CardDescription>
            พรีวิว template ที่เลือกในรูปแบบใกล้เคียงการใช้งานจริงของ broadcast
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!selectedTemplate ? (
            <div className="flex min-h-[420px] flex-col items-center justify-center rounded-xl border border-dashed bg-muted/30 p-8 text-center">
              <Sparkles className="mb-3 h-10 w-10 text-muted-foreground/60" />
              <p className="text-sm text-muted-foreground">เลือก template จากฝั่งซ้ายเพื่อดู preview</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{categoryLabels[selectedTemplate.category]}</Badge>
                {selectedTemplate.sourceTable && <Badge variant="outline">source: {selectedTemplate.sourceTable}</Badge>}
                <Badge variant="secondary">created {new Date(selectedTemplate.createdAt).toLocaleDateString('th-TH')}</Badge>
              </div>

              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{selectedTemplate.name}</h3>
                  <p className="mt-1 text-sm text-muted-foreground">{selectedTemplate.description || 'ไม่มีคำอธิบายเพิ่มเติม'}</p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button variant="outline" size="sm" onClick={() => setDuplicatingTemplate(selectedTemplate)}>
                    <Copy className="mr-2 h-4 w-4" />
                    ทำสำเนา
                  </Button>
                  {canManageSelectedTemplate ? (
                    <>
                      <Button variant="outline" size="sm" onClick={() => setEditingTemplate(selectedTemplate)}>
                        <Edit3 className="mr-2 h-4 w-4" />
                        แก้ไข
                      </Button>
                      <Button variant="outline" size="sm" className="border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700" onClick={() => setIsDeleteOpen(true)}>
                        <Trash2 className="mr-2 h-4 w-4" />
                        ลบ
                      </Button>
                    </>
                  ) : selectedTemplate.sourceTable === 'quick_reply_templates' ? (
                    <Button asChild variant="secondary" size="sm">
                      <Link href="/inbox/templates">แก้ในหน้า Quick Reply เดิม</Link>
                    </Button>
                  ) : null}
                </div>
              </div>

              <Separator />

              {selectedTemplate.category === 'flex' && selectedTemplate.flexContent ? (
                <div className="rounded-2xl bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4">
                  <FlexPreview flex={selectedTemplate.flexContent} />
                </div>
              ) : selectedTemplate.category === 'image' ? (
                <MediaPreview url={selectedTemplate.mediaUrl} type="image" />
              ) : selectedTemplate.category === 'video' ? (
                <MediaPreview url={selectedTemplate.mediaUrl} type="video" />
              ) : (
                <TextBubblePreview text={selectedTemplate.content} />
              )}

              <Card className="border-dashed bg-muted/30 shadow-none">
                <CardContent className="pt-6 text-sm text-muted-foreground">
                  <div className="flex items-start gap-3">
                    <Wand2 className="mt-0.5 h-4 w-4 text-primary" />
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">สถานะของเฟสนี้</p>
                      <p>
                        เฟสนี้เริ่มรองรับ <strong>create + library + preview</strong> ก่อน โดยแยก template กลางสำหรับ broadcast
                        ออกจาก quick reply เดิม และยังคงกันไม่ให้ broadcast composer เขียนเคส image/flex ที่ backend ส่งจริงยังไม่ครบ
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </>
  )
}
