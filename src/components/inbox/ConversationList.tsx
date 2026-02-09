"use client"

import { useState, useMemo, useCallback, useEffect, useRef, memo, useTransition } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Search, MessageSquare, RefreshCw, X, SearchX } from 'lucide-react'
import { useConversations } from '@/hooks/use-conversations'
import { useInboxStore } from '@/stores/inbox'
import { useInboxKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn, formatTimeAgo, truncate, getInitials } from '@/lib/utils'
import { resolveAssigneeBadgeColor } from '@/config/assignee-colors'
import { FilterBar } from './FilterBar'
import type { Conversation } from '@/types'

interface NoResultsStateProps {
  hasActiveFilters: boolean
  hasSearchQuery: boolean
  onClearFilters: () => void
}

function NoResultsState({ hasActiveFilters, hasSearchQuery, onClearFilters }: NoResultsStateProps) {
  return (
    <div className="flex flex-col items-center justify-center h-96 px-6 text-center">
      <div className="rounded-full bg-muted p-6 mb-4">
        <SearchX className="h-12 w-12 text-muted-foreground" />
      </div>

      <h3 className="text-lg font-semibold mb-2">
        ไม่พบผลลัพธ์
      </h3>

      <p className="text-sm text-muted-foreground mb-6 max-w-sm">
        {hasSearchQuery && hasActiveFilters ? (
          <>ไม่พบการสนทนาที่ตรงกับคำค้นหาและตัวกรองที่เลือก</>
        ) : hasSearchQuery ? (
          <>ไม่พบการสนทนาที่ตรงกับคำค้นหา</>
        ) : hasActiveFilters ? (
          <>ไม่พบการสนทนาที่ตรงกับตัวกรองที่เลือก</>
        ) : (
          <>ยังไม่มีการสนทนา</>
        )}
      </p>

      {(hasSearchQuery || hasActiveFilters) && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            ลองทำสิ่งเหล่านี้:
          </p>
          <ul className="text-sm text-muted-foreground space-y-2 text-left">
            {hasSearchQuery && (
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>ตรวจสอบการสะกดคำ หรือลองใช้คำค้นหาอื่น</span>
              </li>
            )}
            {hasActiveFilters && (
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>ลองเปลี่ยนหรือลบตัวกรองบางตัว</span>
              </li>
            )}
            <li className="flex items-start gap-2">
              <span className="text-primary mt-0.5">•</span>
              <span>ลองค้นหาด้วยคำที่กว้างขึ้น</span>
            </li>
          </ul>

          <Button
            variant="outline"
            onClick={onClearFilters}
            className="mt-4"
          >
            <X className="h-4 w-4 mr-2" />
            ล้างการค้นหาและตัวกรองทั้งหมด
          </Button>
        </div>
      )}
    </div>
  )
}

