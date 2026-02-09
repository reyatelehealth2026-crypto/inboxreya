'use client'

/**
 * Auto-Reply Rule Dialog Component
 * Form for creating and editing auto-reply rules
 */

import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useToast } from '@/hooks/use-toast'

interface AutoReplyRule {
  id: number
  keyword: string
  matchType: 'exact' | 'contains' | 'starts_with' | 'regex'
  replyContent: string
  isActive: boolean
  priority: number
}

interface AutoReplyRuleDialogProps {
  open: boolean
  onClose: () => void
  rule?: AutoReplyRule | null
}

export function AutoReplyRuleDialog({
  open,
  onClose,
  rule,
}: AutoReplyRuleDialogProps) {
  const [keyword, setKeyword] = useState('')
  const [matchType, setMatchType] = useState<
    'exact' | 'contains' | 'starts_with' | 'regex'
  >('contains')
  const [replyContent, setReplyContent] = useState('')
  const [priority, setPriority] = useState(0)
  const [isActive, setIsActive] = useState(true)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Reset form when dialog opens/closes or rule changes
  useEffect(() => {
    if (open) {
      if (rule) {
        setKeyword(rule.keyword)
        setMatchType(rule.matchType)
        setReplyContent(rule.replyContent)
        setPriority(rule.priority)
        setIsActive(rule.isActive)
      } else {
        setKeyword('')
        setMatchType('contains')
        setReplyContent('')
        setPriority(0)
        setIsActive(true)
      }
    }
  }, [open, rule])

  // Create mutation
  const createMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch('/api/inbox/auto-reply-rules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to create rule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] })
      toast({
        title: 'สำเร็จ',
        description: 'สร้างกฎตอบกลับอัตโนมัติแล้ว',
      })
      onClose()
    },
    onError: (error: Error) => {
      toast({
        title: 'ข้อผิดพลาด',
        description: error.message || 'ไม่สามารถสร้างกฎตอบกลับอัตโนมัติได้',
        variant: 'destructive',
      })
    },
  })

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async (data: any) => {
      const response = await fetch(`/api/inbox/auto-reply-rules/${rule?.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update rule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] })
      toast({
        title: 'สำเร็จ',
        description: 'อัปเดตกฎตอบกลับอัตโนมัติแล้ว',
      })
      onClose()
    },
    onError: (error: Error) => {
      toast({
        title: 'ข้อผิดพลาด',
        description: error.message || 'ไม่สามารถอัปเดตกฎตอบกลับอัตโนมัติได้',
        variant: 'destructive',
      })
    },
  })

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()

    // Validation
    if (!keyword.trim()) {
      toast({
        title: 'ข้อผิดพลาด',
        description: 'กรุณากรอกคำสำคัญ',
        variant: 'destructive',
      })
      return
    }

    if (!replyContent.trim()) {
      toast({
        title: 'ข้อผิดพลาด',
        description: 'กรุณากรอกข้อความตอบกลับ',
        variant: 'destructive',
      })
      return
    }

    // Validate regex if match type is regex
    if (matchType === 'regex') {
      try {
        new RegExp(keyword)
      } catch (error) {
        toast({
          title: 'ข้อผิดพลาด',
          description: 'รูปแบบ Regex ไม่ถูกต้อง',
          variant: 'destructive',
        })
        return
      }
    }

    const data = {
      keyword: keyword.trim(),
      matchType,
      replyContent: replyContent.trim(),
      priority,
      isActive,
    }

    if (rule) {
      updateMutation.mutate(data)
    } else {
      createMutation.mutate(data)
    }
  }

  const isLoading = createMutation.isPending || updateMutation.isPending

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>
              {rule ? 'แก้ไขกฎตอบกลับอัตโนมัติ' : 'เพิ่มกฎตอบกลับอัตโนมัติ'}
            </DialogTitle>
            <DialogDescription>
              กำหนดคำสำคัญและข้อความตอบกลับอัตโนมัติเมื่อลูกค้าส่งข้อความที่ตรงกับเงื่อนไข
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            {/* Keyword */}
            <div className="grid gap-2">
              <Label htmlFor="keyword">
                คำสำคัญ <span className="text-red-500">*</span>
              </Label>
              <Input
                id="keyword"
                value={keyword}
                onChange={(e) => setKeyword(e.target.value)}
                placeholder="เช่น สวัสดี, ราคา, สอบถาม"
                required
              />
            </div>

            {/* Match Type */}
            <div className="grid gap-2">
              <Label htmlFor="matchType">
                ประเภทการจับคู่ <span className="text-red-500">*</span>
              </Label>
              <Select
                value={matchType}
                onValueChange={(value: any) => setMatchType(value)}
              >
                <SelectTrigger id="matchType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="exact">ตรงทั้งหมด (Exact)</SelectItem>
                  <SelectItem value="contains">มีคำนี้ (Contains)</SelectItem>
                  <SelectItem value="starts_with">
                    ขึ้นต้นด้วย (Starts With)
                  </SelectItem>
                  <SelectItem value="regex">รูปแบบ Regex</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                {matchType === 'exact' &&
                  'ข้อความต้องตรงกับคำสำคัญทุกตัวอักษร'}
                {matchType === 'contains' &&
                  'ข้อความมีคำสำคัญอยู่ในข้อความ'}
                {matchType === 'starts_with' &&
                  'ข้อความขึ้นต้นด้วยคำสำคัญ'}
                {matchType === 'regex' &&
                  'ใช้รูปแบบ Regular Expression (สำหรับผู้ใช้ขั้นสูง)'}
              </p>
            </div>

            {/* Reply Content */}
            <div className="grid gap-2">
              <Label htmlFor="replyContent">
                ข้อความตอบกลับ <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="replyContent"
                value={replyContent}
                onChange={(e) => setReplyContent(e.target.value)}
                placeholder="ข้อความที่จะตอบกลับอัตโนมัติ..."
                rows={4}
                required
              />
              <p className="text-xs text-gray-500">
                ข้อความนี้จะถูกส่งไปยังลูกค้าอัตโนมัติเมื่อตรงกับเงื่อนไข
              </p>
            </div>

            {/* Priority */}
            <div className="grid gap-2">
              <Label htmlFor="priority">
                ลำดับความสำคัญ (0-100)
              </Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                value={priority}
                onChange={(e) => setPriority(parseInt(e.target.value) || 0)}
                placeholder="0"
              />
              <p className="text-xs text-gray-500">
                กฎที่มีลำดับความสำคัญสูงกว่าจะถูกตรวจสอบก่อน (ค่าเริ่มต้น: 0)
              </p>
            </div>

            {/* Active Status */}
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="isActive"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <Label htmlFor="isActive" className="cursor-pointer">
                เปิดใช้งานกฎนี้
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isLoading}
            >
              ยกเลิก
            </Button>
            <Button type="submit" disabled={isLoading}>
              {isLoading ? 'กำลังบันทึก...' : rule ? 'อัปเดต' : 'สร้าง'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
