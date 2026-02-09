"use client"

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Pencil, Trash2, Plus, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { QuickReplyTemplateDialog } from './QuickReplyTemplateDialog'
import { formatTemplatePreview } from '@/lib/template-utils'

interface QuickReplyTemplate {
  id: number
  name: string
  content: string
  category: string | null
  shortcuts: string[]
  variables: string[]
  usage_count: number | null
  last_used_at: Date | null
  created_at: Date | null
}

export function QuickReplyTemplates() {
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState('all')
  const [page, setPage] = useState(1)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editingTemplate, setEditingTemplate] = useState<QuickReplyTemplate | null>(null)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch templates
  const { data, isLoading } = useQuery({
    queryKey: ['templates', { search, category, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        page: page.toString(),
        limit: '20',
      })

      if (category !== 'all') {
        params.append('category', category)
      }

      const response = await fetch(`/api/inbox/templates?${params}`)
      if (!response.ok) throw new Error('Failed to fetch templates')
      return response.json()
    },
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
  })

  // Fetch most used templates
  const { data: mostUsedData } = useQuery({
    queryKey: ['templates', 'most-used'],
    queryFn: async () => {
      const response = await fetch('/api/inbox/templates/most-used?limit=5')
      if (!response.ok) throw new Error('Failed to fetch most used')
      const result = await response.json()
      return result.data || []
    },
  })

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inbox/templates/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) throw new Error('Failed to delete template')
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['templates'] })
      toast({
        title: 'สำเร็จ',
        description: 'ลบเทมเพลตเรียบร้อยแล้ว',
      })
    },
    onError: () => {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถลบเทมเพลตได้',
        variant: 'destructive',
      })
    },
  })

  const handleEdit = (template: QuickReplyTemplate) => {
    setEditingTemplate(template)
    setDialogOpen(true)
  }

  const handleDelete = async (id: number) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบเทมเพลตนี้?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleDialogClose = () => {
    setDialogOpen(false)
    setEditingTemplate(null)
  }

  const templates = data?.data || []
  const pagination = data?.pagination || { page: 1, totalPages: 1, total: 0 }
  const categories = categoriesData || []
  const mostUsed = mostUsedData || []

  const formatLastUsed = (date: Date | null) => {
    if (!date) return '-'
    const d = new Date(date)
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffMins = Math.floor(diffMs / 60000)
    const diffHours = Math.floor(diffMs / 3600000)
    const diffDays = Math.floor(diffMs / 86400000)

    if (diffMins < 1) return 'เมื่อสักครู่'
    if (diffMins < 60) return `${diffMins} นาที`
    if (diffHours < 24) return `${diffHours} ชม.`
    if (diffDays < 7) return `${diffDays} วัน`
    return d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">เทมเพลตตอบกลับด่วน</h2>
          <p className="text-sm text-muted-foreground">
            จัดการเทมเพลตข้อความสำหรับตอบกลับลูกค้าอย่างรวดเร็ว
          </p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          เพิ่มเทมเพลต
        </Button>
      </div>

      {/* Most Used Templates */}
      {mostUsed.length > 0 && !search && category === 'all' && (
        <div className="rounded-lg border p-4 bg-amber-50/50 dark:bg-amber-950/20">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm font-medium">⭐ เทมเพลตที่ใช้บ่อย</span>
            <Badge variant="secondary" className="text-xs">
              {mostUsed.length}
            </Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
            {mostUsed.map((template: QuickReplyTemplate) => (
              <div
                key={template.id}
                className="rounded-lg border bg-background p-3 text-sm"
              >
                <div className="font-medium truncate">{template.name}</div>
                <div className="text-xs text-muted-foreground mt-1 flex items-center gap-2">
                  <span>ใช้ {template.usage_count || 0} ครั้ง</span>
                  <span>•</span>
                  <span>{formatLastUsed(template.last_used_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาเทมเพลต..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={category} onValueChange={setCategory}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="หมวดหมู่" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">ทั้งหมด</SelectItem>
            {categories.map((cat: string) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="border rounded-lg overflow-auto max-h-[600px]">
        <Table>
          <TableHeader className="sticky top-0 bg-background z-10">
            <TableRow>
              <TableHead>ชื่อเทมเพลต</TableHead>
              <TableHead>เนื้อหา</TableHead>
              <TableHead>หมวดหมู่</TableHead>
              <TableHead>ทางลัด</TableHead>
              <TableHead>ตัวแปร</TableHead>
              <TableHead className="text-right">ใช้งาน</TableHead>
              <TableHead className="text-right">ใช้ล่าสุด</TableHead>
              <TableHead className="text-right">จัดการ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8">
                  กำลังโหลด...
                </TableCell>
              </TableRow>
            ) : templates.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                  ไม่พบเทมเพลต
                </TableCell>
              </TableRow>
            ) : (
              templates.map((template: QuickReplyTemplate) => (
                <TableRow key={template.id}>
                  <TableCell className="font-medium">{template.name}</TableCell>
                  <TableCell className="max-w-md">
                    <div className="text-sm text-muted-foreground truncate">
                      {formatTemplatePreview(template.content, 80)}
                    </div>
                  </TableCell>
                  <TableCell>
                    {template.category && (
                      <Badge variant="secondary">{template.category}</Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {template.shortcuts && template.shortcuts.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {template.shortcuts.slice(0, 2).map((shortcut, idx) => (
                          <Badge key={idx} variant="outline" className="text-xs">
                            /{shortcut}
                          </Badge>
                        ))}
                        {template.shortcuts.length > 2 && (
                          <Badge variant="outline" className="text-xs">
                            +{template.shortcuts.length - 2}
                          </Badge>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    {template.variables && template.variables.length > 0 && (
                      <Badge variant="outline">
                        {template.variables.length} ตัวแปร
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm font-medium">
                      {template.usage_count || 0} ครั้ง
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="text-sm text-muted-foreground">
                      {formatLastUsed(template.last_used_at)}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleEdit(template)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(template.id)}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {pagination.totalPages > 1 && (
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            แสดง {templates.length} จาก {pagination.total} เทมเพลต
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(page - 1)}
              disabled={page === 1}
            >
              ก่อนหน้า
            </Button>
            <div className="flex items-center gap-2 px-4">
              <span className="text-sm">
                หน้า {page} จาก {pagination.totalPages}
              </span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPage(page + 1)}
              disabled={page >= pagination.totalPages}
            >
              ถัดไป
            </Button>
          </div>
        </div>
      )}

      {/* Dialog */}
      <QuickReplyTemplateDialog
        open={dialogOpen}
        onOpenChange={handleDialogClose}
        template={editingTemplate}
      />
    </div>
  )
}
