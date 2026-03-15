# Copilot Instructions — LINE Telepharmacy CRM (InboxReya)

## Architecture Overview

Hybrid PHP + Next.js 15 (App Router) CRM for managing LINE Official Account messaging. The PHP backend (`webhook.php`, `re-ya/classes/`) handles LINE webhook processing, auto-replies, and e-commerce logic. The Next.js app provides the admin inbox UI, reading the **same MySQL database** via Prisma ORM. Real-time updates flow: LINE → PHP webhook → DB → POST to `/api/inbox/webhook-notify` → Pusher → browser.

Multi-tenant: users are scoped to a `lineAccountId`; `super_admin` sees all accounts.

## Key Commands

- `npm run dev` / `npm run build` — Dev server / production build
- `npm test` — Vitest (unit + integration); `npm run test:watch` for watch mode
- `npm run check-types` — `tsc --noEmit` (strict mode)
- `npm run db:generate` / `db:push` / `db:migrate` — Prisma schema workflow
- Pre-commit (Husky + lint-staged): runs `tsc --noEmit` and `vitest related --run` on staged `.ts/.tsx` files

## API Route Conventions

All API routes live in `src/app/api/`. Use the centralized helpers from `src/lib/api-utils.ts`:

```ts
// Route handler with auth + error handling:
export const GET = withAPIRoute(async (request) => {
  const params = validateQuery(request, mySchema);
  const data = await prisma.model.findMany({ ... });
  return successResponse(data);
}, { requireAuth: true, allowedRoles: ['admin', 'super_admin'] });
```

- **Response envelope**: `{ success: true, data }` or `{ success: false, error }` — always use `successResponse()` / `errorResponse()` / `handleAPIError()`
- **Validation**: use `validateBody()`, `validateQuery()`, `validateParams()` with Zod schemas from `src/lib/validations.ts`
- **Auth in routes**: `withAPIRoute` handles it, or call `requireAuth(request)` / `requireRole(request, role)` manually
- **Error classes**: `BadRequestError`, `UnauthorizedError`, `ForbiddenError`, `NotFoundError`, `ConflictError`, `RateLimitError` from `src/lib/errors.ts`

## State Management (3-Layer)

| Layer | Tech | Location | Purpose |
|-------|------|----------|---------|
| Server data | TanStack React Query v5 | `src/hooks/use-*.ts` | Fetching, caching, mutations, optimistic updates |
| Client UI | Zustand v5 | `src/stores/` | Selected conversation, filters, sidebar state, chat composer |
| Query keys | Factory object | `src/lib/query-keys.ts` | Centralized `queryKeys.conversations(filters)` pattern |

**Hook conventions**: hooks read Zustand state for filters, pass to query keys. Default staleTime ~10-30s, refetchInterval 10-15s for polling. Mutations invalidate root keys (e.g., `queryKeys.conversationsRoot()`). Use optimistic updates for message sending — `onMutate` snapshots → `onError` rollback → `onSettled` invalidate.

## Prisma & Database

Schema: `prisma/schema.prisma` (~5000 lines, MySQL). Mixed naming: newer models use PascalCase (`ConversationAssignment`), legacy models use snake_case (`account_daily_stats`). All models use `@map()` to snake_case table/column names. Singleton client pattern in `src/lib/prisma.ts` (stored on `globalThis` for HMR).

## Component Patterns

- **UI primitives**: shadcn/ui in `src/components/ui/` (Radix + Tailwind + CVA). Use `cn()` from `src/lib/utils.ts` for class merging.
- **Feature components**: organized by domain in `src/components/{inbox,analytics,broadcasts,groups,orders,odoo}/`
- **Page pattern**: pages use `*PageClient.tsx` / `*LayoutClient.tsx` wrappers (`'use client'`)
- **Icons**: Lucide React exclusively. **Charts**: Recharts. **Forms**: React Hook Form + Zod resolvers.
- **CSS**: Tailwind v3 with HSL CSS variables (shadcn theme). Dark mode via `.dark` class.

## Real-time (Pusher)

- Server helpers in `src/lib/pusher-server.ts`: `triggerConversationUpdate()`, `triggerNewMessage()`, `triggerTypingIndicator()`
- Client in `src/lib/pusher-client.ts`: subscribes to channels, updates React Query cache directly
- Channels: `inbox` (global), `conversation-{id}`, `user-{id}`
- Connection state tracked in `src/stores/realtime.ts`

## Testing

Vitest + jsdom + React Testing Library. Globals enabled (no imports for `describe`/`it`/`expect`). Tests in `src/__tests__/` (colocated) and `tests/` (dedicated). API route tests call handlers directly with constructed `NextRequest` — no HTTP server needed. Path alias `@/` works in tests.

## Project-Specific Notes

- **Thai-language context**: UI is Thai, uses `Asia/Bangkok` timezone, `Noto Sans Thai` font, `th-TH` locale with `date-fns`
- **LINE CDN images**: remote patterns configured in `next.config.js` for `*.line-scdn.net`
- **Server Actions** (`src/actions/`): used for group messaging; call legacy PHP via `PHP_API_BASE_URL` env var
- **Path alias**: `@/` maps to `src/` everywhere (tsconfig, vitest, webpack)
- **Accessibility**: built-in HighContrastMode, FocusIndicator, TextScalingSupport in provider tree
