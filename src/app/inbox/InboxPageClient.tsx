"use client"

import { useEffect, useState } from 'react'
import dynamic from 'next/dynamic'
import { useSession } from 'next-auth/react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Menu, ArrowLeft } from 'lucide-react'
import { ConversationList } from '@/components/inbox/ConversationList'
const ChatPanel = dynamic(
  () => import('@/components/inbox/ChatPanel').then((mod) => mod.ChatPanel),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
        กำลังโหลดแชต...
      </div>
    ),
  }
)
import { useRealtime } from '@/hooks/use-realtime'
import { usePusher } from '@/hooks/use-pusher'
import { useInboxFilterSync } from '@/hooks/use-inbox-filter-sync'
import { useInboxStore } from '@/stores/inbox'
import { useSettingsStore } from '@/stores/settings'
import { useInboxKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'
import { KeyboardShortcutsHelp } from '@/components/inbox/KeyboardShortcutsHelp'
import { useUpdateConversationStatus, useConversations } from '@/hooks/use-conversations'
import { useToast } from '@/hooks/use-toast'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

const CustomerProfile = dynamic(
  () => import('@/components/inbox/CustomerProfile').then((mod) => mod.CustomerProfile),
  {
    ssr: false,
    loading: () => (
      <div className="w-72 border-l bg-card p-3 space-y-3">
        <div className="h-20 w-20 rounded-full bg-muted mx-auto" />
        <div className="h-5 w-32 bg-muted mx-auto rounded" />
        <div className="h-4 w-24 bg-muted mx-auto rounded" />
        <div className="h-24 w-full bg-muted rounded" />
      </div>
    ),
  }
)

export default function InboxPageClient() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const searchParams = useSearchParams()
  const {
    isSidebarOpen,
    isProfileOpen,
    selectedConversationId,
    setSelectedConversation,
    setProfileOpen,
    filters,
  } = useInboxStore()

  const { autoAdvance } = useSettingsStore()

  // Fetch conversations for auto-advance nav
  const { data: conversationsData } = useConversations()

  const conversations = conversationsData?.data || []

  const updateStatus = useUpdateConversationStatus()
  const { toast } = useToast()

  const [isMobile, setIsMobile] = useState(false)
  const [mobileView, setMobileView] = useState<'list' | 'chat' | 'profile'>('list')
  const [isShortcutsHelpOpen, setIsShortcutsHelpOpen] = useState(false)

  useInboxFilterSync()

  // Handle initial conversation selection from query param
  useEffect(() => {
    const userId = searchParams.get('userId')
    if (userId && userId !== selectedConversationId) {
      setSelectedConversation(userId)
    }
  }, [searchParams, setSelectedConversation, selectedConversationId])

  // Register keyboard shortcuts
  useInboxKeyboardShortcuts({
    onSearchConversations: () => {
      const searchInput = document.querySelector('input[placeholder*="ค้นหา"]') as HTMLInputElement
      searchInput?.focus()
    },
    onShowShortcutsHelp: () => setIsShortcutsHelpOpen(true),
    onNavigateUp: () => {
      // Navigation will be handled by store or custom logic if needed, 
      // but let's at least hook it up to help dialog for now
    },
    onNavigateDown: () => {
      // Navigation logic handled in ConversationList
    },
    onMarkAsResolved: async () => {
      if (!selectedConversationId) return

      try {
        await updateStatus.mutateAsync({
          userId: selectedConversationId,
          status: 'resolved'
        })
        toast({
          title: 'การสนทนาถูกปิดแล้ว',
          description: 'เปลี่ยนสถานะเป็น "แก้ไขแล้ว" เรียบร้อย',
        })

        // Auto-advance logic
        if (autoAdvance) {
          const currentIndex = conversations.findIndex(c => c.id === selectedConversationId)
          if (currentIndex !== -1) {
            // Try next conversation, or previous if at end
            const nextConversation = conversations[currentIndex + 1] || conversations[currentIndex - 1]
            if (nextConversation) {
              setSelectedConversation(nextConversation.id)
            }
          }
        }
      } catch (error) {
        toast({
          title: 'เกิดข้อผิดพลาด',
          description: 'ไม่สามารถเปลี่ยนสถานะได้',
          variant: 'destructive',
        })
      }
    },
    enabled: true,
  })

  // Handle URL query for auto-selection
  useEffect(() => {
    const selectedId = searchParams?.get('selected')
    if (selectedId && selectedId !== selectedConversationId) {
      setSelectedConversation(selectedId)
      // Clear param after selection to avoid sticky behavior (optional, but good UX)
      // router.replace('/inbox', { scroll: false })
    }
  }, [searchParams, setSelectedConversation, selectedConversationId])

  // Detect mobile viewport
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle mobile view changes when conversation is selected
  useEffect(() => {
    if (isMobile && selectedConversationId) {
      setMobileView('chat')
    }
  }, [isMobile, selectedConversationId])

  // Set up real-time connection (SSE fallback)
  const { error: sseError } = useRealtime({
    enabled: status === 'authenticated',
  })

  // Set up Pusher real-time connection (primary)
  const { error: pusherError, isConnected: pusherConnected } = usePusher({
    enabled: status === 'authenticated',
  })

  // Use Pusher error if available, otherwise SSE error
  const error = pusherError || sseError

  // Redirect to login if not authenticated
  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  const handleBackToList = () => {
    setMobileView('list')
    setSelectedConversation(null)
  }

  const handleShowProfile = () => {
    if (isMobile) {
      setMobileView('profile')
    } else {
      setProfileOpen(!isProfileOpen)
    }
  }

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  // Mobile layout
  if (isMobile) {
    return (
      <div className="flex flex-col h-screen overflow-hidden bg-background">
        {/* Mobile Header */}
        <div className="flex items-center justify-between p-3 border-b bg-card">
          {mobileView === 'list' ? (
            <>
              <h1 className="font-semibold text-lg">แชท</h1>
              <Button variant="ghost" size="icon" aria-label="เปิดเมนู">
                <Menu className="h-5 w-5" />
              </Button>
            </>
          ) : mobileView === 'chat' ? (
            <>
              <Button variant="ghost" size="icon" onClick={handleBackToList} aria-label="กลับไปที่รายการแชท">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium">แชท</span>
              <Button variant="ghost" size="icon" onClick={handleShowProfile} aria-label="ดูข้อมูลลูกค้า">
                <Menu className="h-5 w-5" />
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="icon" onClick={() => setMobileView('chat')} aria-label="กลับไปที่แชท">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <span className="font-medium">ข้อมูลลูกค้า</span>
              <div className="w-10" />
            </>
          )}
        </div>

        {/* Mobile Content */}
        <div className="flex-1 overflow-hidden h-full">
          {mobileView === 'list' && <ConversationList />}
          {mobileView === 'chat' && <ChatPanel />}
          {mobileView === 'profile' && <div className="h-full"><CustomerProfile /></div>}
        </div>
      </div>
    )
  }

  // Desktop layout
  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Conversation List */}
      <div
        className={cn(
          'flex-shrink-0 border-r transition-all duration-300',
          isSidebarOpen ? 'w-72' : 'w-0 overflow-hidden'
        )}
      >
        <ConversationList />
      </div>

      {/* Chat Panel */}
      <div className="flex-1 min-w-0">
        <ChatPanel />
      </div>

      {/* Customer Profile */}
      <div
        className={cn(
          'flex-shrink-0 transition-all duration-300 hidden lg:block h-full',
          isProfileOpen ? 'w-96' : 'w-0 overflow-hidden'
        )}
      >
        <CustomerProfile />
      </div>

      {/* Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp
        open={isShortcutsHelpOpen}
        onOpenChange={setIsShortcutsHelpOpen}
      />
    </div>
  )
}
