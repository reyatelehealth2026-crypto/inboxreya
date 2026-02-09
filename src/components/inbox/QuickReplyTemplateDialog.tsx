"use client"

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
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
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { extractVariables, validateTemplateContent } from '@/lib/template-utils'

interface QuickReplyTemplate {
  id: number
  name: string
  content: string
  category: string | null
  shortcuts: string[]
  variables: string[]
}

interface QuickReplyTemplateDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  template?: QuickReplyTemplate | null
}

export function QuickReplyTemplateDialog({
  open,
  onOpenChange,
  template,
}: QuickReplyTemplateDialogProps) {
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [shortcutInput, setShortcutInput] = useState('')
  const [shortcuts, setShortcuts] = useState<string[]>([])
  const [detectedVariables, setDetectedVariables] = useState<string[]>([])
  
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Reset form when dialog opens/closes or template changes
  useEffect(() => {
    if (open) {
      if (template) {
        setName(template.name)
        setContent(template.content)
        setCategory(template.category || '')
        setShortcuts(template.shortcuts || [])
        setDetectedVariables(extractVariables(template.content))
      } else {
        setName('')
        setContent('')
        setCategory('')
        setShortcuts([])
        setDetectedVariables([])
        setShortcutInput('')
      }
    }
  }, [open, template])

  // Update detected variables when content changes
  useEffect(() => {
    if (content) {
      setDetectedVariables(extractVariables(content))
    } else {
      setDetectedVariables([])
    }
  }, [content])

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (data: any) => {
      const url = template
        ? `/api/inbox/templates/${template.id}`
        : '/api/inbox/templates'
      
      const response = await fetch(url, {
        method: template ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to save template')
      }

      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast({
        title: 'สำเร็จ',
        description: template
          ? 'แก้ไขเทมเพลตเรียบร้อยแล้ว'
          : 'สร้างเทมเพลตเรียบร้อยแล้ว',
      })
      onOpenChange(false)
    },
    onError: (error: Error) => {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error.message,
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validate
    if (!name.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูล',
        description: 'กรุณากรอกชื่อเทมเพลต',
        variant: 'destructive',
      })
      return
    }

    if (!content.trim()) {
      toast({
        title: 'กรุณากรอกข้อมูล',
        description: 'กรุณากรอกเนื้อหาเทมเพลต',
        variant: 'destructive',
      })
      return
    }

    // Validate content
    const validation = validateTemplateContent(content)
    if (!validation.valid) {
      toast({
        title: 'เนื้อหาไม่ถูกต้อง',
        description: validation.errors[0],
        variant: 'destructive',
      })
      return
    }

    saveMutation.mutate({
      name: name.trim(),
      content: content.trim(),
      category: category.trim() || undefined,
      shortcuts: shortcuts.filter(s => s.trim()),
      variables: detectedVariables,
    })
  }

  const handleAddShortcut = () => {
    const trimmed = shortcutInput.trim()
    if (trimmed && !shortcuts.includes(trimmed)) {
      setShortcuts([...shortcuts, trimmed])
      setShortcutInput('')
    }
  }

  const handleRemoveShortcut = (shortcut: string) => {
    setShortcuts(shortcuts.filter(s => s !== shortcut))
  }

  const handleShortcutKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      handleAddShortcut()
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {template ? 'แก้ไขเทมเพลต' : 'เพิ่มเทมเพลตใหม่'}
          </DialogTitle>
          <DialogDescription>
            สร้างเทมเพลตข้อความสำหรับตอบกลับลูกค้าอย่างรวดเร็ว
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="name">
              ชื่อเทมเพลต <span className="text-destructive">*</span>
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="เช่น: ทักทายลูกค้า, ตอบคำถามราคา"
              maxLength={100}
            />
          </div>

          {/* Category */}
          <div className="space-y-2">
            <Label htmlFor="category">หมวดหมู่</Label>
            <Input
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              placeholder="เช่น: ทั่วไป, ข้อมูลสินค้า, คำแนะนำ"
              maxLength={50}
            />
          </div>

          {/* Content */}
          <div className="space-y-2">
            <Label htmlFor="content">
              เนื้อหาเทมเพลต <span className="text-destructive">*</span>
            </Label>
            <Textarea
              id="content"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="เนื้อหาข้อความ... ใช้ {{ชื่อตัวแปร}} สำหรับตัวแปร"
              rows={6}
              maxLength={5000}
            />
            <p className="text-xs text-muted-foreground">
              ใช้ {`{{ชื่อตัวแปร}}`} เพื่อแทรกข้อมูลลูกค้า เช่น {`{{name}}`}, {`{{phone}}`}
            </p>
          </div>

          {/* Detected Variables */}
          {detectedVariables.length > 0 && (
            <div className="space-y-2">
              <Label>ตัวแปรที่ตรวจพบ</Label>
              <div className="flex flex-wrap gap-2">
                {detectedVariables.map((variable) => (
                  <Badge key={variable} variant="secondary">
                    {`{{${variable}}}`}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Shortcuts */}
          <div className="space-y-2">
            <Label htmlFor="shortcut">ทางลัด (Shortcuts)</Label>
            <div className="flex gap-2">
              <Input
                id="shortcut"
                value={shortcutInput}
                onChange={(e) => setShortcutInput(e.target.value)}
                onKeyDown={handleShortcutKeyDown}
                placeholder="เช่น: สวัสดี, ราคา, ขอบคุณ"
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleAddShortcut}
              >
                เพิ่ม
              </Button>
            </div>
            {shortcuts.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {shortcuts.map((shortcut) => (
                  <Badge key={shortcut} variant="outline" className="gap-1">
                    /{shortcut}
                    <button
                      type="button"
                      onClick={() => handleRemoveShortcut(shortcut)}
                      className="ml-1 hover:text-destructive"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              พิมพ์ /ทางลัด ในช่องข้อความเพื่อเรียกใช้เทมเพลตอย่างรวดเร็ว
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={saveMutation.isPending}>
              {saveMutation.isPending
                ? 'กำลังบันทึก...'
                : template
                ? 'บันทึกการแก้ไข'
                : 'สร้างเทมเพลต'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
