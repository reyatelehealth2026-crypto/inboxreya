# Broadcast + Template + Flex Builder UX/UI-Max Roadmap Review

**Date:** 2025-01-21
**Status:** Read-only audit (no code changes)
**Auditor:** UX/UI-Max Review Subagent

---

## 1. Current-State Assessment

### 1.1 Existing Architecture

| Area | File(s) | Status | Notes |
|------|---------|--------|-------|
| **Broadcast Types** | `src/types/broadcast.ts` | ✅ Complete | Good TypeScript types for `Broadcast`, `BroadcastTemplate`, `FlexMessage`, `FlexBubble`, `FlexCarousel`, and sub-components |
| **Flex Preview** | `src/components/inbox/FlexPreview.tsx` | ✅ Complete | Accurate LINE-style rendering; supports bubble, carousel, box, text, image, button, separator, spacer, filler |
| **Create Broadcast Dialog** | `src/components/broadcasts/CreateBroadcastDialog.tsx` | ⚠️ Partial | 3-step wizard works but template selection is limited; custom Flex requires manual JSON input |
| **Template Selector** | `src/components/broadcasts/TemplateSelector.tsx` | ⚠️ Partial | Shows templates by category but no visual Flex Builder |
| **Broadcast List** | `src/components/broadcasts/BroadcastList.tsx` | ✅ Complete | List view with status tabs, pagination, stats cards |
| **Quick Reply Templates** | `src/components/inbox/QuickReplyTemplates.tsx` + `QuickReplyTemplateDialog.tsx` | ✅ Complete | CRUD for text templates with shortcuts, variables, categories |
| **Template Utils** | `src/lib/template-utils.ts` | ✅ Complete | Variable extraction, substitution, shortcut detection |
| **Flex Builder Lib** | `src/lib/flex-builder.ts` | ⚠️ Programmatic | Template-based Flex generation (product_catalog, promotion, flash_sale, etc.) - NOT a visual builder |
| **API Routes** | `src/app/api/inbox/broadcasts/route.ts`, `templates/route.ts`, `templates/[id]/route.ts` | ✅ Complete | Auth, validation, caching implemented |
| **Hooks** | `src/hooks/use-broadcasts.ts` | ✅ Complete | React Query hooks for broadcasts, templates, stats |

### 1.2 Database Models (Prisma)

| Model | Purpose | Flex Support |
|-------|---------|--------------|
| `broadcast_messages` | Broadcast messages with target/filter | `flex_json` column (LONGTEXT) |
| `broadcast_campaigns` | Campaign grouping | `message_type` enum includes 'flex' |
| `flex_templates` | Reusable Flex templates | `flex_json` (LONGTEXT) + metadata |
| `quick_reply_templates` | Text templates | `content` + `shortcuts` + `variables` |

**Gap:** No unified `broadcast_templates` table that combines text/image/flex with proper category management.

---

## 2. What Already Exists (Can Reuse)

### 2.1 Strong Foundations

1. **FlexPreview Component** - Production-ready LINE-style preview
   - Handles all core Flex components
   - Supports bubble sizes (nano → giga)
   - Carousel rendering with scroll
   - Theme-aware styling

2. **flex-builder.ts** - Powerful programmatic builder
   - 5 built-in templates: `product_catalog`, `promotion`, `flash_sale`, `new_arrival`, `bestseller`
   - 2 layouts: Promo Grid (6 products/bubble) and Detail (1 product/bubble)
   - Cover bubble generation
   - Multi-carousel splitting (LINE 5-message limit handling)
   - Product card generation from CSV data

3. **Template System** - Quick Reply templates
   - Variable interpolation `{{name}}`
   - Shortcut triggers (`/command`)
   - Category organization
   - Usage tracking

4. **API Infrastructure**
   - Redis caching
   - Auth middleware
   - Zod validation
   - Proper error handling

### 2.2 UI Patterns to Extend

- **3-Step Wizard** in CreateBroadcastDialog (Template → Target → Schedule)
- **Tab-based filtering** in TemplateSelector
- **Real-time preview** pattern
- **Badge/status system** in BroadcastList

---

## 3. Major Gaps & Blockers

### 3.1 Visual Flex Builder (CRITICAL BLOCKER)

**Current State:** Users must write raw JSON to create custom Flex messages.

**What's Missing:**
- Drag-and-drop component palette
- Visual component tree / outline view
- Property editor panel
- Real-time WYSIWYG editing
- Undo/redo support
- Copy/paste components
- Component templates library

**Complexity:** HIGH - This is a substantial feature requiring:
- State management for builder state
- Component drag-and-drop library (e.g., dnd-kit)
- JSON schema validation against LINE Flex spec
- Responsive preview modes

