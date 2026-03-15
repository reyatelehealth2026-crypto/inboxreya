import type { ConversationFilters } from '@/stores/inbox'

export const queryKeys = {
  conversationsRoot: () => ['conversations'] as const,
  conversations: (filters?: ConversationFilters) => ['conversations', filters ?? {}] as const,
  conversationsInfinite: (filters?: ConversationFilters) =>
    ['conversations', 'infinite', filters ?? {}] as const,
  conversation: (id: string | null) => ['conversations', id] as const,
  customerProfile: (userId: string | null) => ['customers', userId] as const,
  messagesRoot: () => ['messages'] as const,
  messagesForUser: (userId: string | null) => ['messages', userId] as const,
  messages: (
    userId: string | null,
    options?: { limit?: number; startDate?: string; endDate?: string }
  ) => ['messages', userId, options ?? {}] as const,
  messagesInfinite: (
    userId: string | null,
    options?: { startDate?: string; endDate?: string }
  ) => ['messages', 'infinite', userId, options ?? {}] as const,
  admins: () => ['admins'] as const,
  assignees: (userId: string) => ['assignees', userId] as const,
  tags: () => ['tags'] as const,
  autoTags: () => ['auto-tags'] as const,
  notes: (userId: string) => ['notes', userId] as const,
  templates: (search?: string, category?: string) => 
    ['templates', { search: search ?? '', category: category ?? '' }] as const,
}
