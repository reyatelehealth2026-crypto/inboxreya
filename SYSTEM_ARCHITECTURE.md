# System Architecture - LINE Telepharmacy CRM

> **เอกสารสถาปัตยกรรมระบบ** สำหรับ LINE Telepharmacy CRM Platform  
> รวบรวมแผนผังการทำงาน ข้อมูล API และ Best Practices สำหรับการพัฒนาระบบใหม่

---

## สารบัญ

1. [ภาพรวมสถาปัตยกรรมระบบ](#1-ภาพรวมสถาปัตยกรรมระบบ-high-level-architecture)
2. [Core PHP Classes](#2-core-php-classes-re-yaclasses)
3. [Webhook Flow](#3-webhook-flow---message-processing)
4. [Next.js Inbox Architecture](#4-nextjs-inbox-architecture)
5. [Real-time Communication](#5-real-time-communication)
6. [Database Schema](#6-database-schema-overview)
7. [Key Files Reference](#7-key-files-reference)
8. [API Reference](#8-api-reference)
9. [Best Practices](#9-best-practices-for-new-development)
10. [Development Workflow](#10-development-workflow)

---

## 1. ภาพรวมสถาปัตยกรรมระบบ (High-Level Architecture)

```mermaid
flowchart TB
    subgraph clients [Client Layer]
        LINE[LINE App LIFF]
        WEB[Web Browser]
        ADMIN[Admin Panel Next.js]
    end

    subgraph entrypoints [Entry Points]
        LIFF[/liff/index.php]
        LANDING[/index.php]
        WEBHOOK[/webhook.php]
        NEXTAPI[Next.js API Routes]
    end

    subgraph services [Service Layer]
        PHP_API[PHP API /api/]
        CLASSES[PHP Classes /classes/]
        HOOKS[React Hooks]
    end

    subgraph data [Data Layer]
        PRISMA[Prisma ORM]
        MYSQL[(MySQL Database)]
    end

    subgraph external [External Services]
        LINE_API[LINE Messaging API]
        GEMINI[Google Gemini AI]
        PUSHER[Pusher Real-time]
        TELEGRAM[Telegram Bot]
    end

    LINE --> LIFF
    LINE --> WEBHOOK
    WEB --> LANDING
    ADMIN --> NEXTAPI

    LIFF --> PHP_API
    LANDING --> PHP_API
    WEBHOOK --> CLASSES
    NEXTAPI --> HOOKS
    NEXTAPI --> PHP_API

    HOOKS --> PRISMA
    PHP_API --> CLASSES
    CLASSES --> MYSQL
    PRISMA --> MYSQL

    CLASSES --> LINE_API
    CLASSES --> GEMINI
    CLASSES --> TELEGRAM
    NEXTAPI --> PUSHER
    NEXTAPI --> LINE_API
```

### Technology Stack

| Layer | Technology | Version |
|-------|------------|---------|
| **Frontend** | Next.js, React, TypeScript | 14+ |
| **Backend (Legacy)** | PHP | 8.0+ |
| **Database** | MySQL / MariaDB | 5.7+ / 10.2+ |
| **ORM** | Prisma | Latest |
| **AI** | Google Gemini AI | v2.0-flash |
| **Real-time** | Pusher | Latest |
| **Messaging** | LINE Messaging API | v2 |

---

## 2. Core PHP Classes (re-ya/classes/)

### 2.1 LineAPI.php - LINE Messaging

```mermaid
classDiagram
    class LineAPI {
        -string channelAccessToken
        -string channelSecret
        +replyMessage(token, messages) ฟรี
        +pushMessage(userId, messages) นับ quota
        +broadcastMessage(messages)
        +multicastMessage(userIds, messages)
        +getProfile(userId)
        +getMessageContent(messageId)
        +createRichMenu(data)
        +validateSignature(body, signature)
        +markAsRead(chatId)
    }
```

**Key Points:**
- `replyMessage()` = ฟรี (ต้องใช้ภายใน 30 วินาทีหลังจากได้รับ webhook event)
- `pushMessage()` = นับ quota (ใช้เมื่อ reply token หมดอายุ)
- ใช้ `sendMessageWithFallback()` เพื่อ auto-fallback จาก reply ไป push

**Location:** `re-ya/classes/LineAPI.php`

### 2.2 BusinessBot.php - Main Business Logic

```mermaid
stateDiagram-v2
    [*] --> processMessage
    processMessage --> CheckAutoReply
    CheckAutoReply --> AutoReplyMatch: มี keyword match
    CheckAutoReply --> CheckBotMode: ไม่มี match
    
    AutoReplyMatch --> SendAutoReply
    SendAutoReply --> [*]
    
    CheckBotMode --> ShopMode: MODE_SHOP
    CheckBotMode --> GeneralMode: MODE_GENERAL
    CheckBotMode --> AutoReplyOnly: MODE_AUTO_REPLY_ONLY
    
    ShopMode --> ShowMainMenu
    ShopMode --> ShowCategories
    ShopMode --> HandleCart
    ShopMode --> StartCheckout
    
    GeneralMode --> ShowMainMenu
    AutoReplyOnly --> [*]
```

**Bot Modes:**
- `MODE_SHOP` - Full e-commerce (ร้านค้า + ตะกร้า + checkout)
- `MODE_GENERAL` - General messaging (ไม่มี shop)
- `MODE_AUTO_REPLY_ONLY` - Auto-reply เท่านั้น

**Location:** `re-ya/classes/BusinessBot.php`

### 2.3 InboxService.php - Chat Inbox

```mermaid
flowchart LR
    subgraph Filters
        STATUS[Status Filter]
        TAGS[Tags Filter]
        ASSIGNEES[Assignee Filter]
        DATE[Date Range]
        SEARCH[Search Query]
    end

    subgraph Methods
        GET_CONV[getConversations]
        GET_MSG[getMessages]
        POLL[pollUpdates]
        ASSIGN[assignConversation]
        MARK_READ[markAsRead]
    end

    Filters --> GET_CONV
    GET_CONV --> PaginatedList
    GET_MSG --> MessagesCursor
    POLL --> NewMessages
    ASSIGN --> MultiAssignee
```

**Features:**
- Cursor-based pagination สำหรับ performance
- Multi-assignee support (หลายคนรับผิดชอบได้)
- Real-time polling สำหรับ messages ใหม่

**Location:** `re-ya/classes/InboxService.php`

### 2.4 LoyaltyPoints.php - Points System

```mermaid
flowchart TB
    ORDER[Order Completed] --> CALC[calculatePoints]
    CALC --> TIER{Check Tier}
    TIER -->|Bronze 1x| POINTS
    TIER -->|Silver 1.25x| POINTS
    TIER -->|Gold 1.5x| POINTS
    TIER -->|Platinum 2x| POINTS
    POINTS --> ADD[addPoints]
    ADD --> DB[(points_transactions)]
    
    USER[User Request] --> REDEEM[redeemReward]
    REDEEM --> CHECK{Check Balance}
    CHECK -->|Enough| DEDUCT[deductPoints]
    CHECK -->|Not Enough| ERROR[Error]
    DEDUCT --> CODE[Generate Code]
    CODE --> DB2[(redemptions)]
```

**Tier Structure:**
- Bronze: 0 points, 1.0x multiplier
- Silver: 500+ points, 1.25x multiplier
- Gold: 2,000+ points, 1.5x multiplier
- Platinum: 5,000+ points, 2.0x multiplier

**Location:** `re-ya/classes/LoyaltyPoints.php`

### 2.5 GeminiAI.php - AI Integration

```mermaid
flowchart LR
    REQUEST[AI Request] --> TRY1[gemini-2.0-flash]
    TRY1 -->|Error| TRY2[gemini-1.5-flash]
    TRY2 -->|Error| TRY3[gemini-1.5-pro]
    TRY3 -->|Error| TRY4[gemini-pro]
    TRY1 -->|Success| RESPONSE
    TRY2 -->|Success| RESPONSE
    TRY3 -->|Success| RESPONSE
    TRY4 -->|Success| RESPONSE
```

**Methods:**
- `generateBroadcast()` - สร้าง broadcast messages
- `makeRequest()` - Low-level API call
- Model fallback chain สำหรับ reliability

**Location:** `re-ya/classes/GeminiAI.php`

---

## 3. Webhook Flow - Message Processing

```mermaid
sequenceDiagram
    participant LINE as LINE Platform
    participant WEBHOOK as webhook.php
    participant LINEAPI as LineAPI
    participant BOT as BusinessBot
    participant DB as MySQL
    participant NEXT as Next.js API
    participant PUSHER as Pusher

    LINE->>WEBHOOK: POST /webhook.php?account=1
    WEBHOOK->>LINEAPI: validateSignature()
    
    alt Signature Valid
        WEBHOOK->>DB: Save incoming message
        WEBHOOK->>BOT: processMessage()
        BOT->>BOT: Check auto-reply rules
        BOT->>DB: Get user state
        BOT->>LINEAPI: replyMessage() or pushMessage()
        WEBHOOK->>NEXT: POST /api/inbox/webhook-notify
        NEXT->>PUSHER: Trigger NEW_MESSAGE event
    else Invalid
        WEBHOOK-->>LINE: 400 Invalid signature
    end
```

**Webhook Handler:** `re-ya/webhook.php`

**Key Features:**
- Multi-account support (ตรวจสอบ account จาก query parameter หรือ signature)
- Auto-fallback จาก reply token ไป push message
- Real-time notification ไปยัง Next.js inbox

---

## 4. Next.js Inbox Architecture

### 4.1 Component Structure

```mermaid
flowchart TB
    subgraph Pages
        INBOX[InboxPageClient.tsx]
    end

    subgraph Components
        CONV_LIST[ConversationList]
        CHAT_PANEL[ChatPanel]
        CUST_PROFILE[CustomerProfile]
        FILTER_BAR[FilterBar]
    end

    subgraph Hooks
        USE_CONV[useConversations]
        USE_MSG[useMessages]
        USE_PUSHER[usePusher]
        USE_AI[useAI]
    end

    subgraph Stores
        INBOX_STORE[inbox.ts Zustand]
        CHAT_STORE[chat.ts]
    end

    INBOX --> CONV_LIST
    INBOX --> CHAT_PANEL
    INBOX --> CUST_PROFILE
    INBOX --> FILTER_BAR

    CONV_LIST --> USE_CONV
    CHAT_PANEL --> USE_MSG
    CHAT_PANEL --> USE_PUSHER
    CHAT_PANEL --> USE_AI

    USE_CONV --> INBOX_STORE
    USE_MSG --> CHAT_STORE
```

### 4.2 PHP-Next.js Integration

```mermaid
flowchart TB
    subgraph NextJS [Next.js]
        API_ROUTE[API Route]
        PHP_BRIDGE[php-bridge.ts]
        LINE_LIB[line-api.ts]
        PRISMA[Prisma ORM]
    end

    subgraph PHP [PHP Backend]
        PHP_API[/api/inbox-v2.php]
        PHP_LINE[LineAPI.php]
    end

    subgraph External
        LINE_API[LINE Messaging API]
        DB[(MySQL)]
    end

    API_ROUTE -->|Option 1| LINE_LIB
    API_ROUTE -->|Option 2| PHP_BRIDGE
    
    LINE_LIB -->|Direct| LINE_API
    PHP_BRIDGE --> PHP_API
    PHP_API --> PHP_LINE
    PHP_LINE --> LINE_API

    PRISMA --> DB
    PHP_API --> DB
```

**Integration Options:**
1. **Direct LINE API** (`src/lib/line-api.ts`) - Next.js เรียก LINE API ตรงๆ
2. **PHP Bridge** (`src/lib/php-bridge.ts`) - Next.js เรียก PHP API

**When to use:**
- **Direct LINE API**: เมื่อต้องการควบคุมการส่ง message โดยตรง
- **PHP Bridge**: เมื่อต้องการใช้ business logic จาก PHP (เช่น auto-reply, points calculation)

---

## 5. Real-time Communication

```mermaid
sequenceDiagram
    participant USER as LINE User
    participant PHP as PHP Webhook
    participant NEXT as Next.js API
    participant PUSHER as Pusher
    participant ADMIN as Admin Browser

    USER->>PHP: Send message via LINE
    PHP->>PHP: Save to database
    PHP->>NEXT: POST /webhook-notify
    NEXT->>PUSHER: trigger NEW_MESSAGE
    PUSHER->>ADMIN: Push event
    ADMIN->>ADMIN: React Query invalidate
    ADMIN->>ADMIN: UI Update
```

**Events:**
- `NEW_MESSAGE` - ข้อความใหม่
- `CONVERSATION_UPDATED` - conversation เปลี่ยนแปลง
- `TYPING_START` / `TYPING_STOP` - typing indicator

**Channels:**
- `inbox` - Global inbox updates
- `conversation-{id}` - Per-conversation updates
- `private-user-{id}` - User-specific notifications

**Implementation:**
- Server: `src/lib/pusher.ts`
- Client: `src/hooks/use-pusher.ts`

---

## 6. Database Schema Overview

```mermaid
erDiagram
    line_accounts ||--o{ users : has
    line_accounts ||--o{ messages : contains
    users ||--o{ messages : sends
    users ||--o{ orders : places
    users ||--o{ points_transactions : earns
    users ||--o{ health_profiles : has
    
    admin_users ||--o{ conversation_assignments : assigns
    users ||--o{ conversation_assignments : assigned_to
    users ||--o{ user_notes : has
    
    orders ||--o{ order_items : contains
    products ||--o{ order_items : in
    
    rewards ||--o{ redemptions : redeemed_as
    users ||--o{ redemptions : redeems

    line_accounts {
        int id PK
        string channel_id
        string channel_secret
        string channel_access_token
        string bot_mode
    }

    users {
        int id PK
        string line_user_id UK
        string display_name
        string status
        int line_account_id FK
    }

    messages {
        int id PK
        int line_account_id FK
        string line_user_id
        text content
        string message_type
        string direction
        datetime created_at
    }
```

**Key Tables:**
- `line_accounts` - Multi-bot LINE OA configurations
- `users` / `line_users` - Customer data
- `messages` - Chat history
- `conversation_assignments` - Multi-assignee support
- `user_notes` - Internal staff notes
- `tags` / `tag_assignments` - Tagging system

**Schema Location:** `prisma/schema.prisma`

---

## 7. Key Files Reference

| Component | PHP (re-ya) | Next.js (src) |
|-----------|-------------|---------------|
| **Webhook** | `webhook.php` | `/api/inbox/webhook-notify/route.ts` |
| **Inbox API** | `api/inbox-v2.php` | `/api/inbox/*/route.ts` |
| **LINE API** | `classes/LineAPI.php` | `lib/line-api.ts` |
| **Business Logic** | `classes/BusinessBot.php` | - |
| **Points** | `classes/LoyaltyPoints.php` | - |
| **AI** | `classes/GeminiAI.php` | `lib/ai.ts` |
| **PHP Bridge** | - | `lib/php-bridge.ts` |
| **Real-time** | `websocket-server.js` | `lib/pusher.ts` |
| **Database** | PDO | `lib/prisma.ts` |
| **Auth** | Session-based | `lib/auth.ts` (NextAuth.js) |

---

## 8. API Reference

### 8.1 PHP APIs (`re-ya/api/`)

#### Inbox APIs

**`inbox-v2.php`**
- `action=get_conversations` - List conversations with filters
- `action=get_messages` - Get messages for a conversation
- `action=send_message` - Send message via LINE
- `action=assign` - Assign conversation to admin(s)
- `action=update_customer_info` - Update customer profile
- `action=search` - Search conversations/messages

**`messages.php`**
- `action=list` - List messages
- `action=send` - Send message

#### Member APIs

**`member.php`**
- `action=register` - Register new member
- `action=profile` - Get member profile
- `action=update` - Update profile

**`health-profile.php`**
- `action=get` - Get health profile
- `action=update` - Update health profile

#### Shop APIs

**`shop-products.php`**
- `action=list` - List products
- `action=detail` - Product details
- `action=search` - Search products

**`checkout.php`**
- `action=add_to_cart` - Add to cart
- `action=get_cart` - Get cart
- `action=create_order` - Create order

**`orders.php`**
- `action=my_orders` - Get user orders
- `action=order_detail` - Get order details

#### Points & Rewards APIs

**`points.php`**
- `action=balance` - Get points balance
- `action=history` - Points history

**`rewards.php`**
- `action=list` - Available rewards
- `action=redeem` - Redeem reward

#### AI APIs

**`ai-chat.php`**
- `action=chat` - AI chat message

**`pharmacy-ai.php`**
- `action=consult` - Pharmacy consultation
- `action=check_interaction` - Drug interaction check

### 8.2 Next.js APIs (`src/app/api/inbox/`)

#### Conversations

**`GET /api/inbox/conversations`**
```typescript
// Query Parameters
{
  page?: number          // Default: 1
  limit?: number         // Default: 100, Max: 2000
  status?: string        // 'all' | 'open' | 'resolved' | 'closed'
  tagId?: number        // Filter by single tag
  tagIds?: string       // Comma-separated tag IDs
  search?: string        // Search by name, contact, message content
  assignedTo?: number    // Filter by assignee
  assignedToIds?: string // Comma-separated assignee IDs
  unreadOnly?: boolean   // Show only unread
  startDate?: string     // ISO date string
  endDate?: string       // ISO date string
  cursor?: number        // Cursor for pagination
}

// Response
{
  conversations: Conversation[]
  pagination: {
    page: number
    limit: number
    total: number
    totalPages: number
    hasMore: boolean
    nextCursor?: number
  }
}
```

**`GET /api/inbox/conversations/[id]`**
- Get single conversation details

**`POST /api/inbox/conversations/[id]/assign`**
```typescript
// Body
{
  assigneeIds: number[]  // Array of admin user IDs
}

// Response
{
  success: boolean
  message: string
}
```

**`POST /api/inbox/conversations/[id]/unassign`**
- Unassign conversation from current assignees

#### Messages

**`GET /api/inbox/messages`**
```typescript
// Query Parameters
{
  userId: number         // Required: LINE user ID
  page?: number          // Default: 1
  limit?: number         // Default: 50, Max: 200
  cursor?: number        // Cursor for pagination
  startDate?: string     // ISO date string
  endDate?: string       // ISO date string
  markRead?: boolean     // Auto-mark as read
}

// Response
{
  messages: Message[]
  pagination: {
    page: number
    limit: number
    total: number
    hasMore: boolean
    nextCursor?: number
  }
}
```

**`POST /api/inbox/messages`**
```typescript
// Body
{
  userId: number         // Required: LINE user ID
  content: string        // Required: Message content
  type?: string         // 'text' | 'image' | 'flex'
  metadata?: object      // Optional metadata
}

// Response
{
  success: boolean
  message: Message
}
```

**`POST /api/inbox/messages/[id]/read`**
- Mark message as read

**`POST /api/inbox/messages/read`**
```typescript
// Body
{
  userId: number         // Required: LINE user ID
  messageIds?: number[]  // Optional: Specific message IDs
}
```

#### Customers

**`GET /api/inbox/customers/[id]`**
- Get customer profile with orders, points, notes

**`PATCH /api/inbox/customers/[id]`**
```typescript
// Body
{
  displayName?: string
  firstName?: string
  lastName?: string
  phone?: string
  email?: string
  // ... other fields
}
```

#### AI

**`POST /api/inbox/ai/reply`**
```typescript
// Body
{
  userId: number          // Required: LINE user ID
  tone?: string           // Optional: 'friendly' | 'professional' | 'casual'
}

// Response
{
  reply: string           // AI-generated reply
  confidence?: number     // Optional confidence score
}

// Example
const response = await fetch('/api/inbox/ai/reply', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    userId: 123,
    tone: 'friendly',
  }),
})
```

**`POST /api/inbox/ai/draft`**
```typescript
// Body
{
  userId: number
  context?: string        // Optional context for draft
  tone?: string
}

// Response
{
  draft: string
}
```

**`POST /api/inbox/ai/analyze`**
```typescript
// Body
{
  messageId: number       // Message containing image
  userId: number
}

// Response
{
  analysis: string        // AI analysis of image
  detectedObjects?: string[]
}
```

#### Tags

**`GET /api/inbox/tags`**
```typescript
// Response
{
  data: Array<{
    id: string
    name: string
    color: string
    description?: string
    isAuto: boolean
    sortOrder: number
    usageCount: number
  }>
}

// Example
const response = await fetch('/api/inbox/tags')
const { data } = await response.json()
```

**`POST /api/inbox/tags`**
```typescript
// Body
{
  name: string            // Required: Tag name
  color?: string         // Optional: Hex color (default: '#3B82F6')
  description?: string    // Optional: Tag description
}

// Response
{
  id: string
  name: string
  color: string
  description?: string
  isAuto: boolean
  sortOrder: number
}
```

**`PUT /api/inbox/tags`**
```typescript
// Body
{
  userId: number          // Required: LINE user ID
  tagId: number          // Required: Tag ID
  action: 'assign' | 'remove'  // Required: Action to perform
}

// Response
{
  success: boolean
  message: string
}
```

**`POST /api/inbox/tags/[id]/assign`**
```typescript
// Body
{
  userId: number
}

// Response
{
  success: boolean
}
```

**`DELETE /api/inbox/tags/[id]/assign`**
```typescript
// Query Parameters
{
  userId: number         // Required: LINE user ID
}

// Response
{
  success: boolean
}
```

#### Assignments

**`GET /api/inbox/assignments`**
```typescript
// Query Parameters
{
  conversationId?: number // Optional: Filter by conversation
  assigneeId?: number     // Optional: Filter by assignee
}

// Response
{
  assignments: Array<{
    id: number
    conversationId: number
    assigneeId: number
    assignedAt: string
    assignee: {
      id: number
      username: string
      email: string
    }
  }>
}
```

**`POST /api/inbox/assignments`**
```typescript
// Body
{
  conversationId: number  // Required: Conversation ID
  assigneeIds: number[]  // Required: Array of admin user IDs
}

// Response
{
  success: boolean
  message: string
  assignments: Array<{
    id: number
    conversationId: number
    assigneeId: number
  }>
}
```

#### Notes

**`GET /api/inbox/notes?userId={id}`**
```typescript
// Query Parameters
{
  userId: number         // Required: LINE user ID
}

// Response
{
  notes: Array<{
    id: number
    userId: number
    content: string
    isPrivate: boolean
    createdBy: number
    createdAt: string
    updatedAt: string
  }>
}
```

**`POST /api/inbox/notes`**
```typescript
// Body
{
  userId: number          // Required: LINE user ID
  content: string        // Required: Note content
  isPrivate?: boolean    // Optional: Default false
}

// Response
{
  id: number
  userId: number
  content: string
  isPrivate: boolean
  createdBy: number
  createdAt: string
}
```

**`PATCH /api/inbox/notes/[id]`**
```typescript
// Body
{
  content?: string       // Optional: Updated content
  isPrivate?: boolean    // Optional: Updated privacy
}

// Response
{
  id: number
  content: string
  isPrivate: boolean
  updatedAt: string
}
```

**`DELETE /api/inbox/notes/[id]`**
```typescript
// Response
{
  success: boolean
  message: string
}
```

#### Upload

**`POST /api/inbox/upload`**
```typescript
// FormData
{
  file: File              // Required: File to upload
  userId: number          // Required: LINE user ID
  type?: 'image' | 'file' // Optional: File type (default: 'image')
}

// Response
{
  success: boolean
  url: string            // Public URL of uploaded file
  messageId?: number     // Optional: Message ID if sent to LINE
  mediaUrl?: string       // Optional: LINE media URL
}

// Example
const formData = new FormData()
formData.append('file', fileInput.files[0])
formData.append('userId', '123')
formData.append('type', 'image')

const response = await fetch('/api/inbox/upload', {
  method: 'POST',
  body: formData,
})
const { url, messageId } = await response.json()
```

#### Webhook Notify

**`POST /api/inbox/webhook-notify`**
```typescript
// Body (from PHP webhook)
{
  event: 'NEW_MESSAGE' | 'CONVERSATION_UPDATED'
  data: {
    userId: number
    messageId?: number
    conversationId?: number
  }
}

// Headers
{
  'X-Internal-Request': 'true'
  'Authorization': `Bearer ${INTERNAL_API_SECRET}`
}
```

---

## 9. Best Practices for New Development

### 9.1 Message Sending

**PHP:**
```php
// Always use sendMessageWithFallback for auto-fallback
$result = sendMessageWithFallback(
    $line, 
    $replyToken, 
    $userId, 
    $messages,
    $db
);
```

**Next.js:**
```typescript
// Use line-api.ts with fallback logic
import { sendLineMessage } from '@/lib/line-api'

// Prefer reply token (free) with push fallback
const result = await sendLineMessage({
  userId: lineUserId,
  message: content,
  replyToken: replyToken, // Optional, if available
})
```

### 9.2 Real-time Updates

```typescript
// Always trigger Pusher after data changes
import { broadcastNewMessage } from '@/lib/pusher'

// After saving message
await broadcastNewMessage({
  userId: lineUserId,
  messageId: message.id,
  conversationId: conversationId,
})

// React Query will auto-invalidate and refetch
```

### 9.3 Database Access

**Next.js:**
```typescript
// Use Prisma for type-safe queries
import prisma from '@/lib/prisma'

const conversations = await prisma.lineUser.findMany({
  where: { lineAccountId: accountId },
  include: { messages: true },
})
```

**PHP:**
```php
// Use PDO prepared statements
$stmt = $db->prepare("SELECT * FROM users WHERE line_account_id = ?");
$stmt->execute([$lineAccountId]);
$users = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

### 9.4 Authentication

**Admin (Next.js):**
```typescript
// Use NextAuth.js session
import { auth } from '@/lib/auth'

const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}

// Check role
if (session.user.role !== 'super_admin') {
  // Restrict by lineAccountId
}
```

**Internal API Calls:**
```typescript
// Use X-Internal-Request header
const response = await fetch(url, {
  headers: {
    'X-Internal-Request': 'true',
    'Authorization': `Bearer ${process.env.INTERNAL_API_SECRET}`,
  },
})
```

### 9.5 Error Handling

```typescript
// Always handle errors gracefully
try {
  const result = await someOperation()
  return NextResponse.json({ success: true, data: result })
} catch (error) {
  console.error('Operation failed:', error)
  return NextResponse.json(
    { 
      success: false, 
      error: error instanceof Error ? error.message : 'Unknown error' 
    },
    { status: 500 }
  )
}
```

### 9.6 Performance Optimization

- **Cursor-based pagination** for large datasets
- **Virtual scrolling** for message lists (TanStack Virtual)
- **React Query caching** with appropriate stale times
- **Optimistic updates** for better UX
- **Database indexes** on frequently queried columns

---

## 10. Development Workflow

```mermaid
flowchart LR
    subgraph Development
        CODE[Write Code]
        TEST[Test Locally]
        LINT[Lint Check]
    end

    subgraph Integration
        PHP_TEST[Test PHP API]
        NEXT_TEST[Test Next.js]
        PUSHER_TEST[Test Real-time]
    end

    subgraph Production
        DEPLOY[Deploy]
        MONITOR[Monitor Logs]
    end

    CODE --> TEST
    TEST --> LINT
    LINT --> PHP_TEST
    PHP_TEST --> NEXT_TEST
    NEXT_TEST --> PUSHER_TEST
    PUSHER_TEST --> DEPLOY
    DEPLOY --> MONITOR
```

### Development Checklist

1. ✅ Write code with TypeScript types
2. ✅ Run linter (`npm run lint`)
3. ✅ Test PHP API endpoints
4. ✅ Test Next.js API routes
5. ✅ Test real-time updates (Pusher)
6. ✅ Test authentication & authorization
7. ✅ Test error handling
8. ✅ Deploy to staging
9. ✅ Monitor logs and errors

---

## 11. Migration Strategy

ระบบนี้ออกแบบมาเพื่อให้สามารถ migrate จาก PHP ไปยัง Next.js ได้ทีละส่วน โดยใช้ `php-bridge.ts` เป็นตัวเชื่อมระหว่างสองระบบ

### Migration Path

1. **Phase 1: Inbox UI** (Current)
   - Next.js inbox interface
   - PHP backend for business logic
   - PHP bridge for communication

2. **Phase 2: API Migration**
   - Migrate inbox APIs to Next.js
   - Keep PHP for complex business logic
   - Gradual migration of endpoints

3. **Phase 3: Full Migration**
   - Complete Next.js implementation
   - PHP as legacy support only
   - Full TypeScript type safety

### PHP Bridge Usage

```typescript
// When to use PHP Bridge:
// 1. Complex business logic still in PHP
// 2. Legacy features not yet migrated
// 3. Shared database operations

import { callPhpApi } from '@/lib/php-bridge'

const result = await callPhpApi('/api/inbox-v2.php', {
  method: 'POST',
  body: JSON.stringify({
    action: 'send_message',
    user_id: userId,
    content: message,
  }),
})
```

---

## 12. Environment Variables

### Required Environment Variables

```env
# Database
DATABASE_URL="mysql://user:password@localhost:3306/dbname"

# Authentication
AUTH_SECRET="your-nextauth-secret"
INTERNAL_API_SECRET="your-internal-api-secret"

# PHP Backend
PHP_API_URL="https://your-php-backend.com"

# LINE API
LINE_CHANNEL_ACCESS_TOKEN="your-channel-access-token"
LINE_CHANNEL_SECRET="your-channel-secret"

# Pusher (Real-time)
PUSHER_APP_ID="your-pusher-app-id"
PUSHER_KEY="your-pusher-key"
PUSHER_SECRET="your-pusher-secret"
PUSHER_CLUSTER="your-pusher-cluster"

# AI
GEMINI_API_KEY="your-gemini-api-key"
GEMINI_MODEL="gemini-2.0-flash-exp"
```

---

## 13. Troubleshooting

### Common Issues

**Webhook not receiving events:**
- Verify webhook URL is HTTPS
- Check LINE channel secret matches
- Verify webhook.php signature validation

**Messages not sending:**
- Check channel access token validity
- Verify LINE API quota
- Check error logs in database

**Real-time updates not working:**
- Verify Pusher credentials
- Check webhook-notify endpoint
- Verify client subscription to channels

**Database connection errors:**
- Check DATABASE_URL format
- Verify database server is running
- Check Prisma schema matches database

---

## 14. Additional Resources

- **PHP Documentation**: `re-ya/docs/`
- **Next.js Documentation**: [Next.js Docs](https://nextjs.org/docs)
- **LINE API Reference**: [LINE Developers](https://developers.line.biz/)
- **Prisma Documentation**: [Prisma Docs](https://www.prisma.io/docs)
- **Pusher Documentation**: [Pusher Docs](https://pusher.com/docs)

---

**Last Updated:** January 2026  
**Version:** 1.0  
**Maintained by:** Development Team
