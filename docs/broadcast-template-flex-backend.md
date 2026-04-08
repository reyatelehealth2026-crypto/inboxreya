# Broadcast / Template / Flex Builder — Backend Contract

Status: working draft
Last updated: 2026-04-08
Scope: `inboxreya`

## 1. Current backend reality

### Existing tables/models already in schema

The repo already has overlapping models for this domain:

- `broadcast_campaigns`
- `broadcast_messages`
- `BroadcastMessageV2`
- `flex_templates`
- `quick_reply_templates`
- `templates`

This means the codebase already has data storage options, but the **API + UI contract is not unified** yet.

## 2. Current route situation

### Broadcast routes in use now

- `GET/POST /api/inbox/broadcasts`
- `DELETE /api/inbox/broadcasts/[id]`
- scheduled helpers under `/api/inbox/broadcasts/schedule*`

### Template routes in use now

- `GET/POST /api/inbox/templates`
- `GET/PATCH/DELETE /api/inbox/templates/[id]`
- categories / most-used / use endpoints

### Important mismatch found

`src/hooks/use-broadcasts.ts` uses:

- `GET /api/inbox/broadcasts/templates`

but the repo previously had **no such route**.

To reduce friction and make the current broadcast composer less broken, a new **read-only normalization route** has been added:

- `GET /api/inbox/broadcasts/templates`

This route aggregates template-like records from:

- `quick_reply_templates`
- `flex_templates`
- `templates`

and returns them in the current `BroadcastTemplate` shape expected by the broadcast UI.

## 3. Current contract gaps

### Gap A — create broadcast UI vs backend POST contract

The UI can currently prepare values like:

- `templateId`
- `flexContent`
- `mediaUrl`

But `POST /api/inbox/broadcasts` still validates only a narrow text-first payload:

- `content`
- `mediaUrl?`
- `targetSegmentId?`
- `targetCustomerIds?`
- `scheduledAt?`

There is no real server-side handling yet for:

- `templateId`
- `flexContent`
- template source resolution
- canonical message type selection

### Gap B — multiple storage strategies exist

There are at least 3 plausible directions:

1. continue with `BroadcastMessageV2`
2. pivot back to legacy `broadcast_messages`
3. create a new canonical broadcast message model

Doing all three at once will make the system harder to maintain.

### Gap C — template data is split by concern

Current tables are good for legacy behavior, but weak as a single product surface:

- `quick_reply_templates` = text-centric
- `flex_templates` = flex-centric
- `templates` = generic but thin

## 4. Recommended target contract

## 4.1 Canonical template payload

Use one normalized API contract for the frontend, regardless of storage source:

```ts
export interface BroadcastTemplateDTO {
  id: number
  sourceId: number
  sourceTable: 'quick_reply_templates' | 'flex_templates' | 'templates'
  name: string
  description?: string
  category: 'text' | 'image' | 'video' | 'flex'
  content?: string
  mediaUrl?: string
  flexContent?: FlexMessage
  isActive: boolean
  createdAt: string
}
```

This is enough for selection, preview, duplicate, migration, and future template-center work.

## 4.2 Canonical broadcast create payload

Recommended future request shape:

```ts
export interface CreateBroadcastRequest {
  title?: string
  messageType: 'text' | 'image' | 'video' | 'flex'
  content?: string
  mediaUrl?: string
  flexContent?: FlexMessage
  templateId?: number
  templateSourceTable?: 'quick_reply_templates' | 'flex_templates' | 'templates'
  targetMode: 'all' | 'segment' | 'manual'
  targetSegmentId?: number
  targetCustomerIds?: number[]
  scheduledAt?: string
  metadata?: Record<string, unknown>
}
```

### Validation rules

- `messageType=text` → require `content`
- `messageType=image|video` → require `mediaUrl`
- `messageType=flex` → require valid `flexContent`
- `templateId` is optional, but if present it should resolve to a visible template owned by the same `lineAccountId`
- `targetMode=manual` → require non-empty `targetCustomerIds`
- `scheduledAt` must be future datetime when present

## 5. Recommended route set

### Template Center routes

These should become the canonical routes for the new product surface:

- `GET /api/inbox/broadcast-templates`
- `POST /api/inbox/broadcast-templates`
- `GET /api/inbox/broadcast-templates/[id]`
- `PATCH /api/inbox/broadcast-templates/[id]`
- `DELETE /api/inbox/broadcast-templates/[id]`
- `POST /api/inbox/broadcast-templates/[id]/duplicate`
- `POST /api/inbox/broadcast-templates/[id]/archive`
- `POST /api/inbox/broadcast-templates/[id]/test-send`

### Flex Builder support routes

- `POST /api/inbox/flex-builder/validate`
- `POST /api/inbox/flex-builder/preview-thumbnail`
- `GET /api/inbox/flex-builder/presets`

### Broadcast composer routes

- continue `GET /api/inbox/broadcasts`
- expand `POST /api/inbox/broadcasts`
- add `POST /api/inbox/broadcasts/[id]/send`
- add `POST /api/inbox/broadcasts/[id]/preview`

## 6. Rollout strategy

### Phase A — no migration groundwork

Safe work that can ship first:

- normalize template reads via `/api/inbox/broadcasts/templates`
- keep current legacy tables as data sources
- add workspace / placeholder UI
- document canonical API contracts

### Phase B — choose one write strategy

Pick one of the following and do it intentionally:

#### Option 1 — converge on `BroadcastMessageV2`

Pros:
- current broadcast routes already use it
- smallest mental switch for existing route code

Cons:
- needs schema expansion for richer message types / metadata / maybe flex payload

#### Option 2 — converge on legacy `broadcast_messages`

Pros:
- already has `title`, `message_type`, `flex_json`

Cons:
- fights current v2 route code and increases confusion if not fully migrated

### Recommendation

**Prefer Option 1**:
- keep `BroadcastMessageV2` as canonical broadcast record
- add the missing fields through a deliberate migration later
- treat legacy broadcast tables as reference / legacy integration points only

## 7. Security + permission rules

Every template and broadcast query should always scope by the authenticated account:

- `lineAccountId`
- ownership / visibility rules

Never allow a user to:

- preview another account's template
- send another account's broadcast
- resolve `templateId` across accounts

For test-send and broadcast send:

- validate recipient scope
- log source template and actor
- record send result / failure reason

## 8. Compatibility plan with existing quick replies

Do not break quick replies.

Recommended compatibility path:

- keep `/api/inbox/templates` + `/inbox/templates` working for quick reply use cases
- treat them as a legacy-but-supported surface
- in the new broadcast template center, allow importing / surfacing quick replies as text templates
- do not silently replace quick reply CRUD until the new center is stable

## 9. Immediate next implementation slice

Best next backend slice:

1. keep the new `GET /api/inbox/broadcasts/templates` route
2. add a dedicated `BroadcastTemplateDTO` normalizer helper later
3. decide the canonical broadcast write model
4. only then expand `POST /api/inbox/broadcasts`

## 10. Files currently relevant

- `src/app/api/inbox/broadcasts/route.ts`
- `src/app/api/inbox/broadcasts/[id]/route.ts`
- `src/app/api/inbox/broadcasts/templates/route.ts`
- `src/app/api/inbox/templates/route.ts`
- `src/app/api/inbox/templates/[id]/route.ts`
- `src/hooks/use-broadcasts.ts`
- `src/types/broadcast.ts`
- `prisma/schema.prisma`
