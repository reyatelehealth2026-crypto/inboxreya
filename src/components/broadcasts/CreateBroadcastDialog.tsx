'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { BroadcastTemplate, CreateBroadcastInput, FlexMessage } from '@/types/broadcast'
import { useBroadcastTemplates, useCreateBroadcast, useSendBroadcast } from '@/hooks/use-broadcasts'
import { useTags } from '@/hooks/use-tags'
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
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { cn } from '@/lib/utils'
import { format } from 'date-fns'
import { th } from 'date-fns/locale'
import { CalendarIcon, Send, Clock, Users, MessageSquare, Layout, ChevronRight, ChevronLeft, AlertCircle, Tag, Loader2 } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

const createBroadcastSchema = z.object({
  content: z.string().optional(),
  scheduledAt: z.date().optional(),
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
  const [customFlexContent, setCustomFlexContent] = useState<string>('')
  const [customFlexError, setCustomFlexError] = useState<string | null>(null)
  const [sendNow, setSendNow] = useState(true)
  const [targetMode, setTargetMode] = useState<'all' | 'tags'>('all')

  const { data: templatesData } = useBroadcastTemplates()
  const { data: tags = [], isLoading: isTagsLoading } = useTags()
  const createBroadcast = useCreateBroadcast()
  const sendBroadcast = useSendBroadcast()

  const templates = templatesData?.data || []

  const form = useForm<CreateBroadcastForm>({
    resolver: zodResolver(createBroadcastSchema),
    defaultValues: {
      content: '',
      targetCustomerIds: [],
      targetTagIds: [],
    },
  })

  const isCustomFlexSelected = selectedTemplate?.id === -1
  const isSubmissionSupported = !!selectedTemplate
  const selectedTagIds = form.watch('targetTagIds') || []
  const selectedTags = tags.filter((tag) => selectedTagIds.includes(Number(tag.id)))
  const isTargetSelectionValid = targetMode === 'all' || selectedTagIds.length > 0

  const toggleTargetTag = (tagId: number) => {
    const nextTargetTagIds = selectedTagIds.includes(tagId)
      ? selectedTagIds.filter((id) => id !== tagId)
      : [...selectedTagIds, tagId]

    form.setValue('targetTagIds', nextTargetTagIds, {
      shouldDirty: true,
      shouldValidate: true,
    })
  }

  const onSubmit = async (values: CreateBroadcastForm) => {
    if (!isSubmissionSupported) {
      setCustomFlexError('กรุณาเลือก template หรือ custom flex ก่อนส่ง broadcast')
      return
    }

    const input: CreateBroadcastInput = {
      templateId: selectedTemplate?.sourceId,
      templateSourceTable: selectedTemplate?.sourceTable,
      messageType: selectedTemplate?.category,
      scheduledAt: sendNow ? undefined : values.scheduledAt?.toISOString(),
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
    } else {
      input.content = values.content
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

      onOpenChange(false)
      onSuccess?.()
      resetForm()
    } catch (error) {
      console.error('Failed to create/send broadcast:', error)
    }
  }

  const resetForm = () => {
    setStep(1)
    setSelectedTemplate(null)
    setCustomFlexContent('')
    setCustomFlexError(null)
    setSendNow(true)
    setTargetMode('all')
    form.reset()
  }

  const totalSteps = 3

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] p-0 overflow-hidden">
        <DialogHeader className="px-6 py-4 border-b">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-xl">สร้าง Broadcast ใหม่</DialogTitle>
              <DialogDescription>
                ส่งข้อความถึงลูกค้าหลายคนพร้อมกัน
              </DialogDescription>
            </div>
            <div className="flex items-center gap-2">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                    step > i + 1
                      ? "bg-primary text-primary-foreground"
                      : step === i + 1
                      ? "bg-primary/10 text-primary border-2 border-primary"
                      : "bg-muted text-muted-foreground"
                  )}
                >
                  {step > i + 1 ? '✓' : i + 1}
                </div>
              ))}
            </div>
          </div>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col h-full">
            <ScrollArea className="flex-1 px-6 py-4">
              {/* Step 1: Select Template */}
              {step === 1 && (
                <div className="space-y-4">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <MessageSquare className="w-4 h-4" />
                    เลือกเทมเพลตหรือสร้างใหม่
                  </h3>

                  <TemplateSelector
                    templates={templates}
                    selectedTemplateId={selectedTemplate?.id}
                    onSelect={setSelectedTemplate}
                  />

                  {selectedTemplate && !isSubmissionSupported && (
                    <Card className="border-amber-300 bg-amber-50">
                      <CardContent className="p-4 text-sm text-amber-900">
                        <div className="flex items-start gap-2">
                          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                          <div className="space-y-1">
                            <p className="font-medium">template ประเภทนี้ยังอยู่ในเฟส groundwork</p>
                            <p>
                              ตอนนี้ composer เดินได้เสถียรกับ <strong>text / image / video template</strong> ก่อน
                              ส่วน <strong>flex และ custom flex</strong> จะตามมาเมื่อ backend write flow รองรับครบ เพื่อไม่ให้กดแล้ว fail เงียบ
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Custom Flex Input */}
                  {selectedTemplate?.id === -1 && (
                    <Card className="mt-4">
                      <CardContent className="p-4 space-y-4">
                        <label className="text-sm font-medium">Flex Message JSON</label>
                        <Textarea
                          value={customFlexContent}
                          onChange={(e) => {
                            setCustomFlexContent(e.target.value)
                            setCustomFlexError(null)
                            try {
                              JSON.parse(e.target.value)
                            } catch {
                              setCustomFlexError('JSON ไม่ถูกต้อง')
                            }
                          }}
                          placeholder={`{\n  "type": "flex",\n  "altText": "ข้อความ",\n  "contents": {\n    "type": "bubble",\n    ...\n  }\n}`}
                          className="font-mono text-sm min-h-[200px]"
                        />

                        {customFlexError && (
                          <div className="flex items-center gap-2 text-destructive text-sm">
                            <AlertCircle className="w-4 h-4" />
                            {customFlexError}
                          </div>
                        )}

                        {/* Preview Custom Flex */}
                        {customFlexContent && !customFlexError && (
                          <div className="mt-4">
                            <p className="text-sm font-medium mb-2">ตัวอย่าง:</p>
                            <div className="bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4 rounded-xl">
                              <FlexPreview flex={JSON.parse(customFlexContent)} />
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </div>
              )}

              {/* Step 2: Select Target */}
              {step === 2 && (
                <div className="space-y-6">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Users className="w-4 h-4" />
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
                          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
                          <p className="font-medium">ส่งถึงลูกค้าทั้งหมด</p>
                          <p className="text-sm text-muted-foreground">
                            ส่งข้อความถึงลูกค้าทุกคนที่เคยติดต่อ
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>

                    <TabsContent value="tags" className="space-y-4">
                      <Card>
                        <CardContent className="p-4 space-y-4">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <Tag className="h-4 w-4" />
                            เลือกอย่างน้อย 1 Tag เพื่อส่ง broadcast เฉพาะกลุ่ม
                          </div>

                          {isTagsLoading ? (
                            <div className="flex items-center justify-center py-10 text-sm text-muted-foreground">
                              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              กำลังโหลด Tag...
                            </div>
                          ) : tags.length === 0 ? (
                            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
                              ยังไม่มี Tag ให้เลือก
                            </div>
                          ) : (
                            <ScrollArea className="h-[280px] pr-2">
                              <div className="space-y-2">
                                {tags.map((tag) => {
                                  const numericTagId = Number(tag.id)
                                  const isSelected = selectedTagIds.includes(numericTagId)

                                  return (
                                    <button
                                      key={tag.id}
                                      type="button"
                                      onClick={() => toggleTargetTag(numericTagId)}
                                      className={cn(
                                        'flex w-full items-center justify-between rounded-lg border p-3 text-left transition-colors',
                                        isSelected ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-primary/40 hover:bg-muted/40'
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

              {/* Step 3: Schedule & Confirm */}
              {step === 3 && (
                <div className="space-y-6">
                  <h3 className="text-sm font-medium flex items-center gap-2">
                    <Clock className="w-4 h-4" />
                    ตั้งเวลาส่ง
                  </h3>

                  <div className="space-y-4">
                    <div className="flex gap-4">
                      <Button
                        type="button"
                        variant={sendNow ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setSendNow(true)}
                      >
                        <Send className="w-4 h-4 mr-2" />
                        ส่งทันที
                      </Button>
                      <Button
                        type="button"
                        variant={!sendNow ? 'default' : 'outline'}
                        className="flex-1"
                        onClick={() => setSendNow(false)}
                      >
                        <Clock className="w-4 h-4 mr-2" />
                        ตั้งเวลา
                      </Button>
                    </div>

                    {!sendNow && (
                      <FormField
                        control={form.control}
                        name="scheduledAt"
                        render={({ field }) => (
                          <FormItem className="flex flex-col">
                            <FormLabel>วันและเวลาที่ต้องการส่ง</FormLabel>
                            <Popover>
                              <PopoverTrigger asChild>
                                <FormControl>
                                  <Button
                                    variant="outline"
                                    className={cn(
                                      "w-full pl-3 text-left font-normal",
                                      !field.value && "text-muted-foreground"
                                    )}
                                  >
                                    {field.value ? (
                                      format(field.value, "PPP p", { locale: th })
                                    ) : (
                                      <span>เลือกวันและเวลา</span>
                                    )}
                                    <CalendarIcon className="ml-auto h-4 w-4 opacity-50" />
                                  </Button>
                                </FormControl>
                              </PopoverTrigger>
                              <PopoverContent className="w-auto p-0" align="start">
                                <Calendar
                                  mode="single"
                                  selected={field.value}
                                  onSelect={field.onChange}
                                  disabled={(date) => date < new Date()}
                                  initialFocus
                                />
                                <div className="p-3 border-t">
                                  <Input
                                    type="time"
                                    onChange={(e) => {
                                      const [hours, minutes] = e.target.value.split(':')
                                      const newDate = new Date(field.value || new Date())
                                      newDate.setHours(parseInt(hours), parseInt(minutes))
                                      field.onChange(newDate)
                                    }}
                                  />
                                </div>
                              </PopoverContent>
                            </Popover>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}
                  </div>

                  {/* Summary */}
                  <Card className="bg-muted">
                    <CardContent className="p-4 space-y-2">
                      <p className="font-medium">สรุป</p>
                      <div className="text-sm space-y-1">
                        <p><span className="text-muted-foreground">เทมเพลต:</span> {selectedTemplate?.name || 'ข้อความธรรมดา'}</p>
                        <p><span className="text-muted-foreground">กลุ่มเป้าหมาย:</span> {targetMode === 'tags' ? (selectedTags.length > 0 ? selectedTags.map((tag) => tag.name).join(', ') : 'ยังไม่ได้เลือก Tag') : 'ลูกค้าทั้งหมด'}</p>
                        <p><span className="text-muted-foreground">เวลาส่ง:</span> {sendNow ? 'ทันที' : 'ตามที่กำหนด'}</p>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}
            </ScrollArea>

            <DialogFooter className="px-6 py-4 border-t gap-2">
              {step > 1 && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setStep(step - 1)}
                >
                  <ChevronLeft className="w-4 h-4 mr-2" />
                  ย้อนกลับ
                </Button>
              )}

              {step < totalSteps ? (
                <Button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  disabled={(step === 1 && !isSubmissionSupported) || (step === 2 && !isTargetSelectionValid)}
                >
                  ถัดไป
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={createBroadcast.isPending || !isSubmissionSupported || !isTargetSelectionValid || (!sendNow && !form.watch('scheduledAt'))}
                >
                  {createBroadcast.isPending ? (
                    <>กำลังสร้าง...</>
                  ) : sendNow ? (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      ส่ง Broadcast
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4 mr-2" />
                      ตั้งเวลา Broadcast
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
