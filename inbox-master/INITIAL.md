## FEATURE:

**Production Readiness Enhancement for LINE Telepharmacy CRM Platform**

Transform the LINE Telepharmacy CRM Platform (re-ya + inboxreya) into a production-ready system with polished UX/UI, complete functionality, performance optimization, and enterprise-grade reliability suitable for deployment to Thai pharmacy businesses.

### Core Objectives:

1. **UI/UX Excellence**
   - Smooth, responsive interface across all devices (mobile-first)
   - Professional, polished design with consistent branding
   - Loading states, error states, empty states for all interactions
   - Accessibility (A11Y) compliance with WCAG 2.1 AA standards
   - Touch-friendly controls (min 44x44px tap targets)

2. **Performance Optimization**
   - API responses < 200ms (p95)
   - Page load times < 2 seconds
   - Real-time updates < 500ms latency
   - Virtual scrolling for large datasets (1M+ messages)
   - Optimized images with WebP/AVIF formats
   - Proper React Query caching strategies

3. **Type Safety & Code Quality**
   - Zero TypeScript errors
   - Full type coverage for all API responses
   - Zod validation on all API routes
   - 80%+ test coverage (unit + integration)
   - E2E tests for critical user flows

4. **Backend Modernization**
   - Upgrade to modern PHP 8+ patterns
   - Optimize database queries (228 tables)
   - Add proper indexes for performance
   - Implement Redis caching strategy
   - Standardize API response formats

5. **Real-time & Integrations**
   - Robust Pusher WebSocket implementation
   - LINE API integration with rate limit handling
   - Gemini AI integration with streaming
   - Offline support with sync queue
   - Error recovery and retry logic

6. **DevOps & Monitoring**
   - Docker containerization
   - CI/CD pipeline (GitHub Actions)
   - Health check endpoints
   - Error tracking (Sentry or similar)
   - Performance monitoring (APM)
   - Log aggregation

7. **Security Hardening**
   - Security headers (CSP, HSTS, etc.)
   - Input validation and sanitization
   - Rate limiting per IP/user/endpoint
   - CSRF protection
   - SQL injection prevention
   - XSS prevention

8. **Production Deployment**
   - Environment configuration
   - Database migrations
   - CDN setup
   - SSL/TLS certificates
   - Load balancing
   - Backup strategy

## EXAMPLES:

### Example 1: Virtual Scrolling Implementation

Location: `use-cases/agent-factory-with-subagents/agents/rag_agent/`

**Pattern to follow:**
```typescript
// Reference implementation showing virtual scrolling with @tanstack/react-virtual
import { useVirtualizer } from '@tanstack/react-virtual'

function MessageList({ messages }) {
  const parentRef = useRef<HTMLDivElement>(null)

  const virtualizer = useVirtualizer({
    count: messages.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80,
    overscan: 10
  })

  return (
    <div ref={parentRef} className="h-full overflow-auto">
      <div style={{ height: `${virtualizer.getTotalSize()}px` }}>
        {virtualizer.getVirtualItems().map(virtualRow => (
          <div
            key={virtualRow.index}
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              height: `${virtualRow.size}px`,
              transform: `translateY(${virtualRow.start}px)`
            }}
          >
            <Message message={messages[virtualRow.index]} />
          </div>
        ))}
      </div>
    </div>
  )
}
```

**Why this example:** Shows how to handle large datasets efficiently with virtual scrolling, critical for messages table with 1M+ rows.

### Example 2: React Query Patterns

Location: `inboxreya/src/hooks/useConversations.ts`

**Pattern to follow:**
```typescript
export function useConversations(filters?: ConversationFilters) {
  return useQuery({
    queryKey: ['conversations', filters],
    queryFn: () => fetchConversations(filters),
    staleTime: 30 * 1000, // 30 seconds
    gcTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  })
}

export function useSendMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: sendMessage,
    onMutate: async (newMessage) => {
      // Optimistic update
      await queryClient.cancelQueries({ queryKey: ['messages'] })
      const previousMessages = queryClient.getQueryData(['messages'])

      queryClient.setQueryData(['messages'], (old) => [...old, newMessage])

      return { previousMessages }
    },
    onError: (err, newMessage, context) => {
      // Rollback on error
      queryClient.setQueryData(['messages'], context.previousMessages)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['messages'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
  })
}
```

