"use client"

import { useMemo, useCallback } from 'react'
import { useSession } from 'next-auth/react'
import { Filter, X } from 'lucide-react'
import { useInboxStore, type ConversationFilters } from '@/stores/inbox'
import { useTags } from '@/hooks/use-tags'
import { useAssignees } from '@/hooks/use-assignees'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { AdminUser } from '@/types'

interface FilterBarProps {
  isOpen: boolean
  onToggle: () => void
  className?: string
}

const baseFilters: ConversationFilters = {
  status: 'all',
  tagId: undefined,
  tagIds: undefined,
  assignedTo: undefined,
  assignedToIds: undefined,
  search: '',
  unreadOnly: false,
  startDate: undefined,
  endDate: undefined,
}

export function FilterBar({ isOpen, onToggle, className }: FilterBarProps) {
  const { filters, setFilters, resetFilters, setAllFilters } = useInboxStore()
  const { data: session } = useSession()
  const { data: tagsData } = useTags()
  const tags = Array.isArray(tagsData) ? tagsData : []
  const { data: assigneesData } = useAssignees()
  const assignees = useMemo(
    () => (Array.isArray(assigneesData) ? assigneesData : []),
    [assigneesData]
  )

  // Get active tag IDs
  const activeTagIds = useMemo(() => {
    if (filters.tagIds && filters.tagIds.length > 0) return filters.tagIds
    if (filters.tagId) return [filters.tagId]
    return []
  }, [filters.tagId, filters.tagIds])

  // Get assignee label
  const assignedAdminLabel = useMemo(() => {
    if (!filters.assignedTo) return null
    const admin = assignees.find((item: AdminUser) => item.id === filters.assignedTo)
    return admin?.displayName || admin?.username || 'ผู้ดูแล'
  }, [assignees, filters.assignedTo])

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status && filters.status !== 'all') count++
    if (activeTagIds.length > 0) count++
    if (filters.assignedTo) count++
    if (filters.unreadOnly) count++
    if (filters.startDate || filters.endDate) count++
    return count
  }, [filters, activeTagIds])

  const handleStatusChange = useCallback((status: string) => {
    // Immediate update for better UX
    setFilters({ status: status as ConversationFilters['status'] })
  }, [setFilters])

  const handleAssigneeChange = useCallback((assigneeId: string) => {
    // Immediate update for better UX
    setFilters({
      assignedTo: assigneeId || undefined,
      assignedToIds: undefined,
    })
  }, [setFilters])

  const handleTagToggle = useCallback((tagId: string) => {
    // Use functional update to avoid stale closure
    setFilters((currentFilters) => {
      const currentTagIds = Array.isArray(currentFilters.tagIds) && currentFilters.tagIds.length > 0
        ? currentFilters.tagIds
        : currentFilters.tagId
          ? [currentFilters.tagId]
          : []

      const isActive = currentTagIds.includes(tagId)
      const next = isActive
        ? currentTagIds.filter((id) => id !== tagId)
        : [...currentTagIds, tagId]

      return {
        tagIds: next.length > 0 ? next : undefined,
        tagId: undefined,
      }
    })
  }, [setFilters])

  const handleClearFilters = useCallback(() => {
    // Use regular update for immediate UI feedback
    // Don't use startTransition here to ensure filters clear immediately
    resetFilters()
  }, [resetFilters])

  const applyPreset = useCallback((preset: Partial<ConversationFilters>) => {
    setAllFilters({ ...baseFilters, ...preset })
  }, [setAllFilters])

  const handleDateChange = useCallback((field: 'startDate' | 'endDate', value: string) => {
    // Immediate update for better UX
    setFilters({ [field]: value || undefined })
  }, [setFilters])

  const handleUnreadOnlyChange = useCallback((checked: boolean) => {
    // Immediate update for better UX
    setFilters({ unreadOnly: checked })
  }, [setFilters])

  return (
    <div className={cn('space-y-3', className)}>
      {/* Filter Toggle Button */}
      <div className="flex items-center justify-between">
        <Button
          variant={isOpen ? 'secondary' : 'ghost'}
          size="sm"
          onClick={onToggle}
          className="gap-2"
        >
          <Filter className="h-4 w-4" />
          ตัวกรอง
          {activeFilterCount > 0 && (
            <Badge variant="destructive" className="h-5 w-5 p-0 flex items-center justify-center text-xs">
              {activeFilterCount}
            </Badge>
          )}
        </Button>
        {activeFilterCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            ล้างตัวกรอง
          </Button>
        )}
      </div>

      {/* Filter Panel */}
      {isOpen && (
        <div className="border rounded-lg p-3 space-y-3 bg-muted/40">
          {/* Quick Presets */}
          <div className="space-y-1.5">
            <Label className="text-sm font-medium">พรีเซ็ตที่ใช้บ่อย</Label>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => { applyPreset({ unreadOnly: true }); onToggle() }}
              >
                ยังไม่อ่าน
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => { applyPreset({ assignedTo: 'unassigned' }); onToggle() }}
              >
                ยังไม่มอบหมาย
              </Button>
              {session?.user?.id && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => { applyPreset({ assignedTo: session.user.id }); onToggle() }}
                >
                  ของฉัน
                </Button>
              )}
              <Button
                size="sm"
                variant="outline"
                onClick={() => { applyPreset({ status: 'pending' }); onToggle() }}
              >
                รอดำเนินการ
              </Button>
            </div>
          </div>
          {/* Status Filter */}
          <div className="space-y-1.5">
            <Label htmlFor="status-filter" className="text-sm font-medium">
              สถานะ
            </Label>
            <select
              id="status-filter"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={filters.status || 'all'}
              onChange={(e) => { handleStatusChange(e.target.value); onToggle() }}
            >
              <option value="all">ทั้งหมด</option>
              <option value="active">กำลังคุย</option>
              <option value="pending">รอดำเนินการ</option>
              <option value="resolved">เสร็จสิ้น</option>
            </select>
          </div>

          {/* Assignee Filter */}
          <div className="space-y-1.5">
            <Label htmlFor="assignee-filter" className="text-sm font-medium">
              ผู้ดูแล
            </Label>
            <select
              id="assignee-filter"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={filters.assignedTo || ''}
              onChange={(e) => { handleAssigneeChange(e.target.value); onToggle() }}
            >
              <option value="">ทั้งหมด</option>
              <option value="unassigned">ยังไม่มอบหมาย</option>
              {assignees.map((admin: AdminUser) => (
                <option key={admin.id} value={admin.id}>
                  {admin.displayName || admin.username}
                </option>
              ))}
            </select>
          </div>

          {/* Tags Filter - Multi-select Dropdown */}
          <div className="space-y-1.5">
            <Label htmlFor="tag-filter" className="text-sm font-medium">แท็ก</Label>
            <select
              id="tag-filter"
              className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={activeTagIds.length === 1 ? activeTagIds[0] : ''}
              onChange={(e) => {
                const value = e.target.value
                if (value === '') {
                  setFilters({ tagId: undefined, tagIds: undefined })
                } else {
                  handleTagToggle(value)
                }
                onToggle() // Auto-close filter panel
              }}
            >
              <option value="">ทั้งหมด</option>
              {tags.map((tag) => (
                <option key={tag.id} value={tag.id}>
                  {activeTagIds.includes(tag.id) ? '✓ ' : ''}{tag.name}
                </option>
              ))}
            </select>
            {activeTagIds.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {activeTagIds.map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId)
                  if (!tag) return null
                  return (
                    <Badge
                      key={tagId}
                      variant="secondary"
                      className="gap-1 pr-1 text-xs"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => handleTagToggle(tagId)}
                        className="hover:text-destructive transition-colors ml-1"
                        aria-label={`ลบแท็ก ${tag.name}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            )}
          </div>

          {/* Date Range Filter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start-date" className="text-sm font-medium">
                วันที่เริ่มต้น
              </Label>
              <Input
                id="start-date"
                type="date"
                value={filters.startDate || ''}
                onChange={(e) => { handleDateChange('startDate', e.target.value); if (e.target.value) onToggle() }}
                className="h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end-date" className="text-sm font-medium">
                วันที่สิ้นสุด
              </Label>
              <Input
                id="end-date"
                type="date"
                value={filters.endDate || ''}
                onChange={(e) => { handleDateChange('endDate', e.target.value); if (e.target.value) onToggle() }}
                className="h-9"
              />
            </div>
          </div>

          {/* Unread Only Checkbox */}
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={filters.unreadOnly || false}
              onChange={(e) => { handleUnreadOnlyChange(e.target.checked); onToggle() }}
              className="h-4 w-4 rounded border-input text-primary focus:ring-2 focus:ring-ring focus:ring-offset-2"
            />
            <span>เฉพาะที่ยังไม่ได้อ่าน</span>
          </label>
        </div>
      )}

      {/* Active Filter Badges */}
      {activeFilterCount > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {filters.status && filters.status !== 'all' && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              <span>สถานะ: {filters.status}</span>
              <button
                onClick={() => handleStatusChange('all')}
                className="hover:text-destructive transition-colors"
                aria-label="ลบตัวกรองสถานะ"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {activeTagIds.length > 0 && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              <span>แท็ก: {activeTagIds.length}</span>
              <button
                onClick={() => {
                  setFilters({ tagId: undefined, tagIds: undefined })
                }}
                className="hover:text-destructive transition-colors"
                aria-label="ลบตัวกรองแท็ก"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.assignedTo && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              <span>ผู้ดูแล: {assignedAdminLabel}</span>
              <button
                onClick={() => {
                  setFilters({ assignedTo: undefined, assignedToIds: undefined })
                }}
                className="hover:text-destructive transition-colors"
                aria-label="ลบตัวกรองผู้ดูแล"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {filters.unreadOnly && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              <span>ยังไม่อ่าน</span>
              <button
                onClick={() => handleUnreadOnlyChange(false)}
                className="hover:text-destructive transition-colors"
                aria-label="ลบตัวกรองยังไม่อ่าน"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}

          {(filters.startDate || filters.endDate) && (
            <Badge variant="secondary" className="gap-1.5 pr-1">
              <span>ช่วงเวลา</span>
              <button
                onClick={() => {
                  setFilters({ startDate: undefined, endDate: undefined })
                }}
                className="hover:text-destructive transition-colors"
                aria-label="ลบตัวกรองช่วงเวลา"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          )}
        </div>
      )}
    </div>
  )
}