### 3.2 Unified Template Management

**Current State:** 
- `quick_reply_templates` = text-only
- `flex_templates` = Flex-only, not integrated with broadcast flow

**What's Missing:**
- Single template management UI for all types (text, image, video, flex)
- Template categories that work across types
- Template preview for all types
- Template versioning/history

### 3.3 Flex Template Management UI

**Current State:** `flex_templates` table exists but no UI.

**What's Missing:**
- List/view/edit/delete Flex templates
- Template thumbnail generation
- Public/shared template library
- Template import/export

### 3.4 Segment/Target Selection

**Current State:** Segment selection UI shows "ฟีเจอร์นี้กำลังพัฒนา..."

**What's Missing:**
- Customer segment selection
- Manual customer picker
- Tag-based targeting
- Target preview/estimate

### 3.5 Media Upload for Broadcasts

**Current State:** `mediaUrl` field exists but no upload UI.

**What's Missing:**
- Image upload component
- Video upload support
- Media library browser
- URL input validation

---

## 4. Recommended Architecture Decisions

### 4.1 Template System Unification

**Decision:** Create a unified template abstraction while keeping separate database tables.

```
BroadcastTemplate (union type):
  - type: 'text' | 'image' | 'video' | 'flex'
  - TextTemplate: content, shortcuts, variables
  - ImageTemplate: mediaUrl, caption
  - VideoTemplate: mediaUrl, thumbnail, caption
  - FlexTemplate: flexContent (FlexMessage)
```

**API Layer:** Single `/api/inbox/broadcast-templates` endpoint with type-specific validation.

### 4.2 Flex Builder Architecture

**Decision:** Build modular Flex Builder with these layers:

1. **Core Layer:** JSON state management + LINE spec validation
2. **UI Layer:** DnD component palette + property editor
3. **Preview Layer:** Existing FlexPreview component (reuse)
4. **Template Layer:** Pre-built component templates + user templates

**State Shape:**
```typescript
interface FlexBuilderState {
  selectedType: 'bubble' | 'carousel'
  bubbles: FlexBubbleConfig[]
  activeBubbleIndex: number
  activeComponentPath: string | null // e.g., "body.contents[0]"
  history: { past: FlexBubbleConfig[][], future: FlexBubbleConfig[][] }
  clipboard: FlexComponent | null
}
```

### 4.3 Component Data Model

```typescript
// Base component with common props
interface FlexComponentBase {
  type: string
  flex?: number
  margin?: SpacingValue
}

// All LINE Flex components
type FlexComponent = 
  | FlexBox 
  | FlexText 
  | FlexImage 
  | FlexButton 
  | FlexSeparator 
  | FlexSpacer 
  | FlexFiller

// Builder wrapper with metadata
interface BuilderComponent extends FlexComponent {
  id: string // for React keys and selection
  _locked?: boolean // prevent editing
  _templateRef?: string // reference to template
}
```

### 4.4 Drag-and-Drop Strategy

**Library:** Use `@dnd-kit/core` + `@dnd-kit/sortable`
- Supports nested droppables (boxes inside boxes)
- Good accessibility
- Active maintenance

**Drag Items:**
- Component type from palette → canvas
- Reorder within container
- Move between containers

---

## 5. Phased Task List

### Phase 1: Template Foundation (1-2 weeks)

| Task | Dependencies | Files to Create/Modify |
|------|--------------|------------------------|
| 1.1 Create `BroadcastTemplate` types | None | `src/types/broadcast.ts` |
| 1.2 Add `broadcast_templates` table migration | 1.1 | `prisma/schema.prisma`, migration |
| 1.3 Create unified templates API | 1.2 | `src/app/api/inbox/broadcast-templates/route.ts` |
| 1.4 Create `BroadcastTemplateList` component | 1.3 | `src/components/templates/BroadcastTemplateList.tsx` |
| 1.5 Create `BroadcastTemplateDialog` for text/image/video | 1.3 | `src/components/templates/BroadcastTemplateDialog.tsx` |
| 1.6 Update `TemplateSelector` to use unified API | 1.3 | `src/components/broadcasts/TemplateSelector.tsx` |

### Phase 2: Flex Template Management (1 week)

| Task | Dependencies | Files to Create/Modify |
|------|--------------|------------------------|
| 2.1 Create `FlexTemplateList` component | 1.2 | `src/components/flex/FlexTemplateList.tsx` |
| 2.2 Create `FlexTemplatePreview` with thumbnail | 1.1 | `src/components/flex/FlexTemplatePreview.tsx` |
| 2.3 Add template thumbnail generation | 2.2 | Server-side or client canvas capture |
| 2.4 Integrate flex-builder.ts templates as presets | 2.1 | `src/components/flex/FlexPresetTemplates.tsx` |