**Why this example:** Shows proper caching strategy and optimistic updates for better UX.

### Example 3: Error Boundary Pattern

Location: `inboxreya/src/components/ErrorBoundary.tsx`

**Pattern to follow:**
```typescript
'use client'

import React from 'react'

export class ErrorBoundary extends React.Component {
  state = { hasError: false, error: null }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // Log to error tracking service
    console.error('Error caught by boundary:', error, errorInfo)
    // TODO: Send to Sentry/similar
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen items-center justify-center">
          <div className="text-center">
            <h1 className="text-2xl font-bold">Something went wrong</h1>
            <button onClick={() => this.setState({ hasError: false })}>
              Try again
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
```

**Why this example:** Shows proper error handling with recovery mechanism.

### Example 4: Modern PHP Service Pattern

Location: `re-ya/classes/InboxService.php`

**Pattern to follow:**
```php
<?php
declare(strict_types=1);

namespace App\Services;

class InboxService {
    public function __construct(
        private PDO $db,
        private CacheInterface $cache,
        private LoggerInterface $logger
    ) {}

    /**
     * Get conversations with proper error handling and caching
     */
    public function getConversations(
        int $limit = 20,
        int $offset = 0,
        ?string $status = null
    ): array {
        try {
            // Check cache first
            $cacheKey = "conversations:{$limit}:{$offset}:{$status}";
            if ($cached = $this->cache->get($cacheKey)) {
                return $cached;
            }

            // Build query with prepared statements
            $query = "SELECT * FROM conversations WHERE 1=1";
            $params = [];

            if ($status !== null) {
                $query .= " AND status = :status";
                $params['status'] = $status;
            }

            $query .= " ORDER BY last_message_at DESC LIMIT :limit OFFSET :offset";
            $params['limit'] = $limit;
            $params['offset'] = $offset;

            $stmt = $this->db->prepare($query);
            $stmt->execute($params);
            $results = $stmt->fetchAll(PDO::FETCH_ASSOC);

            // Cache for 30 seconds
            $this->cache->set($cacheKey, $results, 30);

            return $results;

        } catch (PDOException $e) {
            $this->logger->error('Database error in getConversations', [
                'error' => $e->getMessage(),
                'limit' => $limit,
                'offset' => $offset
            ]);
            throw new DatabaseException('Failed to fetch conversations', 0, $e);
        }
    }
}
```

**Why this example:** Shows modern PHP 8+ patterns with type safety, dependency injection, caching, and error handling.

### Example 5: Testing Pattern with Vitest

Location: `use-cases/agent-factory-with-subagents/agents/rag_agent/tests/test_agent.py`

**Pattern to adapt for TypeScript/Vitest:**
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useConversations } from '@/hooks/useConversations'

