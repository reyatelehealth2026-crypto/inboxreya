import { create } from 'zustand'
import { devtools, persist } from 'zustand/middleware'

export interface ConversationFilters {
  status?: 'all' | 'active' | 'pending' | 'resolved'
  tagId?: string
  tagIds?: string[]
  assignedTo?: string
  assignedToIds?: string[]
  search?: string
  unreadOnly?: boolean
  startDate?: string
  endDate?: string
  platform?: 'all' | 'line' | 'facebook' | 'tiktok'
}

/**
 * Conversations per request, and the step "load more" grows by.
 *
 * Sized from prod (2026-09-17, account 3): a working day touches 14–207
 * conversations, ≤108 on 8 of the last 10 days, and 12 have unread messages —
 * so 100 shows a normal day without scrolling into "load more", at ~200 KB per
 * 15 s poll instead of the ~2 MB the old limit of 1000 shipped to every rep.
 * The screen itself shows about 10 rows (88 px each).
 */
export const CONVERSATION_PAGE_SIZE = 100

/** Server caps `limit` at 2000 (api/inbox/conversations). */
const CONVERSATION_LIMIT_MAX = 2000

interface InboxState {
  // Selected conversation
  selectedConversationId: string | null

  // Filters
  filters: ConversationFilters

  // How far "load more" has grown the list, remembered per filter set: a new
  // filter falls back to one page on its own, while re-applying the same
  // filters (the URL sync does that on every navigation) keeps the place.
  conversationPaging: { filtersKey: string; limit: number }
  loadMoreConversations: (filtersKey: string) => void

  // UI State
  isSidebarOpen: boolean
  isProfileOpen: boolean

  // Actions
  setSelectedConversation: (id: string | null) => void
  setFilters: (filters: Partial<ConversationFilters> | ((current: ConversationFilters) => Partial<ConversationFilters>)) => void
  setAllFilters: (filters: ConversationFilters) => void
  resetFilters: () => void
  toggleSidebar: () => void
  toggleProfile: () => void
  setSidebarOpen: (open: boolean) => void
  setProfileOpen: (open: boolean) => void
}

const defaultFilters: ConversationFilters = {
  status: 'all',
  tagId: undefined,
  tagIds: undefined,
  assignedTo: undefined,
  assignedToIds: undefined,
  search: '',
  unreadOnly: false,
  startDate: undefined,
  endDate: undefined,
  platform: 'all',
}

export const useInboxStore = create<InboxState>()(
  devtools(
    persist(
      (set) => ({
        // Initial state
        selectedConversationId: null,
        filters: defaultFilters,
        conversationPaging: { filtersKey: '', limit: CONVERSATION_PAGE_SIZE },
        isSidebarOpen: true,
        isProfileOpen: true,

        // Actions
        loadMoreConversations: (filtersKey) =>
          set(
            (state) => {
              const current =
                state.conversationPaging.filtersKey === filtersKey
                  ? state.conversationPaging.limit
                  : CONVERSATION_PAGE_SIZE
              return {
                conversationPaging: {
                  filtersKey,
                  limit: Math.min(CONVERSATION_LIMIT_MAX, current + CONVERSATION_PAGE_SIZE),
                },
              }
            },
            false,
            'loadMoreConversations'
          ),

        setSelectedConversation: (id) =>
          set({ selectedConversationId: id }, false, 'setSelectedConversation'),

        setFilters: (newFiltersOrFn) => {
          if (typeof newFiltersOrFn === 'function') {
            // Support functional updates
            return set(
              (state) => {
                const updates = newFiltersOrFn(state.filters)
                return { filters: { ...state.filters, ...updates } }
              },
              false,
              'setFilters'
            )
          }
          return set(
            (state) => ({ filters: { ...state.filters, ...newFiltersOrFn } }),
            false,
            'setFilters'
          )
        },

        setAllFilters: (filters) =>
          set({ filters }, false, 'setAllFilters'),

        resetFilters: () =>
          set({ filters: defaultFilters }, false, 'resetFilters'),

        toggleSidebar: () =>
          set(
            (state) => ({ isSidebarOpen: !state.isSidebarOpen }),
            false,
            'toggleSidebar'
          ),

        toggleProfile: () =>
          set(
            (state) => ({ isProfileOpen: !state.isProfileOpen }),
            false,
            'toggleProfile'
          ),

        setSidebarOpen: (open) =>
          set({ isSidebarOpen: open }, false, 'setSidebarOpen'),

        setProfileOpen: (open) =>
          set({ isProfileOpen: open }, false, 'setProfileOpen'),
      }),
      {
        name: 'inbox-store',
        // Don't persist filters - they should come from URL
        partialize: (state) => ({
          isSidebarOpen: state.isSidebarOpen,
          isProfileOpen: state.isProfileOpen,
        }),
      }
    ),
    { name: 'InboxStore' }
  )
)
