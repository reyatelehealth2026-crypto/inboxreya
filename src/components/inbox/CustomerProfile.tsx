"use client"

import { useState, useEffect, useMemo } from 'react'
import {
  Phone,
  Mail,
  MapPin,
  Calendar,
  Star,
  Plus,
  X,
  ChevronDown,
  ChevronUp,
  Pin,
  Trash2,
  Edit2,
  ShoppingBag,
  Award,
  Activity,
  Heart,
  User,
  Users,
  Tag,
  FileText,
  History,
  MessageCircle
} from 'lucide-react'
import { useCustomerProfile, useUpdateCustomerProfile } from '@/hooks/use-customer-profile'
import { useQueryClient } from '@tanstack/react-query'
import { queryKeys } from '@/lib/query-keys'
import { useAssignConversation, useUnassignConversation } from '@/hooks/use-conversations'
import { useAdmins } from '@/hooks/use-admins'
import { useTags, useAssignTag, useRemoveTag, useCreateTag } from '@/hooks/use-tags'
import { useNotes, useCreateNote, useUpdateNote, useDeleteNote } from '@/hooks/use-notes'
import { useInboxStore } from '@/stores/inbox'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { useToast } from '@/hooks/use-toast'
import { cn, formatDate, getInitials } from '@/lib/utils'
import type { LineUser, UserTag, CustomerNote, AdminUser } from '@/types'

import { HealthProfileSection } from './HealthProfileSection'
import { PointsRewardsSection } from './PointsRewardsSection'
import { PrescriptionsSection } from './PrescriptionsSection'
import { LineInfoSection } from './LineInfoSection'
import { ActivityHistorySection } from './ActivityHistorySection'
import { OdooModal } from '@/components/odoo'

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value?: string | null }) {
  if (!value) return null

  return (
    <div className="flex items-start gap-2.5 py-2 border-b border-gray-50 last:border-0">
      <Icon className="h-4 w-4 text-gray-500 flex-shrink-0 mt-0.5" />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">{label}</p>
        <p className="text-sm font-semibold text-gray-900 break-words leading-snug">{value}</p>
      </div>
    </div>
  )
}

// Order Days Calendar - Shows which days customer receives orders
const DAYS = [
  { code: 'mon', label: 'จ' },
  { code: 'tue', label: 'อ' },
  { code: 'wed', label: 'พ' },
  { code: 'thu', label: 'พฤ' },
  { code: 'fri', label: 'ศ' },
  { code: 'sat', label: 'ส' },
  { code: 'sun', label: 'อา' },
]

function OrderDaysSection({ userId, initialDays }: { userId: string; initialDays: string[] }) {
  const [selectedDays, setSelectedDays] = useState<string[]>(initialDays)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()
  const queryClient = useQueryClient()

  // Sync with initialDays when it changes (e.g., after data refetch)
  useEffect(() => {
    setSelectedDays(initialDays)
  }, [initialDays])

  const toggleDay = async (dayCode: string) => {
    if (isSaving) return // Prevent double-click

    const newDays = selectedDays.includes(dayCode)
      ? selectedDays.filter(d => d !== dayCode)
      : [...selectedDays, dayCode]

    // Optimistic update
    setSelectedDays(newDays)
    setIsSaving(true)

    // Save to backend
    try {
      const response = await fetch(`/api/inbox/customers/${userId}/order-days`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderDays: newDays })
      })

      const result = await response.json()

      if (!response.ok) {
        throw new Error(result.error || 'Failed to save')
      }

      // Invalidate customer profile to refresh data
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(userId) })

      console.log('Order days saved successfully:', result)
    } catch (error) {
      console.error('Error saving order days:', error)
      // Revert the change on error
      setSelectedDays(selectedDays.includes(dayCode)
        ? selectedDays.filter(d => d !== dayCode)
        : [...selectedDays, dayCode])
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถบันทึกวันรับออเดอร์ได้',
        variant: 'destructive'
      })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Card className="p-3">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide">วันรับออเดอร์</span>
        {isSaving && <span className="text-[10px] text-gray-500">กำลังบันทึก...</span>}
      </div>
      <div className="flex items-center justify-between gap-1">
        {DAYS.map((day) => {
          const isSelected = selectedDays.includes(day.code)
          return (
            <button
              key={day.code}
              onClick={() => toggleDay(day.code)}
              disabled={isSaving}
              className={cn(
                'flex-1 py-1.5 rounded-md text-[11px] font-semibold transition-all duration-200',
                isSelected
                  ? 'bg-red-500 text-white shadow-sm'
                  : 'bg-gray-100 text-gray-500 hover:bg-gray-200',
                isSaving && 'opacity-50 cursor-not-allowed'
              )}
              title={`วัน${day.label}`}
            >
              {day.label}
            </button>
          )
        })}
      </div>
    </Card>
  )
}