describe('useConversations', () => {
  let queryClient: QueryClient

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    })
  })

  it('fetches conversations successfully', async () => {
    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useConversations(), { wrapper })

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(result.current.data).toBeDefined()
    expect(Array.isArray(result.current.data)).toBe(true)
  })

  it('handles errors gracefully', async () => {
    // Mock API to throw error
    vi.mock('@/lib/api', () => ({
      fetchConversations: vi.fn().mockRejectedValue(new Error('API Error'))
    }))

    const wrapper = ({ children }) => (
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    )

    const { result } = renderHook(() => useConversations(), { wrapper })

    await waitFor(() => expect(result.current.isError).toBe(true))

    expect(result.current.error).toBeDefined()
  })
})
```

**Why this example:** Shows comprehensive testing with mocking, error cases, and async handling.

## DOCUMENTATION:

### Official Documentation (must reference during implementation)

**Frontend Stack:**
- Next.js 15: https://nextjs.org/docs
  - App Router architecture
  - Server Components vs Client Components
  - Caching and revalidation strategies
  - API Routes

- React 19: https://react.dev/reference/react
  - New hooks (useOptimistic, useFormStatus)
  - Server Components
  - Suspense boundaries

- React Query v5: https://tanstack.com/query/latest/docs/framework/react/overview
  - Query keys and functions
  - Cache management
  - Optimistic updates
  - Mutation patterns

- shadcn/ui: https://ui.shadcn.com/docs
  - Component patterns
  - Accessibility guidelines
  - Theming system

- Tailwind CSS: https://tailwindcss.com/docs
  - Utility classes
  - Responsive design
  - Dark mode

**Backend Stack:**
- PHP 8.2: https://www.php.net/manual/en/
  - Type declarations
  - Named arguments
  - Attributes
  - Enums

- PDO Best Practices: https://www.php.net/manual/en/book.pdo.php
  - Prepared statements
  - Error handling
  - Connection pooling

- Prisma ORM: https://www.prisma.io/docs
  - Schema design
  - Query optimization
  - Migrations
  - Connection pooling

**Database:**
- MySQL 8.0 Optimization: https://dev.mysql.com/doc/refman/8.0/en/optimization.html
  - Index strategies
  - Query optimization
  - EXPLAIN analysis

**Integrations:**
- LINE Messaging API: https://developers.line.biz/en/reference/messaging-api/
  - Message types
  - Webhooks
  - Rich menus
  - Rate limits

- Pusher Channels: https://pusher.com/docs/channels
  - Channel types
  - Authentication
  - Presence channels
  - Client events

- Google Gemini AI: https://ai.google.dev/gemini-api/docs
  - API reference
  - Prompt engineering
  - Safety settings
  - Streaming

**Testing:**
- Vitest: https://vitest.dev/guide/
  - Setup and configuration
  - Mocking
  - Coverage

- Testing Library: https://testing-library.com/docs/react-testing-library/intro/
  - Query methods
  - User events
  - Async utilities

**DevOps:**
- Docker: https://docs.docker.com/
  - Multi-stage builds
  - Docker Compose
  - Networking

- GitHub Actions: https://docs.github.com/en/actions
  - Workflow syntax
  - Secrets management
  - Deployment

### Project-Specific Documentation

- **System Architecture**: `PRPs/คู่มือ.md`
  - Complete overview of 228 database tables
  - All API endpoints (PHP and Next.js)
  - User flows and integrations
  - Tech stack details

- **PRP Template**: `PRPs/templates/prp_base.md`
  - Structure for implementation plans
  - Validation gates
  - Best practices

- **Example Multi-Agent PRP**: `PRPs/EXAMPLE_multi_agent_prp.md`
  - Reference implementation pattern
  - Testing strategies

### External Resources for Best Practices

- Web Vitals: https://web.dev/vitals/
  - Core Web Vitals metrics
  - Performance optimization

- WCAG 2.1 Guidelines: https://www.w3.org/WAI/WCAG21/quickref/
  - Accessibility standards
  - Testing methods

- OWASP Top 10: https://owasp.org/www-project-top-ten/
  - Security vulnerabilities
  - Prevention strategies

## OTHER CONSIDERATIONS:

### 1. **Legacy Database (228 Tables)**
- The database schema is legacy with 228 tables
- Some tables may have inconsistent naming or structure
- **Gotcha**: Prisma types might not match actual DB schema perfectly
- **Solution**: Use Zod for runtime validation on critical data
- **Critical Tables** to focus on:
  - `messages` (1M+ rows) - needs proper indexes
  - `conversations` - frequently queried
  - `users`, `line_users`, `members` - user data
  - `orders`, `order_items` - e-commerce
  - `points_transactions` - loyalty program

### 2. **PHP-Next.js Bridge Complexity**
- System uses both PHP backend (re-ya) and Next.js (inboxreya)
- **Gotcha**: Session management between PHP sessions and NextAuth
- **Gotcha**: CORS configuration can be tricky
- **Solution**: Use INTERNAL_API_SECRET for secure communication
- **Pattern**: Always validate and sanitize data crossing the bridge

### 3. **LINE API Rate Limits**
- Push messages: 500/min per bot
- Rich menu operations: 1000/day
- **Gotcha**: Rate limit errors (429) need exponential backoff
- **Solution**: Implement message queue for broadcasts
- **Critical**: Always use reply tokens when available (free tier)

### 4. **Real-time with Pusher**
- Private channels require authentication endpoint
- **Gotcha**: Connection state changes need handling
- **Gotcha**: Events can be lost during reconnection
- **Solution**: Implement event buffering during offline
- **Pattern**: Use presence channels for online/offline status

### 5. **Performance Considerations**
- Messages table has 1M+ rows
- **Gotcha**: Regular pagination will be slow
- **Solution**: Use cursor-based pagination
- **Solution**: Implement virtual scrolling for UI
- **Critical**: Add composite indexes on (conversation_id, created_at)

### 6. **Mobile-First Development**
- 60%+ users will be on mobile
- **Gotcha**: Touch targets must be min 44x44px
- **Gotcha**: Bottom navigation better than sidebar on mobile
- **Solution**: Use responsive breakpoints (sm, md, lg, xl)
- **Pattern**: Bottom sheet instead of modals on mobile

### 7. **Type Safety Challenges**
- PHP responses need runtime validation
- **Gotcha**: PHP sends dates as strings, not Date objects
- **Gotcha**: PHP null vs undefined vs empty string
- **Solution**: Use Zod schemas for all PHP API responses
- **Pattern**: Create shared types between PHP and TypeScript

### 8. **Testing Database-Heavy Code**
- Many features depend on complex database queries
- **Gotcha**: Can't easily mock Prisma in tests
- **Solution**: Use separate test database
- **Solution**: Implement repository pattern for easier mocking
- **Pattern**: Test critical queries with real DB in CI/CD

### 9. **Error Handling Gotchas**
- LINE API can return success but message not delivered
- **Gotcha**: 200 OK doesn't mean message reached user
- **Solution**: Check delivery status webhooks
- **Pattern**: Log all LINE API responses for debugging

### 10. **Deployment Gotchas**
- Environment variables differ between dev/staging/prod
- **Gotcha**: Prisma needs DIRECT_DATABASE_URL for migrations
- **Gotcha**: NextAuth requires NEXTAUTH_URL to be exact
- **Solution**: Use .env.example as template
- **Critical**: Never commit .env files

### 11. **Common AI Assistant Mistakes to Avoid**

**TypeScript Issues:**
- ❌ Using 'any' type instead of proper typing
- ❌ Forgetting to mark client components with 'use client'
- ❌ Not validating external data with Zod

**React Query Issues:**
- ❌ Wrong cache invalidation causing stale data
- ❌ Missing optimistic updates causing slow UI
- ❌ Not handling loading and error states

**Performance Issues:**
- ❌ Not using virtual scrolling for large lists
- ❌ Not implementing proper pagination
- ❌ Loading all data at once instead of lazy loading

**Security Issues:**
- ❌ Concatenating strings in SQL queries
- ❌ Not sanitizing HTML from user input
- ❌ Missing rate limiting on public endpoints

**Mobile UX Issues:**
- ❌ Small touch targets (< 44px)
- ❌ Not testing on real mobile devices
- ❌ Ignoring mobile viewport height differences

### 12. **Success Metrics**

**Must Pass Before Production:**
- ✅ Zero TypeScript errors (`npm run check-types`)
- ✅ Zero ESLint errors (`npm run lint`)
- ✅ All tests passing (`npm run test`)
- ✅ Test coverage > 80% (`npm run test:coverage`)
- ✅ Lighthouse score > 90 for Performance
- ✅ Lighthouse score > 90 for Accessibility
- ✅ No console errors in browser
- ✅ All API endpoints < 200ms response time (p95)
- ✅ All pages load < 2 seconds
- ✅ Mobile-responsive on iOS and Android

### 13. **Feature Flags for Gradual Rollout**

Consider implementing feature flags for:
- New AI features (can be expensive)
- Real-time features (can be heavy on resources)
- Advanced analytics (might need optimization)
- New integrations (need production testing)

**Pattern**: Use environment variables or database config for flags

### 14. **Monitoring Requirements**

**Must Have:**
- Error tracking (Sentry or similar)
- Performance monitoring (APM)
- Uptime monitoring
- Database query monitoring
- API endpoint monitoring

**Nice to Have:**
- User session recording
- Feature usage analytics
- A/B testing framework

### 15. **Backup and Disaster Recovery**

**Critical:**
- Daily database backups
- Message attachments backup (images, files)
- Configuration backup
- Tested restore procedure

**Pattern**: 3-2-1 backup rule (3 copies, 2 different media, 1 offsite)
