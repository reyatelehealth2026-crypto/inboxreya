# AI Coding Assistant Guidelines

> **Universal guidelines for AI-assisted development on this project.**
> Compatible with: Claude, GPT, Gemini, Cursor, Windsurf, Copilot, and other AI coding assistants.

---

## 📋 Project Overview

**Project:** LINE Telepharmacy CRM Platform
**Type:** Multi-tenant SaaS for Thai Pharmacy Businesses
**Architecture:** PHP Backend (re-ya) + Next.js Frontend (inboxreya)

### Tech Stack
| Layer | Technology |
|-------|------------|
| Frontend | Next.js 15, React 19, TypeScript, Tailwind CSS, shadcn/ui |
| State | React Query v5, Zustand |
| Backend | PHP 8.0+, PDO, REST APIs |
| Database | MySQL/MariaDB (228 tables), Prisma ORM |
| Real-time | Pusher WebSockets |
| AI | Google Gemini API |
| Integrations | LINE Messaging API, Telegram Bot API |

### Directory Structure
```
project/
├── inboxreya/              # Next.js 15 Frontend
│   ├── src/
│   │   ├── app/           # App Router (pages, layouts, API routes)
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom React hooks
│   │   ├── lib/           # Utilities and helpers
│   │   └── types/         # TypeScript type definitions
│   └── prisma/            # Database schema
│
├── re-ya/                  # PHP 8+ Backend
│   ├── api/               # REST API endpoints
│   ├── classes/           # Business logic services
│   ├── cron/              # Background jobs
│   └── webhook.php        # LINE webhook handler
│
└── PRPs/                   # Project documentation
    ├── INITIAL.md         # Feature specifications
    ├── คู่มือ.md           # System architecture guide
    └── templates/         # PRP templates
```

---

## 🔄 Project Awareness & Context

### Before Starting Any Task:

1. **Read project documentation:**
   - `PRPs/คู่มือ.md` - Complete system architecture (228 tables, all APIs, user flows)
   - `INITIAL.md` - Current feature requirements
   - This file (`CLAUDE.md`) - Coding guidelines

2. **Understand the codebase:**
   - Check existing patterns before creating new ones
   - Review similar components/functions for consistency
   - Verify file paths and module names exist before referencing

3. **Use consistent patterns:**
   - Follow existing naming conventions
   - Match code style of surrounding files
   - Reuse existing utilities and helpers

---

## 🧱 Code Structure & Modularity

### File Organization

**Frontend (inboxreya):**
```
src/
├── app/
│   ├── inbox/
│   │   ├── page.tsx           # Page component (Server Component)
│   │   ├── InboxPageClient.tsx # Client component ('use client')
│   │   └── layout.tsx         # Layout wrapper
│   └── api/
│       └── inbox/
│           └── conversations/
│               └── route.ts   # API route handler
├── components/
│   ├── inbox/                 # Feature-specific components
│   │   ├── ConversationList.tsx
│   │   └── MessagePanel.tsx
│   └── ui/                    # Reusable UI components (shadcn/ui)
├── hooks/
│   └── useConversations.ts    # React Query hooks
├── lib/
│   └── api.ts                 # API client utilities
└── types/
    └── inbox.ts               # TypeScript interfaces
```

**Backend (re-ya):**
```
api/
├── inbox-v2.php               # Main inbox API
├── messages.php               # Message operations
└── checkout.php               # Order processing

classes/
├── InboxService.php           # Business logic
├── LineAPI.php                # LINE integration
└── GeminiChat.php             # AI integration
```

### File Size Limits

- **Maximum 500 lines per file** - If approaching this limit, refactor into modules
- **Maximum 50 lines per function** - Break complex logic into smaller functions
- **Maximum 10 parameters per function** - Use objects/interfaces for many params

### Import Conventions

```typescript
// Frontend - Use path aliases
import { Button } from '@/components/ui/button'
import { useConversations } from '@/hooks/useConversations'
import type { Conversation } from '@/types/inbox'

// Prefer named exports
export function ConversationList() { ... }
export type { Conversation }
```

```php
// Backend - Use require_once with absolute paths
require_once __DIR__ . '/../classes/InboxService.php';
require_once __DIR__ . '/../classes/LineAPI.php';
```