### Phase 3: Flex Builder Core (2-3 weeks)

| Task | Dependencies | Files to Create/Modify |
|------|--------------|------------------------|
| 3.1 Create `FlexBuilderContext` state management | None | `src/contexts/FlexBuilderContext.tsx` |
| 3.2 Create `FlexBuilderCanvas` component | 3.1 | `src/components/flex/builder/FlexBuilderCanvas.tsx` |
| 3.3 Create `FlexComponentPalette` | 3.1 | `src/components/flex/builder/FlexComponentPalette.tsx` |
| 3.4 Create `FlexPropertyEditor` | 3.1 | `src/components/flex/builder/FlexPropertyEditor.tsx` |
| 3.5 Create `FlexComponentTree` outline view | 3.1 | `src/components/flex/builder/FlexComponentTree.tsx` |
| 3.6 Implement DnD with @dnd-kit | 3.2, 3.3 | All builder components |
| 3.7 Add undo/redo with use-undo or similar | 3.1 | `src/hooks/use-flex-history.ts` |
| 3.8 JSON import/export | 3.1 | `src/components/flex/builder/FlexJsonPanel.tsx` |

### Phase 4: Flex Builder Polish (1 week)

| Task | Dependencies | Files to Create/Modify |
|------|--------------|------------------------|
| 4.1 Component templates library | 3.3 | `src/lib/flex-component-templates.ts` |
| 4.2 Copy/paste components | 3.1, 3.6 | Builder context |
| 4.3 Keyboard shortcuts | 3.6 | Builder canvas |
| 4.4 Mobile preview mode | 3.2 | Preview toggle |
| 4.5 Validation & error display | 3.1 | `src/lib/flex-validator.ts` |

### Phase 5: Integration & Broadcast Flow (1 week)

| Task | Dependencies | Files to Create/Modify |
|------|--------------|------------------------|
| 5.1 Integrate Flex Builder into CreateBroadcastDialog | Phase 3, 4 | `CreateBroadcastDialog.tsx` |
| 5.2 Update TemplateSelector to include Flex Builder option | 5.1 | `TemplateSelector.tsx` |
| 5.3 Add "Save as Template" from builder | 5.1, 1.2 | Flex Builder |
| 5.4 Media upload for image/video broadcasts | 1.3 | `src/components/broadcasts/MediaUploader.tsx` |

### Phase 6: Target Selection (1 week)

| Task | Dependencies | Files to Create/Modify |
|------|--------------|------------------------|
| 6.1 Create `SegmentSelector` component | None | `src/components/broadcasts/SegmentSelector.tsx` |
| 6.2 Create `CustomerPicker` component | None | `src/components/broadcasts/CustomerPicker.tsx` |
| 6.3 Target count estimation API | 1.2 | `/api/inbox/broadcasts/estimate-targets` |
| 6.4 Integrate into CreateBroadcastDialog step 2 | 6.1, 6.2 | `CreateBroadcastDialog.tsx` |

---

## 6. QA / Syntax / Validation Checklist

### 6.1 Before Implementation

- [ ] Run `npx prisma validate` after schema changes
- [ ] Check TypeScript strict mode compliance
- [ ] Verify all imports use `@/` aliases correctly
- [ ] Ensure components use `"use client"` directive where needed

### 6.2 During Development

- [ ] Flex Builder state changes should be immutable (use Immer or spread)
- [ ] All Flex JSON must validate against LINE Flex Message spec
- [ ] DnD operations should update state optimistically with rollback on error
- [ ] Component palette should show disabled state for invalid drop targets
- [ ] Property editor should validate input types and ranges

### 6.3 Pre-Deployment Checks

#### Syntax
```bash
# Run these commands
npx tsc --noEmit                    # TypeScript check
npx eslint src/ --ext .ts,.tsx      # Linting
npx prisma generate                 # Regenerate client
```

#### Functionality
- [ ] Create text broadcast
- [ ] Create image broadcast with upload
- [ ] Create Flex broadcast from template
- [ ] Create Flex broadcast with builder
- [ ] Save Flex as template
- [ ] Schedule broadcast
- [ ] Cancel scheduled broadcast
- [ ] Broadcast stats update correctly
- [ ] Template search/filter works
- [ ] Undo/redo in Flex Builder
- [ ] Copy/paste components
- [ ] JSON import produces valid Flex
- [ ] JSON export matches LINE spec

#### Performance
- [ ] Large carousels (12 bubbles) render smoothly
- [ ] Builder state updates don't cause excessive re-renders
- [ ] Template list pagination works with 100+ templates

