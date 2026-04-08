'use client'

import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { BroadcastTemplate, CreateBroadcastInput, FlexMessage } from '@/types/broadcast'
import { useBroadcastTemplates, useCreateBroadcast } from '@/hooks/use-broadcasts'
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
import { CalendarIcon, Send, Clock, Users, MessageSquare, Layout, ChevronRight, ChevronLeft, AlertCircle } from 'lucide-react'
import { ScrollArea } from '@/components/ui/scroll-area'

const createBroadcastSchema = z.object({
  content: z.string().optional(),
  scheduledAt: z.date().optional(),
  targetSegmentId: z.number().optional(),
  targetCustomerIds: z.array(z.number()).optional(),
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
  
  const { data: templatesData } = useBroadcastTemplates()
  const createBroadcast = useCreateBroadcast()
  
  const templates = templatesData?.data || []
  
  const form = useForm<CreateBroadcastForm>({
    resolver: zodResolver(createBroadcastSchema),
    defaultValues: {
      content: '',
      targetCustomerIds: [],
    },
  })

  const isCustomFlexSelected = selectedTemplate?.id === -1
  const isTemplateSelectionSupported = !!selectedTemplate && !isCustomFlexSelected && selectedTemplate.category !== 'flex'
  const isSubmissionSupported = isTemplateSelectionSupported
  
  const onSubmit = async (values: CreateBroadcastForm) => {
    if (!isSubmissionSupported) {
      setCustomFlexError('ตอนนี้ broadcast composer รองรับ text / image / video template ก่อน ส่วน flex และ custom flex จะตามมาเมื่อ write flow รองรับครบ')
      return
    }

    const input: CreateBroadcastInput = {
      templateId: selectedTemplate?.sourceId,
      templateSourceTable: selectedTemplate?.sourceTable,
      messageType: selectedTemplate?.category,
      scheduledAt: sendNow ? undefined : values.scheduledAt?.toISOString(),
    }
    
    // Handle different template types
    if (selectedTemplate?.id === -1) {
      // Custom Flex
      try {
        const flexContent: FlexMessage = JSON.parse(customFlexContent)
        input.flexContent = flexContent
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
      // Manual text input
      input.content = values.content
    }
    
    try {
      await createBroadcast.mutateAsync(input)
      onOpenChange(false)
      onSuccess?.()
      resetForm()
    } catch (error) {
      console.error('Failed to create broadcast:', error)
    }
  }
  
  const resetForm = () => {
    setStep(1)
    setSelectedTemplate(null)
    setCustomFlexContent('')
    setCustomFlexError(null)
    setSendNow(true)
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
                  
                  <Tabs defaultValue="all">
                    <TabsList className="grid w-full grid-cols-3">
                      <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
                      <TabsTrigger value="segment">กลุ่มลูกค้า</TabsTrigger>
                      <TabsTrigger value="manual">เลือกเอง</TabsTrigger>
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
                    
                    <TabsContent value="segment">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-muted-foreground">
                            ฟีเจอร์นี้กำลังพัฒนา...
                          </p>
                        </CardContent>
                      </Card>
                    </TabsContent>
                    
                    <TabsContent value="manual">
                      <Card>
                        <CardContent className="p-4">
                          <p className="text-muted-foreground">
                            ฟีเจอร์นี้กำลังพัฒนา...
                          </p>
                        </CardContent>
                      </Card>
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
                        <p><span className="text-muted-foreground">กลุ่มเป้าหมาย:</span> ลูกค้าทั้งหมด</p>
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
                  disabled={step === 1 && !isSubmissionSupported}
                >
                  ถัดไป
                  <ChevronRight className="w-4 h-4 ml-2" />
                </Button>
              ) : (
                <Button 
                  type="submit"
                  disabled={createBroadcast.isPending || !isSubmissionSupported || (!sendNow && !form.watch('scheduledAt'))}
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
