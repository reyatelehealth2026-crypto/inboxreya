"use client"

import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Search, Zap } from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import {
  substituteVariables,
  type TemplateVariable,
} from '@/lib/template-utils'
import type { BroadcastTemplate } from '@/types/broadcast'

interface Template {
  id: number
  name: string
  content: string
  category: string | null
  shortcuts: string[]
  variables: string[]
  usage_count: number | null
  last_used_at: Date | null
}

interface TemplatePickerModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: (content: string) => void
  onSelectFlex?: (flexContent: object, altText: string) => void
  customerData?: Record<string, string>
}

export function TemplatePickerModal({
  open,
  onOpenChange,
  onSelect,
  onSelectFlex,
  customerData = {},
}: TemplatePickerModalProps) {
  const [activeTab, setActiveTab] = useState<'text' | 'flex'>('text')
  const [search, setSearch] = useState('')
  const [flexSearch, setFlexSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<string>('all')
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null)
  const [variableValues, setVariableValues] = useState<Record<string, string>>({})
  
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const searchInputRef = useRef<HTMLInputElement>(null)

  // Fetch templates
  const { data, isLoading } = useQuery({
    queryKey: ['templates', { search, category: selectedCategory }],
    queryFn: async () => {
      const params = new URLSearchParams({ search, limit: '50' })
      if (selectedCategory !== 'all') {
        params.append('category', selectedCategory)
      }
      const response = await fetch(`/api/inbox/templates?${params}`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      const result = await response.json()
      return result.data || []
    },
    enabled: open,
  })

  // Fetch most used templates
  const { data: mostUsedData } = useQuery({
    queryKey: ['templates', 'most-used'],
    queryFn: async () => {
      const response = await fetch('/api/inbox/templates/most-used?limit=5')
      if (!response.ok) throw new Error('Failed to fetch most used templates')
      const result = await response.json()
      return result.data || []
    },
    enabled: open && !search && selectedCategory === 'all',
  })

  // Fetch categories
  const { data: categoriesData } = useQuery({
    queryKey: ['templates', 'categories'],
    queryFn: async () => {
      const response = await fetch('/api/inbox/templates/categories')
      if (!response.ok) throw new Error('Failed to fetch categories')
      const result = await response.json()
      return result.data || []
    },
    enabled: open,
  })

  // Track usage mutation
  const trackUsageMutation = useMutation({
    mutationFn: async (templateId: number) => {
      const response = await fetch(`/api/inbox/templates/${templateId}/use`, {
        method: 'POST',
      })
      if (!response.ok) throw new Error('Failed to track usage')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
    },
  })

  // Fetch flex/broadcast templates
  const { data: flexData, isLoading: flexLoading } = useQuery({
    queryKey: ['broadcast-templates', { search: flexSearch }],
    queryFn: async () => {
      const params = new URLSearchParams()
      if (flexSearch) params.set('search', flexSearch)
      const response = await fetch(`/api/inbox/broadcasts/templates?${params}`)
      if (!response.ok) throw new Error('Failed to fetch flex templates')
      const result = await response.json()
      return (result.data || []) as BroadcastTemplate[]
    },
    enabled: open && activeTab === 'flex',
  })

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setSearch('')
      setFlexSearch('')
      setSelectedCategory('all')
      setSelectedTemplate(null)
      setVariableValues({})
      setActiveTab('text')
    }
  }, [open])

  useEffect(() => {
    if (open && !selectedTemplate) {
      requestAnimationFrame(() => {
        searchInputRef.current?.focus()
      })
    }
  }, [open, selectedTemplate])

  // Auto-fill variable values from customer data
  useEffect(() => {
    if (selectedTemplate && selectedTemplate.variables.length > 0) {
      const initialValues: Record<string, string> = {}
      selectedTemplate.variables.forEach((variable) => {
        initialValues[variable] = customerData[variable] || ''
      })
      setVariableValues(initialValues)
    }
  }, [selectedTemplate, customerData])

  const handleTemplateSelect = (template: Template) => {
    if (template.variables.length > 0) {
      // Show variable input form
      setSelectedTemplate(template)
    } else {
      // Use template directly
      trackUsageMutation.mutate(template.id)
      onSelect(template.content)
      onOpenChange(false)
    }
  }

  const handleUseTemplate = () => {
    if (!selectedTemplate) return

    // Build variable array
    const variables: TemplateVariable[] = selectedTemplate.variables.map((name) => ({
      name,
      value: variableValues[name] || '',
    }))

    // Substitute variables
    const content = substituteVariables(selectedTemplate.content, variables)

    // Track usage
    trackUsageMutation.mutate(selectedTemplate.id)

    // Return content
    onSelect(content)
    onOpenChange(false)
  }

  const handleBack = () => {
    setSelectedTemplate(null)
    setVariableValues({})
  }

  const templates = data || []
  const mostUsed = mostUsedData || []
  const categories = categoriesData || []

  // Group templates by category
  const groupedTemplates = templates.reduce((acc: Record<string, Template[]>, template: Template) => {
    const category = template.category || 'ทั่วไป'
    if (!acc[category]) acc[category] = []
    acc[category].push(template)
    return acc
  }, {} as Record<string, Template[]>)

  const formatLastUsed = (date: Date | null) => {
    if (!date) return ''
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'เมื่อสักครู่'
    if (diffMins < 60) return `${diffMins} นาทีที่แล้ว`
    if (diffHours < 24) return `${diffHours} ชั่วโมงที่แล้ว`
    if (diffDays < 7) return `${diffDays} วันที่แล้ว`
    return d.toLocaleDateString('th-TH', { timeZone: 'Asia/Bangkok', day: 'numeric', month: 'short' })
  }

  const flexTemplates = Array.isArray(flexData) ? flexData.filter((t) => t.category !== 'text') : []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>
            {selectedTemplate ? 'กรอกข้อมูลตัวแปร' : 'เลือกเทมเพลต'}
          </DialogTitle>
          <DialogDescription>
            {selectedTemplate
              ? 'กรอกข้อมูลเพื่อแทนที่ตัวแปรในเทมเพลต'
              : 'เลือกเทมเพลตที่ต้องการใช้'}
          </DialogDescription>
        </DialogHeader>

        {!selectedTemplate ? (
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'text' | 'flex')}>
            <TabsList className="mb-3">
              <TabsTrigger value="text">ข้อความ</TabsTrigger>
              {onSelectFlex && (
                <TabsTrigger value="flex">
                  <Zap className="h-3 w-3 mr-1" />
                  Flex & รูปภาพ
                </TabsTrigger>
              )}
            </TabsList>

            {/* ── TEXT TEMPLATES ── */}
            <TabsContent value="text" className="mt-0">
              {/* Search and Category Filter */}
              <div className="space-y-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    ref={searchInputRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="ค้นหาเทมเพลต..."
                    className="pl-9"
                    aria-label="ค้นหาเทมเพลต"
                  />
                </div>

                {/* Category Pills */}
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      variant={selectedCategory === 'all' ? 'default' : 'outline'}
                      onClick={() => setSelectedCategory('all')}
                    >
                      ทั้งหมด
                    </Button>
                    {categories.map((cat: string) => (
                      <Button
                        key={cat}
                        size="sm"
                        variant={selectedCategory === cat ? 'default' : 'outline'}
                        onClick={() => setSelectedCategory(cat)}
                      >
                        {cat}
                      </Button>
                    ))}
                  </div>
                )}
              </div>

              {/* Template List */}
              <ScrollArea className="h-[360px] pr-4 mt-3">
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
                ) : (
                  <div className="space-y-4">
                    {/* Most Used Section */}
                    {mostUsed.length > 0 && !search && selectedCategory === 'all' && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-muted-foreground">⭐ ใช้บ่อย</span>
                          <Badge variant="secondary" className="text-xs">{mostUsed.length}</Badge>
                        </div>
                        <div className="space-y-2">
                          {mostUsed.map((template: Template) => (
                            <button
                              key={template.id}
                              onClick={() => handleTemplateSelect(template)}
                              className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition bg-amber-50/50 dark:bg-amber-950/20"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <div className="flex-1 min-w-0">
                                  <div className="font-medium truncate">{template.name}</div>
                                  <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{template.content}</p>
                                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                    <span>ใช้ {template.usage_count || 0} ครั้ง</span>
                                    {template.last_used_at && (
                                      <><span>•</span><span>{formatLastUsed(template.last_used_at)}</span></>
                                    )}
                                  </div>
                                </div>
                                {template.variables.length > 0 && (
                                  <Badge variant="outline" className="text-xs shrink-0">{template.variables.length} ตัวแปร</Badge>
                                )}
                              </div>
                              {template.shortcuts.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                  {template.shortcuts.map((shortcut: string, idx: number) => (
                                    <Badge key={idx} variant="secondary" className="text-xs">/{shortcut}</Badge>
                                  ))}
                                </div>
                              )}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Regular Templates by Category */}
                    {templates.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">ไม่พบเทมเพลต</div>
                    ) : (
                      (Object.entries(groupedTemplates) as [string, Template[]][]).map(([category, items]) => (
                        <div key={category} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-muted-foreground">{category}</span>
                            <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                          </div>
                          <div className="space-y-2">
                            {items.map((template: Template) => (
                              <button
                                key={template.id}
                                onClick={() => handleTemplateSelect(template)}
                                className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium truncate">{template.name}</div>
                                    <p className="text-sm text-muted-foreground line-clamp-2 mt-1">{template.content}</p>
                                    {(template.usage_count || 0) > 0 && (
                                      <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                                        <span>ใช้ {template.usage_count} ครั้ง</span>
                                        {template.last_used_at && (
                                          <><span>•</span><span>{formatLastUsed(template.last_used_at)}</span></>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  {template.variables.length > 0 && (
                                    <Badge variant="outline" className="text-xs shrink-0">{template.variables.length} ตัวแปร</Badge>
                                  )}
                                </div>
                                {template.shortcuts.length > 0 && (
                                  <div className="flex flex-wrap gap-1 mt-2">
                                    {template.shortcuts.map((shortcut: string, idx: number) => (
                                      <Badge key={idx} variant="secondary" className="text-xs">/{shortcut}</Badge>
                                    ))}
                                  </div>
                                )}
                              </button>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            {/* ── FLEX & BROADCAST TEMPLATES ── */}
            {onSelectFlex && (
              <TabsContent value="flex" className="mt-0">
                <div className="relative mb-3">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={flexSearch}
                    onChange={(e) => setFlexSearch(e.target.value)}
                    placeholder="ค้นหา Flex / รูปภาพ..."
                    className="pl-9"
                  />
                </div>
                <ScrollArea className="h-[360px] pr-4">
                  {flexLoading ? (
                    <div className="text-center py-8 text-muted-foreground">กำลังโหลด...</div>
                  ) : flexTemplates.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">ไม่พบเทมเพลต Flex</div>
                  ) : (
                    <div className="space-y-2">
                      {flexTemplates.map((template) => (
                        <button
                          key={template.id}
                          onClick={() => {
                            if (template.category === 'flex' && template.flexContent?.contents) {
                              onSelectFlex(template.flexContent.contents, template.name)
                            } else if (template.category === 'image' && template.mediaUrl) {
                              onSelect(template.mediaUrl)
                            } else if (template.content) {
                              onSelect(template.content)
                            }
                            onOpenChange(false)
                          }}
                          className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition"
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium truncate">{template.name}</div>
                              {template.description && (
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">{template.description}</p>
                              )}
                            </div>
                            <Badge variant="outline" className="text-xs shrink-0 capitalize">
                              {template.category === 'flex' ? 'Flex' : template.category === 'image' ? 'รูป' : template.category}
                            </Badge>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </TabsContent>
            )}
          </Tabs>
        ) : (
          <>
            {/* Variable Input Form */}
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="font-medium mb-2">{selectedTemplate.name}</div>
                <p className="text-sm text-muted-foreground">
                  {selectedTemplate.content}
                </p>
              </div>

              <div className="space-y-3">
                {selectedTemplate.variables.map((variable) => (
                  <div key={variable} className="space-y-2">
                    <Label htmlFor={variable}>
                      {variable}
                      {!customerData[variable] && (
                        <span className="text-destructive ml-1">*</span>
                      )}
                    </Label>
                    <Input
                      id={variable}
                      value={variableValues[variable] || ''}
                      onChange={(e) =>
                        setVariableValues({
                          ...variableValues,
                          [variable]: e.target.value,
                        })
                      }
                      placeholder={`กรอก ${variable}`}
                    />
                  </div>
                ))}
              </div>

              {/* Preview */}
              <div className="space-y-2">
                <Label>ตัวอย่าง</Label>
                <div className="rounded-lg border p-3 bg-background">
                  <p className="text-sm whitespace-pre-wrap">
                    {substituteVariables(
                      selectedTemplate.content,
                      selectedTemplate.variables.map((name) => ({
                        name,
                        value: variableValues[name] || `{{${name}}}`,
                      }))
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button variant="outline" onClick={handleBack} className="flex-1">
                ย้อนกลับ
              </Button>
              <Button onClick={handleUseTemplate} className="flex-1">
                ใช้เทมเพลต
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