### 6.4 LINE Flex Validation Rules

```typescript
// Key constraints to validate
const FLEX_CONSTRAINTS = {
  MAX_CAROUSEL_BUBBLES: 12,
  MAX_MESSAGE_OBJECTS: 5,
  MAX_BUBBLE_SIZE: 'giga',
  MAX_TEXT_LENGTH: 5000,
  MAX_ALT_TEXT_LENGTH: 400,
  VALID_BUBBLE_SIZES: ['nano', 'micro', 'deca', 'hecto', 'kilo', 'mega', 'giga'],
  VALID_LAYOUTS: ['vertical', 'horizontal', 'baseline'],
  VALID_TEXT_SIZES: ['xs', 'sm', 'md', 'lg', 'xl', 'xxl', '3xl', '4xl', '5xl'],
  VALID_SPACING: ['none', 'xs', 'sm', 'md', 'lg', 'xl', 'xxl'],
}
```

---

## 7. Recommended Next Slice

### Immediate Priority (Week 1)

1. **Create unified `BroadcastTemplate` types and database model**
   - This unblocks all template-related work
   - Low risk, high value

2. **Build `FlexBuilderContext` with basic state management**
   - Establishes the foundation for the visual builder
   - Can be tested in isolation

3. **Create `FlexComponentPalette` with static components**
   - Visual progress early
   - No DnD required initially

### Why This Slice?

- **Unblocks** template management unification
- **Establishes patterns** for Flex Builder state
- **Low dependency** on other tasks
- **Visible progress** for stakeholders
- **Testable** in isolation

---

## 8. Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| LINE Flex spec changes | Low | High | Version-lock Flex spec; add validation layer |
| DnD complexity with nested containers | Medium | Medium | Use proven library (@dnd-kit); simplify initial scope |
| Performance with large Flex JSON | Low | Medium | Virtualized tree view; debounce preview updates |
| State sync between builder and preview | Medium | High | Single source of truth; memoized selectors |
| Template migration from old tables | Low | Low | Keep old tables; create views or sync jobs |

---

## 9. File Structure Recommendations

```
src/
├── components/
│   ├── broadcasts/
│   │   ├── CreateBroadcastDialog.tsx      (modify)
│   │   ├── TemplateSelector.tsx           (modify)
│   │   ├── BroadcastList.tsx              (keep)
│   │   ├── MediaUploader.tsx              (new)
│   │   ├── SegmentSelector.tsx            (new)
│   │   └── CustomerPicker.tsx             (new)
│   ├── templates/
│   │   ├── BroadcastTemplateList.tsx      (new)
│   │   └── BroadcastTemplateDialog.tsx    (new)
│   └── flex/
│       ├── FlexPreview.tsx                (keep - move from inbox)
│       ├── FlexTemplateList.tsx           (new)
│       ├── FlexPresetTemplates.tsx        (new)
│       └── builder/
│           ├── FlexBuilder.tsx            (new - main orchestrator)
│           ├── FlexBuilderCanvas.tsx      (new)
│           ├── FlexComponentPalette.tsx   (new)
│           ├── FlexPropertyEditor.tsx     (new)
│           ├── FlexComponentTree.tsx      (new)
│           └── FlexJsonPanel.tsx          (new)
├── contexts/
│   └── FlexBuilderContext.tsx             (new)
├── hooks/
│   ├── use-broadcasts.ts                  (keep)
│   ├── use-flex-history.ts                (new)
│   └── use-flex-builder.ts                (new)
├── lib/
│   ├── flex-builder.ts                    (keep - rename to flex-presets.ts)
│   ├── flex-validator.ts                  (new)
│   ├── flex-component-templates.ts        (new)
│   └── template-utils.ts                  (keep)
├── types/
│   └── broadcast.ts                       (modify - add unified types)
└── app/
    └── api/
        └── inbox/
            ├── broadcasts/                (keep)
            └── broadcast-templates/       (new)
```

---

## 10. Summary

The inboxreya project has solid foundations for broadcasts and templates but lacks:

1. **Visual Flex Builder** - The critical UX gap
2. **Unified Template System** - Text/image/video/flex in one flow
3. **Target Selection** - Segment picker and manual selection
4. **Media Upload** - Image/video upload for broadcasts

The recommended approach is to:

1. **First** unify the template types and database model
2. **Then** build the Flex Builder incrementally (state → palette → DnD → polish)
3. **Finally** integrate everything into the broadcast creation flow

**Estimated effort:** 6-9 weeks for full UX/UI-max implementation with a 5-person team.

---

*End of Review Document*