const ConversationItem = memo(function ConversationItem({
  conversation,
  isSelected,
  onClick,
  searchQuery = '',
}: {
  conversation: Conversation
  isSelected: boolean
  onClick: () => void
  searchQuery?: string
}) {
  const { user, lastMessage, unreadCount, assignees } = conversation

  const displayName = user.displayName || user.firstName || 'ไม่ระบุชื่อ'

  const lastMessageText = useMemo(() => {
    return lastMessage?.messageType === 'text'
      ? truncate(lastMessage.content || '', 50)
      : `[${lastMessage?.messageType}]`
  }, [lastMessage])

  const assignedAdmins = useMemo(() => assignees || [], [assignees])
  const primaryAssignee = assignedAdmins[0]
  const badgeColor = resolveAssigneeBadgeColor(primaryAssignee)

  const handleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault()
    onClick()
  }, [onClick])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  }, [onClick])

  return (
    <div
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      role="option"
      aria-selected={isSelected}
      tabIndex={0}
      className={cn(
        'flex items-center gap-2.5 px-3 py-2 cursor-pointer transition-colors',
        'border-b border-gray-100',
        isSelected
          ? 'bg-green-50/80 border-l-[3px] border-l-green-600'
          : 'hover:bg-gray-50/80'
      )}
    >
      <Avatar className="h-9 w-9 flex-shrink-0">
        <AvatarImage
          src={user.pictureUrl || undefined}
          alt={user.displayName || 'User'}
          referrerPolicy="no-referrer"
          onError={(e) => {
            e.currentTarget.style.display = 'none'
          }}
        />
        <AvatarFallback className="text-xs">{getInitials(user.displayName || 'U')}</AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1">
          <span className="font-medium text-sm truncate text-gray-900">
            {displayName}
          </span>
          {lastMessage && (
            <span className="text-[10px] text-gray-500 flex-shrink-0">
              {formatTimeAgo(lastMessage.createdAt)}
            </span>
          )}
        </div>

        {lastMessage && (
          <p className="text-xs text-gray-500 truncate leading-tight">
            {lastMessage.direction === 'outgoing' && (
              <span className="text-green-600">คุณ: </span>
            )}
            {lastMessageText}
          </p>
        )}

        {assignedAdmins.length > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <Badge
              className="text-[10px] px-1.5 py-0 h-[18px] text-white border-0"
              style={{
                backgroundColor: badgeColor.bg,
              }}
            >
              {assignedAdmins.length === 1
                ? (primaryAssignee?.displayName || primaryAssignee?.username || 'ผู้ดูแล')
                : `${assignedAdmins.length} คน`}
            </Badge>
          </div>
        )}
      </div>

      {unreadCount > 0 && (
        <Badge variant="destructive" className="flex-shrink-0 h-5 min-w-[20px] text-[10px] px-1.5">
          {unreadCount > 99 ? '99+' : unreadCount}
        </Badge>
      )}
    </div>
  )
}, (prevProps, nextProps) => {
  return (
    prevProps.conversation.id === nextProps.conversation.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.searchQuery === nextProps.searchQuery &&
    prevProps.conversation.unreadCount === nextProps.conversation.unreadCount &&
    prevProps.conversation.lastMessage?.id === nextProps.conversation.lastMessage?.id
  )
})

function ConversationSkeleton() {
  return (
    <div className="flex items-start gap-3 p-3 border-b">
      <Skeleton className="h-10 w-10 rounded-full" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-3 w-48" />
        <div className="flex gap-1">
          <Skeleton className="h-4 w-12" />
          <Skeleton className="h-4 w-16" />
        </div>
      </div>
    </div>
  )
}

