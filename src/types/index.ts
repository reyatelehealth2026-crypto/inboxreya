// Conversation types
export interface Conversation {
  id: string
  user: LineUser
  lastMessage: Message | null
  unreadCount: number
  status: 'active' | 'pending' | 'resolved'
  assignees: AdminUser[]
  tags: UserTag[]
  updatedAt: string
}

// User types
export interface LineUser {
  id: string
  lineUserId: string
  displayName: string | null
  pictureUrl: string | null
  statusMessage: string | null
  firstName: string | null
  lastName: string | null
  realName?: string | null
  phone: string | null
  email: string | null
  birthDate: string | null
  birthday?: string | null
  gender: string | null
  weight?: number | null
  height?: number | null
  address: string | null
  district?: string | null
  province: string | null
  postalCode?: string | null
  memberId?: string | null
  note?: string | null
  membershipLevel: string
  tier: string
  points: number
  totalPoints?: number
  availablePoints?: number
  usedPoints?: number
  loyaltyPoints?: number
  totalSpent: number
  orderCount: number
  lastInteraction: string | null
  chatStatus: string | null
  isBlocked: boolean
  isRegistered: boolean
  orderDays?: string[] // Array of day codes: 'mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'
  createdAt: string
  updatedAt?: string
  tags?: UserTag[]
  notes?: CustomerNote[]
}

export interface CustomerNote {
  id: string
  userId: string
  adminId: string
  content: string
  isPinned: boolean
  createdAt: string
  updatedAt: string
  admin?: AdminUser
}

export interface AdminUser {
  id: string
  username: string
  email: string
  displayName: string | null
  avatarUrl: string | null
  role: 'super_admin' | 'admin' | 'pharmacist' | 'staff' | 'user'
  isActive: boolean
}

export interface CustomerProfile {
  user: LineUser
  tags: UserTag[]
  assignees: AdminUser[]
  points: {
    total: number
    available: number
    used: number
    loyalty: number
  }
}

// Message types
export type MessageType =
  | 'text'
  | 'image'
  | 'video'
  | 'audio'
  | 'file'
  | 'location'
  | 'sticker'
  | 'flex'

export type MessageDirection = 'incoming' | 'outgoing'

export interface Message {
  id: string
  userId: string
  direction: MessageDirection
  messageType: MessageType
  content: string | null
  mediaUrl: string | null
  metadata: MessageMetadata | null
  isRead: boolean
  sentBy: string | null
  replyToId: string | null
  replyTo?: Message | null
  createdAt: string
  updatedAt: string
}

export interface MessageMetadata {
  // For sticker
  stickerId?: string
  packageId?: string

  // For location
  latitude?: number
  longitude?: number
  address?: string

  // For file
  fileName?: string
  fileSize?: number

  // For flex
  flexContent?: object

  // For image/video
  previewUrl?: string
  duration?: number
}

// Tag types
export interface UserTag {
  id: string
  name: string
  color: string
  description: string | null
  isAuto: boolean
  sortOrder: number
}

export interface UserTagAssignment {
  id: string
  userId: string
  tagId: string
  assignedBy: string | null
  isAuto: boolean
  createdAt: string
  tag: UserTag
}

// Auto tag rule types
export type AutoTagTriggerType =
  | 'on_follow'
  | 'on_message'
  | 'on_order'
  | 'on_tier_upgrade'
  | 'on_points_milestone'
  | 'on_video_call'
  | 'on_referral'
  | 'on_inactive'
  | 'on_birthday'

export interface AutoTagCondition {
  field: string
  operator: 'equals' | 'contains' | 'greater_than' | 'less_than' | 'in' | 'not_in'
  value: string | number | string[]
}

export interface AutoTagRule {
  id: string
  tagId: string
  ruleName?: string
  triggerType: AutoTagTriggerType
  conditions: AutoTagCondition[]
  isActive: boolean
  priority: number
  tag?: UserTag
}

// API Response types
export interface PaginatedResponse<T> {
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
    cursor?: string
  }
}

export interface ApiError {
  message: string
  code?: string
  details?: Record<string, string>
}

export interface QuickReplyTemplate {
  id: number
  name: string
  content: string
  category: string | null
  shortcuts: string[]
  variables: string[]
  usage_count: number | null
  last_used_at: Date | null
  created_by: number | null
  created_at: Date | null
  updated_at: Date | null
}

// SSE Event types
export interface SSEEvent {
  type: 'new_message' | 'conversation_update' | 'typing' | 'read_receipt' | 'assignment_change' | 'assignees_updated' | 'ping'
  data: unknown
  timestamp: number
}

export interface NewMessageEvent {
  conversationId: string
  message: Message
}

export interface ConversationUpdateEvent {
  conversationId: string
  changes: Partial<Conversation>
}

export interface TypingEvent {
  conversationId: string
  userId: string
  userName: string
  isTyping: boolean
}

export interface ReadReceiptEvent {
  conversationId: string
  messageIds: string[]
  readBy: string
  readAt: string
}

export interface AssigneesUpdatedEvent {
  conversationId: string
  action: 'add' | 'remove'
  assignees?: AdminUser[]
  adminIds?: string[]
}

// Activity Log types
export type ActivityLogType =
  | 'auth'
  | 'user'
  | 'admin'
  | 'data'
  | 'consent'
  | 'message'
  | 'order'
  | 'pharmacy'
  | 'ai'
  | 'api'
  | 'system'

export type ActivityAction =
  | 'create'
  | 'read'
  | 'update'
  | 'delete'
  | 'login'
  | 'logout'
  | 'export'
  | 'send'
  | 'approve'
  | 'reject'

export interface ActivityLog {
  id: string
  logType: ActivityLogType
  action: ActivityAction
  description: string | null
  userId: number | null
  userName: string | null
  adminId: number | null
  adminName: string | null
  entityType: string | null
  entityId: number | null
  oldValue: Record<string, unknown> | null
  newValue: Record<string, unknown> | null
  ipAddress: string | null
  createdAt: string
}
