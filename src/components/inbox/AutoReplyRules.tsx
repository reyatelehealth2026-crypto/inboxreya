'use client'

/**
 * Auto-Reply Rules Management Component
 * Displays and manages auto-reply rules with CRUD operations
 */

import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  Plus,
  Search,
  Edit,
  Trash2,
  Power,
  PowerOff,
  ArrowUp,
  ArrowDown,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AutoReplyRuleDialog } from './AutoReplyRuleDialog'
import { useToast } from '@/hooks/use-toast'
import { truncate } from '@/lib/utils'

interface AutoReplyRule {
  id: number
  keyword: string
  matchType: 'exact' | 'contains' | 'starts_with' | 'regex'
  replyContent: string
  isActive: boolean
  priority: number
  createdAt: string
  updatedAt: string
}

interface AutoReplyRulesResponse {
  rules: AutoReplyRule[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
  }
}

export function AutoReplyRules() {
  const [search, setSearch] = useState('')
  const [isActiveFilter, setIsActiveFilter] = useState<'all' | 'true' | 'false'>('all')
  const [page, setPage] = useState(1)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  const [editingRule, setEditingRule] = useState<AutoReplyRule | null>(null)

  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Fetch rules
  const { data, isLoading, error } = useQuery<AutoReplyRulesResponse>({
    queryKey: ['auto-reply-rules', { search, isActive: isActiveFilter, page }],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        isActive: isActiveFilter,
        page: page.toString(),
        limit: '20',
      })
      const response = await fetch(`/api/inbox/auto-reply-rules?${params}`)
      if (!response.ok) {
        throw new Error('Failed to fetch auto-reply rules')
      }
      const result = await response.json()
      return result.data
    },
  })

  // Delete rule mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inbox/auto-reply-rules/${id}`, {
        method: 'DELETE',
      })
      if (!response.ok) {
        throw new Error('Failed to delete rule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] })
      toast({
        title: 'สำเร็จ',
        description: 'ลบกฎตอบกลับอัตโนมัติแล้ว',
      })
    },
    onError: () => {
      toast({
        title: 'ข้อผิดพลาด',
        description: 'ไม่สามารถลบกฎตอบกลับอัตโนมัติได้',
        variant: 'destructive',
      })
    },
  })

  // Toggle rule mutation
  const toggleMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await fetch(`/api/inbox/auto-reply-rules/${id}/toggle`, {
        method: 'POST',
      })
      if (!response.ok) {
        throw new Error('Failed to toggle rule')
      }
      return response.json()
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['auto-reply-rules'] })
      toast({
        title: 'สำเร็จ',
        description: 'เปลี่ยนสถานะกฎตอบกลับอัตโนมัติแล้ว',
      })
    },
    onError: () => {
      toast({
        title: 'ข้อผิดพลาด',
        description: 'ไม่สามารถเปลี่ยนสถานะกฎตอบกลับอัตโนมัติได้',
        variant: 'destructive',
      })
    },
  })

  const handleEdit = (rule: AutoReplyRule) => {
    setEditingRule(rule)
    setIsDialogOpen(true)
  }

  const handleDelete = (id: number) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบกฎนี้?')) {
      deleteMutation.mutate(id)
    }
  }

  const handleToggle = (id: number) => {
    toggleMutation.mutate(id)
  }

  const handleDialogClose = () => {
    setIsDialogOpen(false)
    setEditingRule(null)
  }

  const getMatchTypeLabel = (matchType: string) => {
    const labels: Record<string, string> = {
      exact: 'ตรงทั้งหมด',
      contains: 'มีคำนี้',
      starts_with: 'ขึ้นต้นด้วย',
      regex: 'Regex',
    }
    return labels[matchType] || matchType
  }

  const getMatchTypeBadgeColor = (matchType: string) => {
    const colors: Record<string, string> = {
      exact: 'bg-blue-100 text-blue-800',
      contains: 'bg-green-100 text-green-800',
      starts_with: 'bg-purple-100 text-purple-800',
      regex: 'bg-orange-100 text-orange-800',
    }
    return colors[matchType] || 'bg-gray-100 text-gray-800'
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>กฎตอบกลับอัตโนมัติ</CardTitle>
            <Button onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              เพิ่มกฎใหม่
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Filters */}
          <div className="mb-4 flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500" />
              <Input
                placeholder="ค้นหาคำสำคัญหรือข้อความตอบกลับ..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex gap-2">
              <Button
                variant={isActiveFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setIsActiveFilter('all')}
              >
                ทั้งหมด
              </Button>
              <Button
                variant={isActiveFilter === 'true' ? 'default' : 'outline'}
                onClick={() => setIsActiveFilter('true')}
              >
                เปิดใช้งาน
              </Button>
              <Button
                variant={isActiveFilter === 'false' ? 'default' : 'outline'}
                onClick={() => setIsActiveFilter('false')}
              >
                ปิดใช้งาน
              </Button>
            </div>
          </div>

          {/* Table */}
          {isLoading ? (
            <div className="py-8 text-center text-gray-500">กำลังโหลด...</div>
          ) : error ? (
            <div className="py-8 text-center text-red-500">
              เกิดข้อผิดพลาดในการโหลดข้อมูล
            </div>
          ) : !data?.rules || data.rules.length === 0 ? (
            <div className="py-8 text-center text-gray-500">
              ไม่พบกฎตอบกลับอัตโนมัติ
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px]">
                      <div className="flex items-center gap-1">
                        <ArrowUp className="h-3 w-3" />
                        <ArrowDown className="h-3 w-3" />
                      </div>
                    </TableHead>
                    <TableHead>คำสำคัญ</TableHead>
                    <TableHead>ประเภท</TableHead>
                    <TableHead>ข้อความตอบกลับ</TableHead>
                    <TableHead className="w-[100px]">สถานะ</TableHead>
                    <TableHead className="w-[150px] text-right">
                      การจัดการ
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.rules.map((rule) => (
                    <TableRow key={rule.id}>
                      <TableCell className="text-center font-medium">
                        {rule.priority}
                      </TableCell>
                      <TableCell className="font-medium">
                        {rule.keyword}
                      </TableCell>
                      <TableCell>
                        <Badge
                          className={getMatchTypeBadgeColor(rule.matchType)}
                        >
                          {getMatchTypeLabel(rule.matchType)}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {truncate(rule.replyContent, 100)}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={rule.isActive ? 'default' : 'secondary'}
                        >
                          {rule.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggle(rule.id)}
                            title={
                              rule.isActive
                                ? 'ปิดใช้งาน'
                                : 'เปิดใช้งาน'
                            }
                          >
                            {rule.isActive ? (
                              <PowerOff className="h-4 w-4 text-orange-500" />
                            ) : (
                              <Power className="h-4 w-4 text-green-500" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(rule)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(rule.id)}
                          >
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {data.pagination && data.pagination.totalPages > 1 && (
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-sm text-gray-500">
                    แสดง {data.rules.length} จาก {data.pagination.total} รายการ
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === 1}
                      onClick={() => setPage(page - 1)}
                    >
                      ก่อนหน้า
                    </Button>
                    <div className="flex items-center gap-2 px-4">
                      <span className="text-sm">
                        หน้า {page} / {data.pagination.totalPages}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={page === data.pagination.totalPages}
                      onClick={() => setPage(page + 1)}
                    >
                      ถัดไป
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Dialog */}
      <AutoReplyRuleDialog
        open={isDialogOpen}
        onClose={handleDialogClose}
        rule={editingRule}
      />
    </div>
  )
}
