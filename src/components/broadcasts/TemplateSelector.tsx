'use client'

import { useState } from 'react'
import { BroadcastTemplate, FlexMessage } from '@/types/broadcast'
import { FlexPreview } from '@/components/inbox/FlexPreview'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { FileText, Image, Layout, Check } from 'lucide-react'
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
  video: Image,
}

const categoryLabels = {
  text: 'ข้อความ',
  image: 'รูปภาพ',
  flex: 'Flex Message',
  video: 'วิดีโอ',
}

export function TemplateSelector({
  templates,
  selectedTemplateId,
  onSelect,
  onCustomFlex,
}: TemplateSelectorProps) {
  const [previewTemplate, setPreviewTemplate] = useState<BroadcastTemplate | null>(null)
  const [activeTab, setActiveTab] = useState('all')

  const filteredTemplates = activeTab === 'all' 
    ? templates 
    : templates.filter(t => t.category === activeTab)

  const selectedTemplate = templates.find(t => t.id === selectedTemplateId)

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Template List */}
      <Card className="h-[500px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">เลือกเทมเพลต</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="w-full justify-start rounded-none border-b bg-transparent px-4">
              <TabsTrigger value="all">ทั้งหมด</TabsTrigger>
              <TabsTrigger value="text">ข้อความ</TabsTrigger>
              <TabsTrigger value="flex">Flex</TabsTrigger>
              <TabsTrigger value="image">รูปภาพ</TabsTrigger>
              <TabsTrigger value="video">วิดีโอ</TabsTrigger>
            </TabsList>
            
            <ScrollArea className="h-[380px]">
              <div className="p-4 space-y-2">
                {filteredTemplates.map((template) => {
                  const Icon = categoryIcons[template.category]
                  const isSelected = selectedTemplateId === template.id
                  
                  return (
                    <div
                      key={template.id}
                      className={cn(
                        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                        isSelected 
                          ? "border-primary bg-primary/5 ring-1 ring-primary" 
                          : "border-border hover:border-primary/50 hover:bg-muted/50"
                      )}
                      onClick={() => {
                        onSelect(template)
                        setPreviewTemplate(template)
                      }}
                      onMouseEnter={() => setPreviewTemplate(template)}
                    >
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex items-center justify-center",
                        isSelected ? "bg-primary text-primary-foreground" : "bg-muted"
                      )}>
                        {isSelected ? (
                          <Check className="w-5 h-5" />
                        ) : (
                          <Icon className="w-5 h-5" />
                        )}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground truncate">
                            {template.description}
                          </p>
                        )}
                      </div>
                      
                      <Badge variant="secondary" className="shrink-0">
                        {categoryLabels[template.category]}
                      </Badge>
                    </div>
                  )
                })}
                
                {/* Custom Flex Option */}
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all",
                    selectedTemplateId === -1
                      ? "border-primary bg-primary/5 ring-1 ring-primary" 
                      : "border-border hover:border-primary/50 hover:bg-muted/50"
                  )}
                  onClick={() => {
                    onSelect({ id: -1 } as BroadcastTemplate)
                    setPreviewTemplate(null)
                  }}
                >
                  <div className={cn(
                    "w-10 h-10 rounded-lg flex items-center justify-center",
                    selectedTemplateId === -1 ? "bg-primary text-primary-foreground" : "bg-muted"
                  )}>
                    <Layout className="w-5 h-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">สร้าง Flex เอง</p>
                    <p className="text-sm text-muted-foreground">
                      เขียน JSON Flex Message เอง
                    </p>
                  </div>
                </div>
              </div>
            </ScrollArea>
          </Tabs>
        </CardContent>
      </Card>

      {/* Preview Panel */}
      <Card className="h-[500px]">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">ตัวอย่าง</CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[400px]">
            {previewTemplate?.flexContent ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{previewTemplate.name}</span>
                  <span>•</span>
                  <span>{categoryLabels[previewTemplate.category]}</span>
                </div>
                
                <div className="bg-gradient-to-br from-[#7494a5] to-[#5a7a8a] p-4 rounded-xl">
                  <FlexPreview flex={previewTemplate.flexContent} />
                </div>
                
                {previewTemplate.content && (
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm font-medium mb-1">ข้อความ:</p>
                    <p className="text-sm whitespace-pre-wrap">{previewTemplate.content}</p>
                  </div>
                )}
              </div>
            ) : previewTemplate?.mediaUrl ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{previewTemplate.name}</span>
                  <span>•</span>
                  <span>{categoryLabels[previewTemplate.category]}</span>
                </div>

                {previewTemplate.category === 'image' ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={previewTemplate.mediaUrl} alt={previewTemplate.name} className="w-full rounded-xl border object-cover" />
                ) : (
                  <div className="space-y-2 rounded-xl border border-dashed p-4 text-sm text-muted-foreground">
                    <p>ตัวอย่างวิดีโอในเฟสนี้จะแสดงเป็นลิงก์</p>
                    <a href={previewTemplate.mediaUrl} target="_blank" rel="noopener noreferrer" className="text-primary underline-offset-4 hover:underline">
                      เปิดวิดีโอในแท็บใหม่
                    </a>
                  </div>
                )}
              </div>
            ) : previewTemplate?.content ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">{previewTemplate.name}</span>
                  <span>•</span>
                  <span>{categoryLabels[previewTemplate.category]}</span>
                </div>
                
                <div className="p-4 bg-[#06C755] text-white rounded-2xl rounded-tl-sm max-w-[80%]">
                  <p className="whitespace-pre-wrap">{previewTemplate.content}</p>
                </div>
              </div>
            ) : selectedTemplateId === -1 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Layout className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>เลือก "สร้าง Flex เอง" เพื่อเขียน JSON</p>
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <p>เลื่อนเมาส์หรือคลิกที่เทมเพลตเพื่อดูตัวอย่าง</p>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  )
}