function TagSelector({
  userId,
  currentTags
}: {
  userId: string
  currentTags: UserTag[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [newTagName, setNewTagName] = useState('')
  const [newTagColor, setNewTagColor] = useState('#3B82F6')
  const { data: allTags } = useTags()
  const assignTag = useAssignTag()
  const removeTag = useRemoveTag()
  const createTag = useCreateTag()

  const currentTagIds = new Set(currentTags.map((t) => t.id))
  const tags = Array.isArray(allTags) ? allTags : []
  const availableTags = tags.filter((t) => !currentTagIds.has(t.id))

  const handleAssign = async (tagId: string) => {
    await assignTag.mutateAsync({ userId, tagId })
    setIsOpen(false) // ยุบ dropdown ทันทีหลังเลือก
  }

  const handleRemove = async (tagId: string) => {
    await removeTag.mutateAsync({ userId, tagId })
  }

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return
    const newTag = await createTag.mutateAsync({
      name: newTagName.trim(),
      color: newTagColor
    })
    // Auto-assign the newly created tag
    await assignTag.mutateAsync({ userId, tagId: newTag.id })
    setNewTagName('')
    setNewTagColor('#3B82F6')
    setIsOpen(false) // ยุบ dropdown หลังสร้างและเลือก
  }

  // ฟังก์ชันเลือกสีตัวอักษรให้ตัดกับพื้นหลัง
  const getContrastColor = (hexColor: string) => {
    const hex = hexColor.replace('#', '')
    const r = parseInt(hex.substr(0, 2), 16)
    const g = parseInt(hex.substr(2, 2), 16)
    const b = parseInt(hex.substr(4, 2), 16)
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
    return luminance > 0.5 ? '#1a1a1a' : '#ffffff'
  }

  return (
    <div>
      {/* Current tags - ขนาดเล็ก พอดีตัวอักษร */}
      {currentTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {currentTags.map((tag) => {
            const bgColor = tag.color || "#E2E8F0"
            const textColor = getContrastColor(bgColor)
            return (
              <span
                key={tag.id}
                className="inline-flex items-center gap-1 max-w-full w-fit rounded-md pl-2 pr-1 py-0.5 text-xs font-semibold leading-tight shadow-sm"
                style={{
                  backgroundColor: bgColor,
                  color: textColor,
                }}
              >
                <span className="min-w-0 break-words">{tag.name}</span>
                <button
                  type="button"
                  onClick={() => handleRemove(tag.id)}
                  className="ml-0.5 inline-flex h-4 w-4 flex-shrink-0 items-center justify-center rounded hover:bg-black/20"
                  aria-label={`ลบแท็ก ${tag.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )
          })}
        </div>
      )}

      {/* Dropdown trigger */}
      <div className="relative">
        <Button
          variant="outline"
          size="sm"
          className="w-full h-8 text-xs justify-between"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-label="เพิ่มแท็กให้ลูกค้า"
        >
          <span className="flex items-center gap-1">
            <Plus className="h-3 w-3" />
            เพิ่มแท็ก
          </span>
          {isOpen ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )}
        </Button>

        {/* Dropdown menu */}
        {isOpen && (
          <>
            {/* Backdrop to close dropdown */}
            <div
              className="fixed inset-0 z-10"
              onClick={() => setIsOpen(false)}
            />

            {/* Dropdown content */}
            <div className="absolute top-full left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg z-20 max-h-64 overflow-hidden flex flex-col">
              {/* Available tags list */}
              <div className="overflow-y-auto flex-1 p-2">
                {availableTags.length > 0 ? (
                  <div className="space-y-1">
                    {availableTags.map((tag) => (
                      <button
                        key={tag.id}
                        onClick={() => handleAssign(tag.id)}
                        className="flex items-center gap-2 w-full px-3 py-2 text-sm rounded-md hover:bg-gray-100 transition-colors text-left"
                      >
                        <div
                          className="w-3 h-3 rounded-full flex-shrink-0"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="flex-1 truncate">{tag.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-gray-500 text-center py-4">
                    ไม่มีแท็กเพิ่มเติม
                  </p>
                )}
              </div>

              {/* Create new tag section */}
              <div className="border-t p-2 bg-gray-50">
                <div className="space-y-2">
                  <Input
                    placeholder="ชื่อแท็กใหม่..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    className="h-8 text-xs"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && newTagName.trim()) {
                        handleCreateTag()
                      }
                    }}
                  />
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={newTagColor}
                      onChange={(e) => setNewTagColor(e.target.value)}
                      className="h-7 w-12 rounded border cursor-pointer"
                    />
                    <Button
                      size="sm"
                      className="h-7 text-xs flex-1"
                      style={{ background: '#0C665D' }}
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                    >
                      <Plus className="h-3 w-3 mr-1" />
                      สร้างแท็ก
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function AssigneeSelector({
  userId,
  assignees,
}: {
  userId: string
  assignees: AdminUser[]
}) {
  const [isOpen, setIsOpen] = useState(false)
  const { data: admins = [] } = useAdmins()
  const assignConversation = useAssignConversation()
  const unassignConversation = useUnassignConversation()

  const assignedIds = new Set(assignees.map((admin) => admin.id))
  const availableAdmins = admins.filter((admin) => !assignedIds.has(admin.id))

  const handleAssign = async (adminId: string) => {
    await assignConversation.mutateAsync({ userId, adminId })
    setIsOpen(false)
  }

  const handleRemove = async (adminId: string) => {
    await unassignConversation.mutateAsync({ userId, adminId })
  }

  return (
    <div className="space-y-2">
      {/* Header with Title and Add Button */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Users className="h-3.5 w-3.5 text-gray-700" />
          <span className="text-[11px] font-bold text-gray-700 uppercase tracking-wide">ผู้ดูแล</span>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-5 w-5 rounded-full bg-teal-50 text-teal-600 hover:bg-teal-100 hover:text-teal-700 p-0"
          onClick={() => setIsOpen((open) => !open)}
          aria-expanded={isOpen}
          aria-label="เพิ่มผู้ดูแล"
          title="เพิ่มผู้ดูแล"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Selected Assignees List */}
      <div className="space-y-2">
        {assignees.map((admin) => (
          <div
            key={admin.id}
            className="flex items-center justify-between p-2 rounded-md bg-teal-50 border border-teal-100 group"
          >
            <div className="flex items-center gap-2.5 overflow-hidden">
              <Avatar className="h-8 w-8 ring-2 ring-white">
                <AvatarImage src={admin.avatarUrl || undefined} />
                <AvatarFallback className="text-xs bg-teal-200 text-teal-800 font-semibold">
                  {getInitials(admin.displayName || admin.username)}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-gray-900 truncate">
                  {admin.displayName || admin.username}
                </span>
                <span className="text-[10px] text-teal-700 font-medium truncate">
                  {admin.role || 'ผู้ดูแล'}
                </span>
              </div>
            </div>
            <button
              onClick={() => handleRemove(admin.id)}
              className="text-gray-500 hover:text-red-600 p-1 rounded-full hover:bg-white transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100"
              aria-label={`ลบผู้ดูแล ${admin.displayName || admin.username}`}
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ))}
      </div>

      {isOpen && availableAdmins.length > 0 && (
        <div className="border rounded-md p-2 space-y-1 bg-card">
          {availableAdmins.map((admin) => (
            <button
              key={admin.id}
              onClick={() => handleAssign(admin.id)}
              className="flex items-center gap-2 w-full px-2 py-1.5 text-sm rounded hover:bg-muted transition-colors"
            >
              <Avatar className="h-5 w-5">
                <AvatarImage src={admin.avatarUrl || undefined} />
                <AvatarFallback className="text-[10px]">
                  {getInitials(admin.displayName || admin.username)}
                </AvatarFallback>
              </Avatar>
              <span>{admin.displayName || admin.username}</span>
            </button>
          ))}
          {availableAdmins.length === 0 && (
            <p className="text-xs text-muted-foreground text-center">ไม่มีผู้ดูแลเพิ่มเติม</p>
          )}
        </div>
      )}
    </div>
  )
}

function NotesSection({ userId }: { userId: string }) {
  const { data: notes, isLoading } = useNotes(userId)
  const createNote = useCreateNote()
  const updateNote = useUpdateNote()
  const deleteNote = useDeleteNote()
  const [newNote, setNewNote] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')

  const sortedNotes = useMemo(() => {
    if (!notes) return []
    return [...notes].sort((a, b) => {
      if (a.isPinned === b.isPinned) {
        return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      }
      return a.isPinned ? -1 : 1
    })
  }, [notes])

  const handleCreate = async () => {
    if (!newNote.trim()) return
    await createNote.mutateAsync({ userId, content: newNote })
    setNewNote('')
    setIsAdding(false)
  }

  const handleStartEdit = (note: CustomerNote) => {
    setEditingNoteId(note.id)
    setEditContent(note.content)
  }

  const handleSaveEdit = async (noteId: string) => {
    if (!editContent.trim()) return
    await updateNote.mutateAsync({ id: noteId, userId, content: editContent })
    setEditingNoteId(null)
    setEditContent('')
  }

  const handleCancelEdit = () => {
    setEditingNoteId(null)
    setEditContent('')
  }

  return (
    <div className="space-y-2">
      {/* Add Note Button - icon เล็กๆ */}
      {!isAdding && (
        <button
          onClick={() => setIsAdding(true)}
          className="flex items-center justify-center gap-1 w-full py-1.5 text-xs text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>เพิ่มโน้ต</span>
        </button>
      )}

      {/* New Note Form */}
      {isAdding && (
        <div className="space-y-2">
          <Textarea
            value={newNote}
            onChange={(e) => setNewNote(e.target.value)}
            placeholder="เขียนโน้ต..."
            className="text-sm min-h-[80px]"
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setIsAdding(false)}>ยกเลิก</Button>
            <Button size="sm" className="h-7 text-xs" onClick={handleCreate} disabled={!newNote.trim()}>บันทึก</Button>
          </div>
        </div>
      )}

      {/* Notes List - พื้นหลังสีเหลือง */}
      <div className="space-y-2">
        {sortedNotes.map((note) => (
          <div key={note.id} className="bg-amber-50 border border-amber-200 p-2.5 rounded-lg text-sm group relative shadow-sm">
            {editingNoteId === note.id ? (
              // Edit mode
              <div className="space-y-2">
                <Textarea
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  className="text-sm min-h-[80px]"
                  autoFocus
                />
                <div className="flex justify-end gap-2">
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={handleCancelEdit}>ยกเลิก</Button>
                  <Button size="sm" className="h-7 text-xs" onClick={() => handleSaveEdit(note.id)} disabled={!editContent.trim()}>บันทึก</Button>
                </div>
              </div>
            ) : (
              // View mode
              <>
                <div className="flex justify-between items-start mb-1">
                  <div className="flex items-center gap-1.5">
                    <Avatar className="h-4 w-4">
                      <AvatarImage src={note.admin?.avatarUrl || undefined} />
                      <AvatarFallback className="text-[10px]">{getInitials(note.admin?.displayName || 'A')}</AvatarFallback>
                    </Avatar>
                    <span className="text-xs font-medium text-muted-foreground">
                      {note.admin?.displayName || 'Admin'}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      • {formatDate(note.createdAt)}
                    </span>
                    {note.updatedAt !== note.createdAt && (
                      <span className="text-[11px] text-muted-foreground">(แก้ไขแล้ว)</span>
                    )}
                  </div>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-2 bg-muted/50 rounded p-0.5">
                    <button
                      onClick={() => updateNote.mutateAsync({ id: note.id, userId, isPinned: !note.isPinned })}
                      className={cn("p-1 hover:bg-muted rounded", note.isPinned && "text-primary")}
                      title={note.isPinned ? "เลิกปักหมุด" : "ปักหมุด"}
                      aria-label={note.isPinned ? "เลิกปักหมุดโน้ต" : "ปักหมุดโน้ต"}
                    >
                      <Pin className="h-3 w-3" fill={note.isPinned ? "currentColor" : "none"} />
                    </button>
                    <button
                      onClick={() => handleStartEdit(note)}
                      className="p-1 hover:bg-muted rounded"
                      title="แก้ไข"
                      aria-label="แก้ไขโน้ต"
                    >
                      <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      onClick={() => deleteNote.mutateAsync({ id: note.id, userId })}
                      className="p-1 hover:bg-destructive/10 text-destructive rounded"
                      title="ลบ"
                      aria-label="ลบโน้ต"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <p className="whitespace-pre-wrap break-words text-xs">{note.content}</p>
                {note.isPinned && (
                  <Badge variant="secondary" className="mt-2 text-[11px] h-5 gap-1 px-2">
                    <Pin className="h-2 w-2" fill="currentColor" /> Pinned
                  </Badge>
                )}
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function ProfileSection({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  sectionKey
}: {
  title: string
  icon: any
  children: React.ReactNode
  defaultOpen?: boolean
  sectionKey: string
}) {
  const [isOpen, setIsOpen] = useState(() => {
    if (typeof window === 'undefined') return defaultOpen
    const saved = localStorage.getItem(`profile-section-${sectionKey}`)
    return saved !== null ? saved === 'true' : defaultOpen
  })

  const toggleOpen = () => {
    const newState = !isOpen
    setIsOpen(newState)
    if (typeof window !== 'undefined') {
      localStorage.setItem(`profile-section-${sectionKey}`, String(newState))
    }
  }

  return (
    <div className="mb-1.5">
      <button
        onClick={toggleOpen}
        className="flex items-center justify-between w-full px-2.5 py-1.5 bg-gray-50 hover:bg-gray-100 transition-colors rounded-md"
      >
        <div className="flex items-center gap-1.5">
          <Icon className="h-3 w-3 text-gray-600" />
          <span className="font-semibold text-[11px] text-gray-700 uppercase tracking-wide">{title}</span>
        </div>
        {isOpen ? (
          <ChevronUp className="h-3 w-3 flex-shrink-0 text-gray-500" />
        ) : (
          <ChevronDown className="h-3 w-3 flex-shrink-0 text-gray-500" />
        )}
      </button>
      {isOpen && (
        <div className="px-2 py-2 bg-white rounded-md border border-gray-100 mt-1">
          {children}
        </div>
      )}
    </div>
  )
}

export function CustomerProfile() {
  const { selectedConversationId, isProfileOpen } = useInboxStore()
  const { data: profile, isLoading } = useCustomerProfile(selectedConversationId)
  const updateProfile = useUpdateCustomerProfile()
  const { toast } = useToast()
  const queryClient = useQueryClient()
  const [isEditingContact, setIsEditingContact] = useState(false)
  const [isAddPointsOpen, setIsAddPointsOpen] = useState(false)
  const [isOdooOpen, setIsOdooOpen] = useState(false)
  const [pointsToAdd, setPointsToAdd] = useState('')
  const [pointsReason, setPointsReason] = useState('')
  const [isAddingPoints, setIsAddingPoints] = useState(false)
  const [contactDraft, setContactDraft] = useState({
    displayName: '',
    realName: '',
    memberId: '',
    phone: '',
    email: '',
    birthday: '',
    gender: '',
    address: '',
    district: '',
    province: '',
    postalCode: '',
    note: '',
  })
  const user = profile?.user as LineUser | undefined
  const tags = profile?.tags || []
  const assignees = profile?.assignees || []
  const points = profile?.points
  const tierLabel = user?.tier ? user.tier.toUpperCase() : 'STANDARD'

  const handleAddPoints = async () => {
    if (!user || !pointsToAdd || Number(pointsToAdd) <= 0) {
      toast({
        title: 'ข้อผิดพลาด',
        description: 'กรุณากรอกจำนวนแต้มที่ถูกต้อง',
        variant: 'destructive',
      })
      return
    }

    setIsAddingPoints(true)
    try {
      console.log('Adding points:', { userId: user.id, points: pointsToAdd, reason: pointsReason })

      const response = await fetch(`/api/inbox/customers/${user.id}/points/add`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          points: Number(pointsToAdd),
          reason: pointsReason || 'เพิ่มแต้มโดยแอดมิน',
        }),
      })

      const data = await response.json()
      console.log('Full response:', {
        status: response.status,
        ok: response.ok,
        statusText: response.statusText,
        data
      })
      console.log('Data object expanded:', JSON.stringify(data, null, 2))

      if (!response.ok) {
        const errorMsg = data.error || data.details || data.message || 'Failed to add points'
        console.error('API Error:', errorMsg, 'Full data:', JSON.stringify(data, null, 2))
        throw new Error(errorMsg)
      }

      toast({
        title: 'เพิ่มแต้มสำเร็จ',
        description: `เพิ่ม ${pointsToAdd} แต้มให้ ${user.displayName} แล้ว`,
      })

      setIsAddPointsOpen(false)
      setPointsToAdd('')
      setPointsReason('')

      // Invalidate and refetch customer profile
      queryClient.invalidateQueries({ queryKey: queryKeys.customerProfile(selectedConversationId) })
    } catch (error) {
      console.error('Error adding points:', error)
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: error instanceof Error ? error.message : 'ไม่สามารถเพิ่มแต้มได้',
        variant: 'destructive',
      })
    } finally {
      setIsAddingPoints(false)
    }
  }

  useEffect(() => {
    if (!user) return
    setContactDraft({
      displayName: user.displayName || '',
      realName: user.realName || '',
      memberId: user.memberId || '',
      phone: user.phone || '',
      email: user.email || '',
      birthday: user.birthday || user.birthDate || '',
      gender: user.gender || '',
      address: user.address || '',
      district: user.district || '',
      province: user.province || '',
      postalCode: user.postalCode || '',
      note: user.note || '',
    })
  }, [user])

  if (!isProfileOpen || !selectedConversationId) {
    return null
  }

  if (isLoading) {
    return (
      <div className="w-80 border-l bg-background h-full">
        <div className="p-3 space-y-3">
          <Skeleton className="h-32 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="w-80 border-l bg-background h-full flex items-center justify-center">
        <p className="text-muted-foreground">ไม่พบข้อมูลลูกค้า</p>
      </div>
    )
  }

  return (
    <div className="w-80 border-l bg-background h-full flex flex-col">
      {/* Header with contact info */}
      <div className="flex-shrink-0" style={{ background: '#0C665D' }}>
        {/* Top section */}
        <div className="flex items-center gap-3 px-4 py-3 text-white">
          <Avatar className="h-10 w-10 ring-2 ring-white/30 flex-shrink-0">
            <AvatarImage src={user.pictureUrl || undefined} />
            <AvatarFallback className="text-xs font-bold bg-white/20 text-white">
              {getInitials(user.displayName || 'U')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-base truncate">{user.displayName || user.firstName || 'ไม่ระบุชื่อ'}</h3>
            <Badge
              className="text-[10px] font-semibold px-2 py-0.5 h-auto mt-1"
              style={{
                background: 'rgba(255, 255, 255, 0.25)',
                color: 'white',
                border: '1px solid rgba(255, 255, 255, 0.3)'
              }}
            >
              <Award className="h-2 w-2 mr-0.5" />
              {tierLabel}
            </Badge>
          </div>
        </div>
        {/* Contact info in header */}
        <div className="px-4 pb-3 space-y-1">
          {user.phone && (
            <div className="flex items-center gap-2 text-white/90">
              <Phone className="h-3 w-3 text-white/60" />
              <span className="text-sm font-semibold">{user.phone}</span>
            </div>
          )}
          {user.address && (
            <div className="flex items-start gap-2 text-white/90">
              <MapPin className="h-3 w-3 text-white/70 mt-0.5 flex-shrink-0" />
              <span className="text-xs leading-snug line-clamp-2">
                {user.address}{user.district ? `, ${user.district}` : ''}{user.province ? `, ${user.province}` : ''}
              </span>
            </div>
          )}
        </div>
      </div>

      <ScrollArea className="flex-1 bg-gray-50/50">
        <div className="p-3 space-y-2">
          {/* Points & Stats Card */}
          <Card
            className="relative overflow-hidden border-0 shadow-sm"
            style={{
              background: 'linear-gradient(135deg, #0C665D 0%, #0a5048 100%)'
            }}
          >
            <div className="relative p-3">
              {/* Points Display */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                    <Star className="h-4 w-4 text-yellow-300 fill-yellow-300" />
                  </div>
                  <div>
                    <div className="text-white/80 text-[11px] font-semibold">แต้มคงเหลือ</div>
                    <div className="text-white text-xl font-bold leading-tight">
                      {user.points.toLocaleString()}
                    </div>
                  </div>
                </div>
                <button
                  onClick={() => setIsAddPointsOpen(true)}
                  className="w-8 h-8 rounded-full bg-white/20 hover:bg-white/30 flex items-center justify-center transition-colors"
                  title="เพิ่มแต้ม"
                  aria-label="เพิ่มแต้มให้ลูกค้า"
                >
                  <Plus className="h-4 w-4 text-white" />
                </button>
              </div>

              {/* Quick Stats Row */}
              <div className="flex items-center justify-between gap-2 text-white/90 rounded-md bg-white/10 px-3 py-2">
                <div className="text-center flex-1">
                  <div className="text-[10px] font-semibold uppercase text-white/80 mb-0.5">Orders</div>
                  <div className="text-sm font-bold">{user.orderCount?.toLocaleString() || '0'}</div>
                </div>
                <div className="w-px h-6 bg-white/30" />
                <div className="text-center flex-1">
                  <div className="text-[10px] font-semibold uppercase text-white/80 mb-0.5">Spent</div>
                  <div className="text-sm font-bold">฿{user.totalSpent?.toLocaleString() || '0'}</div>
                </div>
                <div className="w-px h-6 bg-white/30" />
                <div className="text-center flex-1">
                  <div className="text-[10px] font-semibold uppercase text-white/80 mb-0.5">ล่าสุด</div>
                  <div className="text-xs font-semibold">{user.lastInteraction ? formatDate(user.lastInteraction) : '—'}</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Assignees Section - แทรกตรงกลาง */}
          <Card className="p-3">
            <AssigneeSelector userId={user.id} assignees={assignees} />
          </Card>

          {/* Order Days Calendar */}
          <OrderDaysSection userId={user.id} initialDays={user.orderDays || []} />

          {/* Add Points Dialog */}
          <Dialog open={isAddPointsOpen} onOpenChange={setIsAddPointsOpen}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>เพิ่มแต้มให้ลูกค้า</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div>
                  <label className="text-sm font-medium mb-2 block">จำนวนแต้ม</label>
                  <Input
                    type="number"
                    placeholder="กรอกจำนวนแต้ม"
                    value={pointsToAdd}
                    onChange={(e) => setPointsToAdd(e.target.value)}
                    min="1"
                    className="text-lg"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-2 block">เหตุผล (ไม่บังคับ)</label>
                  <Textarea
                    placeholder="ระบุเหตุผลในการเพิ่มแต้ม"
                    value={pointsReason}
                    onChange={(e) => setPointsReason(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsAddPointsOpen(false)
                    setPointsToAdd('')
                    setPointsReason('')
                  }}
                  disabled={isAddingPoints}
                >
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleAddPoints}
                  disabled={isAddingPoints || !pointsToAdd || Number(pointsToAdd) <= 0}
                  style={{ background: '#0C665D' }}
                >
                  {isAddingPoints ? 'กำลังเพิ่ม...' : 'เพิ่มแต้ม'}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>



          {/* Tags section */}
          <ProfileSection title="แท็ก" icon={Tag} sectionKey="tags">
            <TagSelector userId={user.id} currentTags={tags} />
          </ProfileSection>

          {/* Notes section - ย้ายขึ้นมา */}
          <ProfileSection title="โน้ต" icon={FileText} sectionKey="notes" defaultOpen={true}>
            <NotesSection userId={user.id} />
          </ProfileSection>

          {/* Contact info - ย้ายขึ้นมา */}
          <ProfileSection title="ข้อมูลติดต่อ" icon={User} sectionKey="contact" defaultOpen={true}>
            <div className="space-y-1">
              {!isEditingContact ? (
                <>
                  <InfoRow icon={User} label="ชื่อจริง" value={user.realName} />
                  <InfoRow icon={Star} label="เลขสมาชิก" value={user.memberId} />
                  <InfoRow icon={Phone} label="เบอร์โทร" value={user.phone} />
                  <InfoRow icon={Mail} label="อีเมล" value={user.email} />
                  <InfoRow
                    icon={Calendar}
                    label="วันเกิด"
                    value={user.birthday || user.birthDate ? formatDate(user.birthday || user.birthDate || '') : null}
                  />
                  <InfoRow
                    icon={User}
                    label="เพศ"
                    value={user.gender === 'male' ? 'ชาย' : user.gender === 'female' ? 'หญิง' : user.gender === 'other' ? 'อื่นๆ' : null}
                  />
                  <InfoRow
                    icon={MapPin}
                    label="ที่อยู่"
                    value={
                      user.address
                        ? `${user.address}${user.district ? `, ${user.district}` : ''}${user.province ? `, ${user.province}` : ''
                        }${user.postalCode ? ` ${user.postalCode}` : ''}`
                        : null
                    }
                  />
                  {user.note && (
                    <InfoRow icon={FileText} label="หมายเหตุ" value={user.note} />
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8 text-xs mt-2"
                    onClick={() => setIsEditingContact(true)}
                  >
                    <Edit2 className="h-3 w-3 mr-1" />
                    แก้ไขข้อมูล
                  </Button>
                </>
              ) : (
                <div className="space-y-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">ชื่อที่แสดง</label>
                      <Input
                        value={contactDraft.displayName}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, displayName: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="ชื่อที่แสดง"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">ชื่อจริง</label>
                      <Input
                        value={contactDraft.realName}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, realName: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="ชื่อ-นามสกุล"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">เลขสมาชิก</label>
                      <Input
                        value={contactDraft.memberId}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, memberId: e.target.value }))
                        }
                        className="h-8 text-sm font-mono"
                        placeholder="PC10000"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">เบอร์โทร</label>
                      <Input
                        value={contactDraft.phone}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, phone: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="08x-xxx-xxxx"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">อีเมล</label>
                    <Input
                      type="email"
                      value={contactDraft.email}
                      onChange={(e) =>
                        setContactDraft((prev) => ({ ...prev, email: e.target.value }))
                      }
                      className="h-8 text-sm"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">วันเกิด</label>
                      <Input
                        type="date"
                        value={contactDraft.birthday}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, birthday: e.target.value }))
                        }
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">เพศ</label>
                      <select
                        value={contactDraft.gender}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, gender: e.target.value }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-3 text-sm"
                      >
                        <option value="">-- เลือก --</option>
                        <option value="male">ชาย</option>
                        <option value="female">หญิง</option>
                        <option value="other">อื่นๆ</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">ที่อยู่</label>
                    <Textarea
                      value={contactDraft.address}
                      onChange={(e) =>
                        setContactDraft((prev) => ({ ...prev, address: e.target.value }))
                      }
                      className="text-sm min-h-[60px]"
                      placeholder="บ้านเลขที่ ซอย ถนน"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">เขต/อำเภอ</label>
                      <Input
                        value={contactDraft.district}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, district: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="เขต/อำเภอ"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">จังหวัด</label>
                      <Input
                        value={contactDraft.province}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, province: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="จังหวัด"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-600 mb-1 block">รหัสไปรษณีย์</label>
                      <Input
                        value={contactDraft.postalCode}
                        onChange={(e) =>
                          setContactDraft((prev) => ({ ...prev, postalCode: e.target.value }))
                        }
                        className="h-8 text-sm"
                        placeholder="10xxx"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-gray-600 mb-1 block">หมายเหตุ</label>
                    <Textarea
                      value={contactDraft.note}
                      onChange={(e) =>
                        setContactDraft((prev) => ({ ...prev, note: e.target.value }))
                      }
                      className="text-sm min-h-[60px]"
                      placeholder="บันทึกเพิ่มเติมเกี่ยวกับลูกค้า..."
                    />
                  </div>
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => {
                        setIsEditingContact(false)
                        setContactDraft({
                          displayName: user.displayName || '',
                          realName: user.realName || '',
                          memberId: user.memberId || '',
                          phone: user.phone || '',
                          email: user.email || '',
                          birthday: user.birthday || user.birthDate || '',
                          gender: user.gender || '',
                          address: user.address || '',
                          district: user.district || '',
                          province: user.province || '',
                          postalCode: user.postalCode || '',
                          note: user.note || '',
                        })
                      }}
                    >
                      ยกเลิก
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      style={{ background: '#0C665D' }}
                      onClick={async () => {
                        await updateProfile.mutateAsync({
                          userId: user.id,
                          displayName: contactDraft.displayName || null,
                          realName: contactDraft.realName || null,
                          memberId: contactDraft.memberId || null,
                          phone: contactDraft.phone || null,
                          email: contactDraft.email || null,
                          birthday: contactDraft.birthday || null,
                          gender: contactDraft.gender || null,
                          address: contactDraft.address || null,
                          district: contactDraft.district || null,
                          province: contactDraft.province || null,
                          postalCode: contactDraft.postalCode || null,
                          note: contactDraft.note || null,
                        })
                        setIsEditingContact(false)
                      }}
                      disabled={updateProfile.isPending}
                    >
                      บันทึก
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </ProfileSection>





          {/* LINE Info section */}
          <ProfileSection title="ข้อมูล LINE" icon={MessageCircle} sectionKey="line-info">
            <LineInfoSection user={user} />
          </ProfileSection>

          {/* Activity History section */}
          <ProfileSection title="ประวัติการแก้ไข" icon={History} sectionKey="activity-history">
            <ActivityHistorySection userId={user.id} />
          </ProfileSection>

          {/* CNY ERP / Odoo Button */}
          <button
            onClick={() => setIsOdooOpen(true)}
            className="w-full flex items-center justify-between px-3 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-lg shadow-sm transition-all duration-200 group"
          >
            <div className="flex items-center gap-2">
              <ShoppingBag className="h-4 w-4" />
              <span className="font-semibold text-sm">CNY ERP</span>
            </div>
            <span className="text-xs opacity-80 group-hover:opacity-100">ค้นหาสินค้า / ลูกค้า / ออเดอร์ →</span>
          </button>

          {/* Odoo Modal */}
          <OdooModal
            open={isOdooOpen}
            onOpenChange={setIsOdooOpen}
            customerPartnerCode={user.memberId || undefined}
          />
        </div>
      </ScrollArea>
    </div>
  )
}