---

## 📝 Coding Standards

### TypeScript/JavaScript (Frontend)

```typescript
// ✅ DO: Use explicit types
interface ConversationProps {
  id: string
  status: 'active' | 'closed' | 'pending'
  lastMessage: string
  updatedAt: Date
}

function ConversationCard({ id, status, lastMessage }: ConversationProps) {
  // ...
}

// ❌ DON'T: Use 'any' type
function ConversationCard(props: any) { ... }

// ✅ DO: Mark client components explicitly
'use client'

import { useState } from 'react'

export function InteractiveComponent() {
  const [state, setState] = useState(false)
  // ...
}

// ✅ DO: Use Zod for runtime validation
import { z } from 'zod'

const ConversationSchema = z.object({
  id: z.string(),
  status: z.enum(['active', 'closed', 'pending']),
  lastMessage: z.string(),
  updatedAt: z.coerce.date(),
})

type Conversation = z.infer<typeof ConversationSchema>

// ✅ DO: Handle loading and error states
function ConversationList() {
  const { data, isLoading, error } = useConversations()

  if (isLoading) return <Skeleton />
  if (error) return <ErrorState error={error} />
  if (!data?.length) return <EmptyState />

  return <List data={data} />
}
```

### PHP (Backend)

```php
<?php
// ✅ DO: Use strict types
declare(strict_types=1);

// ✅ DO: Use type hints
function getConversations(int $limit = 20, int $offset = 0): array
{
    // ...
}

// ✅ DO: Use prepared statements (NEVER concatenate SQL)
$stmt = $pdo->prepare("SELECT * FROM messages WHERE user_id = :userId");
$stmt->execute(['userId' => $userId]);

// ❌ DON'T: Concatenate SQL strings
$query = "SELECT * FROM messages WHERE user_id = " . $userId;

// ✅ DO: Return standardized API responses
function jsonResponse(array $data, int $status = 200): void
{
    http_response_code($status);
    header('Content-Type: application/json');
    echo json_encode([
        'success' => $status < 400,
        'data' => $data,
        'timestamp' => date('c')
    ]);
    exit;
}

// ✅ DO: Handle errors gracefully
try {
    $result = $service->processOrder($orderId);
    jsonResponse(['order' => $result]);
} catch (ValidationException $e) {
    jsonResponse(['error' => $e->getMessage()], 400);
} catch (Exception $e) {
    error_log("Order processing failed: " . $e->getMessage());
    jsonResponse(['error' => 'Internal server error'], 500);
}
```

### CSS/Tailwind

```typescript
// ✅ DO: Use Tailwind utility classes
<button className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600">
  Send
</button>

// ✅ DO: Use cn() helper for conditional classes
import { cn } from '@/lib/utils'

<div className={cn(
  "p-4 rounded-lg",
  isActive && "bg-blue-100 border-blue-500",
  isDisabled && "opacity-50 cursor-not-allowed"
)}>

// ❌ DON'T: Use inline styles
<button style={{ padding: '16px', backgroundColor: 'blue' }}>

// ✅ DO: Mobile-first responsive design
<div className="p-2 md:p-4 lg:p-6">
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
```

---

## 🧪 Testing Requirements

### Test Structure

```
tests/
├── unit/                    # Unit tests
│   ├── hooks/
│   │   └── useConversations.test.ts
│   └── utils/
│       └── formatDate.test.ts
├── integration/             # Integration tests
│   └── api/
│       └── conversations.test.ts
└── e2e/                     # End-to-end tests (Playwright)
    └── inbox.spec.ts
```

### Test Requirements Per Feature

| Test Type | Required Coverage |
|-----------|------------------|
| Happy path | ✅ Always required |
| Edge cases | ✅ Always required |
| Error handling | ✅ Always required |
| Loading states | ✅ For UI components |

### Testing Patterns

```typescript
// ✅ DO: Test with realistic data
describe('useConversations', () => {
  it('fetches conversations successfully', async () => {
    const { result } = renderHook(() => useConversations(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toHaveLength(20)
    expect(result.current.data[0]).toHaveProperty('id')
  })

  it('handles empty response', async () => {
    server.use(
      http.get('/api/conversations', () => HttpResponse.json([]))
    )

    const { result } = renderHook(() => useConversations(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))
    expect(result.current.data).toHaveLength(0)
  })

  it('handles API errors gracefully', async () => {
    server.use(
      http.get('/api/conversations', () =>
        HttpResponse.json({ error: 'Server error' }, { status: 500 })
      )
    )

    const { result } = renderHook(() => useConversations(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))
  })
})
```

