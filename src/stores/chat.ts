import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import { Message } from '@/types'

export interface TypingUser {
  id: string
  name: string
  timestamp: number
}

interface ChatState {
  // Message input
  messageInput: string
  replyingToMessage: Message | null

  // Typing indicators
  typingUsers: Map<string, TypingUser[]>

  // UI State
  isComposerFocused: boolean
  showEmojiPicker: boolean
  lightboxImage: string | null

  // Actions
  setMessageInput: (input: string) => void
  setReplyToMessage: (message: Message | null) => void
  clearReply: () => void

  // Typing
  addTypingUser: (conversationId: string, user: TypingUser) => void
  removeTypingUser: (conversationId: string, userId: string) => void
  getTypingUsers: (conversationId: string) => TypingUser[]

  // UI
  setComposerFocused: (focused: boolean) => void
  toggleEmojiPicker: () => void
  setShowEmojiPicker: (show: boolean) => void
  setLightboxImage: (src: string | null) => void
  closeLightbox: () => void
}

export const useChatStore = create<ChatState>()(
  devtools(
    (set, get) => ({
      // Initial state
      messageInput: '',
      replyingToMessage: null,
      typingUsers: new Map(),
      isComposerFocused: false,
      showEmojiPicker: false,
      lightboxImage: null,

      // Actions
      setMessageInput: (input) =>
        set({ messageInput: input }, false, 'setMessageInput'),

      setReplyToMessage: (message) =>
        set({ replyingToMessage: message }, false, 'setReplyToMessage'),

      clearReply: () =>
        set({ replyingToMessage: null }, false, 'clearReply'),

      // Typing indicators
      addTypingUser: (conversationId, user) =>
        set(
          (state) => {
            const newTypingUsers = new Map(state.typingUsers)
            const users = newTypingUsers.get(conversationId) || []
            const existingIndex = users.findIndex((u) => u.id === user.id)

            if (existingIndex >= 0) {
              users[existingIndex] = user
            } else {
              users.push(user)
            }

            newTypingUsers.set(conversationId, users)
            return { typingUsers: newTypingUsers }
          },
          false,
          'addTypingUser'
        ),

      removeTypingUser: (conversationId, userId) =>
        set(
          (state) => {
            const newTypingUsers = new Map(state.typingUsers)
            const users = newTypingUsers.get(conversationId) || []
            const filteredUsers = users.filter((u) => u.id !== userId)

            if (filteredUsers.length > 0) {
              newTypingUsers.set(conversationId, filteredUsers)
            } else {
              newTypingUsers.delete(conversationId)
            }

            return { typingUsers: newTypingUsers }
          },
          false,
          'removeTypingUser'
        ),

      getTypingUsers: (conversationId) => {
        const state = get()
        return state.typingUsers.get(conversationId) || []
      },

      // UI
      setComposerFocused: (focused) =>
        set({ isComposerFocused: focused }, false, 'setComposerFocused'),

      toggleEmojiPicker: () =>
        set(
          (state) => ({ showEmojiPicker: !state.showEmojiPicker }),
          false,
          'toggleEmojiPicker'
        ),

      setShowEmojiPicker: (show) =>
        set({ showEmojiPicker: show }, false, 'setShowEmojiPicker'),

      setLightboxImage: (src) =>
        set({ lightboxImage: src }, false, 'setLightboxImage'),

      closeLightbox: () =>
        set({ lightboxImage: null }, false, 'closeLightbox'),
    }),
    { name: 'ChatStore' }
  )
)