export function ConversationList() {
  const parentRef = useRef<HTMLDivElement>(null)
  const [searchInput, setSearchInput] = useState('')
  const [isFilterOpen, setIsFilterOpen] = useState(false)
  const [isPending, startTransition] = useTransition()

  const {
    selectedConversationId,
    setSelectedConversation,
    filters,
    setFilters,
    resetFilters,
  } = useInboxStore()

  // Mark performance start
  useEffect(() => {
    if (typeof window !== 'undefined') {
      performance.mark('conversation-list-start')
    }
  }, [])

  const { data, isLoading, isError, refetch, isFetching } = useConversations()

  // Mark performance end when data is loaded
  useEffect(() => {
    if (!isLoading && data && typeof window !== 'undefined') {
      performance.mark('conversation-list-end')
      try {
        performance.measure('conversation-list-load', 'conversation-list-start', 'conversation-list-end')
        const measure = performance.getEntriesByName('conversation-list-load')[0]
        if (measure && process.env.NODE_ENV === 'development') {
          const status = measure.duration < 2000 ? '✅' : '❌'
          console.log(`${status} Conversation List Load Time: ${measure.duration.toFixed(2)}ms (target: <2000ms)`)
        }
      } catch (e) {
        // Ignore measurement errors
      }
    }
  }, [isLoading, data])

  const conversations = useMemo(() => {
    return Array.isArray(data?.data) ? data.data : []
  }, [data])

  const activeSearchQuery = filters.search || ''

  const activeFilterCount = useMemo(() => {
    let count = 0
    if (filters.status && filters.status !== 'all') count++
    if (filters.tagId || (filters.tagIds && filters.tagIds.length > 0)) count++
    if (filters.assignedTo) count++
    if (filters.unreadOnly) count++
    if (filters.startDate || filters.endDate) count++
    return count
  }, [filters])

  const rowVirtualizer = useVirtualizer({
    count: conversations.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 88,
    overscan: 5,
  })

  const handleSearch = useCallback((value: string) => {
    setSearchInput(value)
  }, [])

  useEffect(() => {
    setSearchInput(filters.search || '')
  }, [filters.search])

  useEffect(() => {
    const timeout = setTimeout(() => {
      if (searchInput !== (filters.search || '')) {
        startTransition(() => {
          setFilters({ search: searchInput })
        })
      }
    }, 200)

    return () => clearTimeout(timeout)
  }, [filters.search, searchInput, setFilters, startTransition])

  const handleSelectConversation = useCallback((id: string) => {
    startTransition(() => {
      setSelectedConversation(id)
    })
  }, [setSelectedConversation])

  // Register navigation shortcuts
  useInboxKeyboardShortcuts({
    onNavigateUp: () => {
      if (conversations.length === 0) return
      const currentIndex = selectedConversationId
        ? conversations.findIndex(c => c.id === selectedConversationId)
        : -1

      const nextIndex = currentIndex <= 0 ? conversations.length - 1 : currentIndex - 1
      handleSelectConversation(conversations[nextIndex].id)
    },
    onNavigateDown: () => {
      if (conversations.length === 0) return
      const currentIndex = selectedConversationId
        ? conversations.findIndex(c => c.id === selectedConversationId)
        : -1

      const nextIndex = currentIndex === -1 || currentIndex >= conversations.length - 1 ? 0 : currentIndex + 1
      handleSelectConversation(conversations[nextIndex].id)
    },
    enabled: true
  })

  return (
    <div id="conversation-list" className="flex flex-col h-full bg-card" aria-label="รายการการสนทนา">
      <div className="p-4 border-b space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-lg flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            แชท
            {data?.pagination.total !== undefined && (
              <Badge variant="secondary" className="ml-1">
                {data.pagination.total}
              </Badge>
            )}
          </h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => refetch()}
            disabled={isFetching}
            aria-label="รีเฟรชรายการแชท"
          >
            <RefreshCw className={cn('h-4 w-4', isFetching && 'animate-spin')} />
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ค้นหาชื่อหรือเบอร์โทร..."
            value={searchInput}
            onChange={(e) => handleSearch(e.target.value)}
            className="pl-9"
            aria-label="ค้นหาการสนทนา"
          />
        </div>

        <FilterBar
          isOpen={isFilterOpen}
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
        />
      </div>

      <ScrollArea ref={parentRef} className="flex-1" role="listbox" aria-label="รายการการสนทนา">
        {isLoading ? (
          <div>
            {Array.from({ length: 8 }).map((_, i) => (
              <ConversationSkeleton key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="flex flex-col items-center justify-center h-48 text-muted-foreground">
            <p>เกิดข้อผิดพลาดในการโหลดข้อมูล</p>
            <Button variant="link" onClick={() => refetch()}>
              ลองใหม่
            </Button>
          </div>
        ) : conversations.length === 0 ? (
          <NoResultsState
            hasActiveFilters={activeFilterCount > 0}
            hasSearchQuery={!!activeSearchQuery}
            onClearFilters={() => {
              setSearchInput('')
              resetFilters()
            }}
          />
        ) : (
          <div
            style={{
              height: `${rowVirtualizer.getTotalSize()}px`,
              width: '100%',
              position: 'relative',
            }}
          >
            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
              const conversation = conversations[virtualRow.index]
              const isSelected = selectedConversationId === conversation.id

              return (
                <div
                  key={conversation.id}
                  data-index={virtualRow.index}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: `${virtualRow.size}px`,
                    transform: `translateY(${virtualRow.start}px)`,
                  }}
                >
                  <ConversationItem
                    conversation={conversation}
                    isSelected={isSelected}
                    onClick={() => handleSelectConversation(conversation.id)}
                    searchQuery={activeSearchQuery}
                  />
                </div>
              )
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  )
}