### Running Tests

```bash
# Frontend tests
cd inboxreya
npm run test              # Run all tests
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage report

# Type checking
npm run check-types       # TypeScript validation

# Linting
npm run lint              # ESLint
```

---

## 🔐 Security Requirements

### Input Validation

```typescript
// ✅ DO: Validate all API inputs with Zod
import { z } from 'zod'
import { NextResponse } from 'next/server'

const CreateMessageSchema = z.object({
  conversationId: z.string().uuid(),
  content: z.string().min(1).max(5000),
  messageType: z.enum(['text', 'image', 'file']),
})

export async function POST(request: Request) {
  const body = await request.json()

  const result = CreateMessageSchema.safeParse(body)
  if (!result.success) {
    return NextResponse.json(
      { error: 'Validation failed', details: result.error.flatten() },
      { status: 400 }
    )
  }

  // Process validated data
  const { conversationId, content, messageType } = result.data
}
```

### SQL Injection Prevention

```php
// ✅ DO: Always use prepared statements
$stmt = $pdo->prepare("
    SELECT * FROM messages
    WHERE conversation_id = :convId
    AND created_at > :since
");
$stmt->execute([
    'convId' => $conversationId,
    'since' => $sinceDate
]);

// ❌ NEVER: Concatenate user input into SQL
$query = "SELECT * FROM messages WHERE id = " . $_GET['id'];
```

### XSS Prevention

```typescript
// ✅ DO: Sanitize HTML content
import DOMPurify from 'dompurify'

function MessageContent({ html }: { html: string }) {
  return (
    <div
      dangerouslySetInnerHTML={{
        __html: DOMPurify.sanitize(html)
      }}
    />
  )
}

// ✅ DO: Escape text content (React does this automatically)
function MessageText({ text }: { text: string }) {
  return <p>{text}</p>  // Safe - React escapes by default
}
```

```php
// ✅ DO: Escape output in PHP
echo htmlspecialchars($userInput, ENT_QUOTES, 'UTF-8');
```

### Authentication & Authorization

```typescript
// ✅ DO: Verify authentication on all protected routes
import { getServerSession } from 'next-auth'
import { authOptions } from '@/lib/auth'

export async function GET(request: Request) {
  const session = await getServerSession(authOptions)

  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Check authorization
  if (!hasPermission(session.user, 'read:conversations')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Process request
}
```

---

## ⚡ Performance Guidelines

### React Query Caching

```typescript
// ✅ DO: Configure proper cache times
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30 * 1000,      // 30 seconds
      gcTime: 5 * 60 * 1000,     // 5 minutes (formerly cacheTime)
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

// ✅ DO: Use optimistic updates for better UX
const sendMessage = useMutation({
  mutationFn: api.sendMessage,
  onMutate: async (newMessage) => {
    await queryClient.cancelQueries({ queryKey: ['messages'] })
    const previous = queryClient.getQueryData(['messages'])

    queryClient.setQueryData(['messages'], (old) => [...old, newMessage])

    return { previous }
  },
  onError: (err, newMessage, context) => {
    queryClient.setQueryData(['messages'], context.previous)
  },
  onSettled: () => {
    queryClient.invalidateQueries({ queryKey: ['messages'] })
  },
})
```

### Virtual Scrolling for Large Lists

```typescript
// ✅ DO: Use virtual scrolling for 100+ items
import { useVirtualizer } from '@tanstack/react-virtual'

function MessageList({ messages }: { messages: Message[] }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10,
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, position: 'relative' }}>
        {virtualizer.getVirtualItems().map((virtualRow) => (
          <div
            key={virtualRow.key}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${virtualRow.start}px)`,
            }}
          >
            <MessageItem message={messages[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

### Database Query Optimization

```php
// ✅ DO: Use indexes for frequently queried columns
// See: PRPs/production-readiness-enhancement.md for index recommendations

// ✅ DO: Use cursor-based pagination for large datasets
$stmt = $pdo->prepare("
    SELECT * FROM messages
    WHERE conversation_id = :convId
    AND created_at < :cursor
    ORDER BY created_at DESC
    LIMIT :limit
");

// ✅ DO: Select only needed columns
$stmt = $pdo->prepare("
    SELECT id, content, created_at, sender_type
    FROM messages
    WHERE conversation_id = :convId
");

// ❌ DON'T: Use SELECT * in production
$stmt = $pdo->prepare("SELECT * FROM messages");

// ❌ DON'T: Load all data at once
$allMessages = $pdo->query("SELECT * FROM messages")->fetchAll();
```

### Image Optimization

```typescript
// ✅ DO: Use next/image for automatic optimization
import Image from 'next/image'

function Avatar({ src, alt }: { src: string; alt: string }) {
  return (
    <Image
      src={src}
      alt={alt}
      width={40}
      height={40}
      className="rounded-full"
      loading="lazy"
    />
  )
}

// ✅ DO: Use dynamic imports for heavy components
import dynamic from 'next/dynamic'

const ChartComponent = dynamic(() => import('@/components/Chart'), {
  loading: () => <Skeleton className="h-64 w-full" />,
  ssr: false,
})
```

---

## 🌐 Integration Guidelines

### LINE API

```typescript
// ✅ DO: Handle rate limits with exponential backoff
async function sendLineMessage(to: string, message: Message) {
  const maxRetries = 3

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch('https://api.line.me/v2/bot/message/push', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LINE_ACCESS_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ to, messages: [message] }),
      })

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get('Retry-After') || '1')
        await sleep(retryAfter * 1000)
        continue
      }

      if (!response.ok) {
        throw new Error(`LINE API error: ${response.status}`)
      }

      return await response.json()

    } catch (error) {
      if (attempt === maxRetries - 1) throw error
      await sleep(Math.pow(2, attempt) * 1000)
    }
  }
}
```

### Pusher Real-time

```typescript
// ✅ DO: Handle connection state changes
'use client'

import Pusher from 'pusher-js'
import { useEffect, useState } from 'react'

export function usePusher() {
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    const pusher = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
      cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
      authEndpoint: '/api/pusher/auth',
    })

    pusher.connection.bind('connected', () => setIsConnected(true))
    pusher.connection.bind('disconnected', () => setIsConnected(false))
    pusher.connection.bind('error', (err) => console.error('Pusher error:', err))

    return () => pusher.disconnect()
  }, [])

  return { isConnected }
}
```

### PHP-Next.js Bridge

```typescript
// ✅ DO: Use internal API secret for PHP communication
async function callPhpApi(endpoint: string, data: unknown) {
  const response = await fetch(`${PHP_API_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${INTERNAL_API_SECRET}`,
    },
    body: JSON.stringify(data),
  })

  if (!response.ok) {
    throw new Error(`PHP API error: ${response.status}`)
  }

  // ✅ DO: Validate PHP response with Zod
  const json = await response.json()
  return PhpResponseSchema.parse(json)
}
```

---

## 📚 Documentation Standards

### Code Comments

```typescript
// ✅ DO: Comment complex logic with "why" not "what"
function calculatePoints(order: Order): number {
  // Reason: Points are calculated differently for members with tier multipliers
  // Regular customers get 1 point per 10 THB, while Gold members get 1.5x
  const basePoints = Math.floor(order.total / 10)
  const multiplier = getTierMultiplier(order.userId)

  return Math.floor(basePoints * multiplier)
}

// ✅ DO: Use JSDoc for public functions
/**
 * Sends a message to a LINE user.
 *
 * @param userId - LINE user ID
 * @param message - Message content (text, flex, etc.)
 * @returns Message ID if successful
 * @throws {RateLimitError} When LINE API rate limit is exceeded
 * @throws {InvalidUserError} When user has blocked the bot
 */
async function sendMessage(userId: string, message: LineMessage): Promise<string>
```

```php
/**
 * Get paginated conversations for an admin user.
 *
 * @param int $adminId Admin user ID
 * @param int $limit Maximum results (default: 20, max: 100)
 * @param int $offset Pagination offset
 * @param string|null $status Filter by status ('active', 'closed', 'pending')
 * @return array{conversations: array, total: int, hasMore: bool}
 * @throws InvalidArgumentException When limit exceeds 100
 */
function getConversations(
    int $adminId,
    int $limit = 20,
    int $offset = 0,
    ?string $status = null
): array
```

### README Updates

When adding new features:
1. Update setup instructions if dependencies change
2. Document new environment variables in `.env.example`
3. Add API endpoint documentation
4. Update architecture diagrams if structure changes

---

## ⚠️ Critical Gotchas

### Database (228 Tables)

| Issue | Solution |
|-------|----------|
| Prisma types may not match legacy schema | Use Zod for runtime validation |
| `messages` table has 1M+ rows | Use cursor-based pagination + virtual scrolling |
| Complex JOINs are slow | Add composite indexes, use EXPLAIN |

### PHP-Next.js Bridge

| Issue | Solution |
|-------|----------|
| Session sync issues | Use INTERNAL_API_SECRET for auth |
| CORS errors | Configure both PHP and Next.js CORS |
| Date format mismatch | PHP sends strings, parse with `z.coerce.date()` |

### LINE API

| Issue | Solution |
|-------|----------|
| Rate limit (500/min push) | Use reply tokens when possible, queue broadcasts |
| Rich menu limit (1000/day) | Cache menu operations |
| Webhook signature invalid | Verify request body before parsing JSON |

### Real-time (Pusher)

| Issue | Solution |
|-------|----------|
| Events lost on reconnect | Buffer events, replay on reconnection |
| Private channel auth fails | Check auth endpoint returns correct response |
| Connection drops frequently | Implement connection state UI, auto-reconnect |

### Performance

| Issue | Solution |
|-------|----------|
| Large list renders slow | Virtual scrolling with @tanstack/react-virtual |
| Stale data showing | Configure React Query staleTime properly |
| API response > 200ms | Add indexes, optimize queries, use caching |

---

## ✅ Pre-Commit Checklist

Before submitting code:

```bash
# 1. Type checking
npm run check-types

# 2. Linting
npm run lint

# 3. Run tests
npm run test

# 4. Build test
npm run build
```

### Code Review Checklist

- [ ] No TypeScript errors or `any` types
- [ ] All API inputs validated with Zod
- [ ] Loading, error, and empty states handled
- [ ] Mobile responsive (test at 375px width)
- [ ] Accessible (keyboard nav, ARIA labels)
- [ ] No console.log in production code
- [ ] Sensitive data not exposed in logs
- [ ] SQL uses prepared statements only
- [ ] Tests cover happy path + error cases

---

## 🚫 Anti-Patterns to Avoid

### Code Quality
- ❌ Using `any` type in TypeScript
- ❌ Ignoring TypeScript errors with `@ts-ignore`
- ❌ Creating files > 500 lines
- ❌ Deeply nested code (> 3 levels)
- ❌ Copy-pasting code instead of abstracting

### Security
- ❌ Concatenating SQL strings
- ❌ Storing secrets in code
- ❌ Trusting client-side validation only
- ❌ Exposing internal errors to users
- ❌ Missing rate limiting on public endpoints

### Performance
- ❌ Loading all data at once (pagination required)
- ❌ Using `SELECT *` in production queries
- ❌ Rendering 100+ items without virtualization
- ❌ Missing loading states
- ❌ Ignoring React Query cache

### UX
- ❌ Touch targets < 44x44px
- ❌ Missing error messages for failed actions
- ❌ No feedback for successful actions
- ❌ Blocking UI during data fetching
- ❌ Ignoring mobile viewport

---

## 📖 References

### Project Documentation
- `PRPs/คู่มือ.md` - Complete system architecture
- `PRPs/INITIAL.md` - Feature specifications
- `PRPs/production-readiness-enhancement.md` - Implementation guide

### External Documentation
- Next.js: https://nextjs.org/docs
- React Query: https://tanstack.com/query/latest
- Prisma: https://www.prisma.io/docs
- shadcn/ui: https://ui.shadcn.com/docs
- LINE API: https://developers.line.biz/en/reference/messaging-api/
- Pusher: https://pusher.com/docs/channels

---

*Last updated: February 2026*
