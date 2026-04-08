# Broadcast Templates + Flex Builder - Implementation Plan
## UX/UI-Max Feature Enhancement

**Created:** 2025-01-09
**Status:** Planning Phase

---

## Executive Summary

This plan outlines a phased approach to enhance the Broadcast feature with:
1. **Text/Image/Flex Template Management** - Centralized template library for broadcasts
2. **Visual Flex Builder** - Drag-and-drop interface for creating Flex Messages
3. **Template Reusability** - Share templates across broadcasts, quick replies, and campaigns

---

## Current State Analysis

### Existing Infrastructure

#### Database Models (Prisma)

| Model | Purpose | Status |
|-------|---------|--------|
| `flex_templates` | Store Flex Message JSON templates | ✅ Exists (id, name, category, flex_json, thumbnail_url) |
| `quick_reply_templates` | Text-based reply templates | ✅ Exists (content, shortcuts, variables) |
| `templates` | Generic templates (text/image/flex) | ✅ Exists (message_type, content) |
| `broadcast_message_v2` | Broadcast messages | ✅ Exists |

#### UI Components

| Component | Location | Status |
|-----------|----------|--------|
| `CreateBroadcastDialog` | `src/components/broadcasts/` | ✅ Basic template selector |
| `TemplateSelector` | `src/components/broadcasts/` | ✅ Lists templates by category |
| `FlexPreview` | `src/components/inbox/` | ✅ Renders Flex Messages |
| `QuickReplyTemplates` | `src/components/inbox/` | ✅ Text template management |

#### API Routes

| Route | Purpose | Status |
|-------|---------|--------|
| `/api/inbox/broadcasts` | CRUD broadcasts | ✅ Works |
| `/api/inbox/templates` | Quick reply templates | ✅ Works |
| `/api/inbox/catalog/flex-message` | Flex message generation | ✅ Exists |

#### Libraries

| Library | Purpose | Status |
|---------|---------|--------|
| `flex-builder.ts` | Product catalog Flex generation | ✅ Full-featured |
| `template-utils.ts` | Variable substitution | ✅ Basic |

### Gaps Identified

1. **No unified template management** - Three separate models with no clear relationship
2. **No visual Flex Builder** - Currently JSON-only input
3. **No broadcast-specific templates** - Using quick_reply_templates for broadcasts
4. **Limited template preview** - Only Flex, no text/image preview in broadcast dialog
5. **No template versioning** - Changes are immediate, no history
6. **No template categories hierarchy** - Flat category structure

---

## Phased Implementation Plan

### Phase 1: Unified Template Foundation (Week 1-2)
**Goal:** Consolidate template infrastructure for broadcasts

#### 1.1 Create Broadcast Template Model

**File:** `prisma/schema.prisma`

```prisma
model broadcast_templates {
  id              Int       @id @default(autoincrement())
  line_account_id Int
  name            String    @db.VarChar(255)
  description     String?   @db.Text
  
  // Template type: text, image, flex, video
  template_type   String    @default("text") @db.VarChar(50)
  
  // Content storage
  content         String?   @db.Text              // For text templates
  media_url       String?   @db.VarChar(500)      // For image/video
  flex_content    String?   @db.LongText          // JSON for Flex Messages
  
  // Metadata
  category        String?   @db.VarChar(100)
  tags            String?   @db.Text              // JSON array of tags
  variables       String?   @db.Text              // JSON array of variable names
  
  // Thumbnail for preview
  thumbnail_url   String?   @db.VarChar(500)
  
  // Stats
  use_count       Int       @default(0)
  last_used_at    DateTime? @db.DateTime(0)
  
  // Ownership
  created_by      Int?
  is_public       Boolean   @default(false)       // Share across accounts
  
  created_at      DateTime  @default(now()) @db.Timestamp(0)
  updated_at      DateTime  @default(now()) @db.Timestamp(0)
  
  @@index([line_account_id])
  @@index([template_type])
  @@index([category])
}
```

#### 1.2 Create Template API Routes

**Files to create:**

```
src/app/api/inbox/broadcast-templates/
├── route.ts                    # GET (list), POST (create)
├── [id]/
│   └── route.ts               # GET, PATCH, DELETE
├── categories/
│   └── route.ts               # GET categories list
└── stats/
    └── route.ts               # GET usage stats
```

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/inbox/broadcast-templates` | List templates (filter by type, category, search) |
| POST | `/api/inbox/broadcast-templates` | Create template |
| GET | `/api/inbox/broadcast-templates/[id]` | Get single template |
| PATCH | `/api/inbox/broadcast-templates/[id]` | Update template |
| DELETE | `/api/inbox/broadcast-templates/[id]` | Delete template |
| GET | `/api/inbox/broadcast-templates/categories` | Get all categories |
| POST | `/api/inbox/broadcast-templates/[id]/use` | Increment use count |

#### 1.3 Create Template Type Definitions

**File:** `src/types/broadcast-template.ts`

```typescript
export type TemplateType = 'text' | 'image' | 'flex' | 'video'

export interface BroadcastTemplate {
  id: number
  lineAccountId: number
  name: string
  description?: string
  templateType: TemplateType
  content?: string
  mediaUrl?: string
  flexContent?: FlexMessage
  category?: string
  tags: string[]
  variables: string[]
  thumbnailUrl?: string
  useCount: number
  lastUsedAt?: Date
  createdBy?: number
  isPublic: boolean
  createdAt: Date
  updatedAt: Date
}

export interface CreateTemplateInput {
  name: string
  description?: string
  templateType: TemplateType
  content?: string
  mediaUrl?: string
  flexContent?: FlexMessage
  category?: string
  tags?: string[]
  isPublic?: boolean
}
```

#### 1.4 Create React Query Hooks

**File:** `src/hooks/use-broadcast-templates.ts`

```typescript
export function useBroadcastTemplates(filters?: TemplateFilters)
export function useBroadcastTemplate(id: number)
export function useCreateBroadcastTemplate()
export function useUpdateBroadcastTemplate()
export function useDeleteBroadcastTemplate()
export function useTemplateCategories()
```

---

### Phase 2: Enhanced Template Selector (Week 2-3)
**Goal:** Improve template selection UX in broadcast dialog

#### 2.1 Upgrade TemplateSelector Component

**File:** `src/components/broadcasts/TemplateSelector.tsx`

**Enhancements:**
- [ ] Grid view with thumbnail previews
- [ ] Search with fuzzy matching
- [ ] Filter by type (text/image/flex)
- [ ] Filter by category
- [ ] Sort by: recent, most used, name
- [ ] Template preview on hover
- [ ] Quick create button for new templates
- [ ] Duplicate template action
- [ ] Template usage count display

**New Props:**

```typescript
interface TemplateSelectorProps {
  templates: BroadcastTemplate[]
  selectedTemplateId?: number
  onSelect: (template: BroadcastTemplate | null) => void
  viewType?: 'list' | 'grid'
  showPreview?: boolean
  allowCreate?: boolean
  filterTypes?: TemplateType[]
  defaultCategory?: string
}
```

#### 2.2 Create Template Preview Component

**File:** `src/components/broadcasts/TemplatePreview.tsx`

**Features:**
- Text preview: Display text in LINE-style bubble
- Image preview: Show image with dimensions
- Flex preview: Use existing FlexPreview component
- Video preview: Thumbnail with play icon

#### 2.3 Create Template Management Dialog

**File:** `src/components/broadcasts/TemplateManagementDialog.tsx`

**Features:**
- Create/Edit/Delete templates
- Type-specific editors:
  - Text: Rich text editor with variable support
  - Image: Upload + preview
  - Flex: JSON editor + visual builder link
- Category assignment
- Tag management
- Variable extraction
- Preview panel

---

### Phase 3: Visual Flex Builder (Week 3-5)
**Goal:** Drag-and-drop Flex Message creation

#### 3.1 Flex Builder Architecture

```
src/components/flex-builder/
├── FlexBuilder.tsx              # Main container
├── FlexCanvas.tsx               # Drop zone / preview
├── FlexToolbar.tsx              # Component palette
├── FlexPropertyPanel.tsx        # Property editor
├── FlexTreeNavigator.tsx        # Component tree view
├── components/
│   ├── BubbleEditor.tsx         # Bubble container editor
│   ├── BoxEditor.tsx            # Box layout editor
│   ├── TextEditor.tsx           # Text component editor
│   ├── ImageEditor.tsx          # Image component editor
│   ├── ButtonEditor.tsx         # Button editor
│   ├── SeparatorEditor.tsx      # Separator editor
│   └── SpacerEditor.tsx         # Spacer editor
├── hooks/
│   ├── useFlexBuilder.ts        # Builder state management
│   ├── useFlexDragDrop.ts       # Drag & drop logic
│   └── useFlexHistory.ts        # Undo/Redo
└── utils/
    ├── flexValidators.ts        # LINE Flex schema validation
    └── flexHelpers.ts           # Helper functions
```

#### 3.2 Flex Builder Component Structure

**Main Component:**

```tsx
// FlexBuilder.tsx
interface FlexBuilderProps {
  initialContent?: FlexMessage
  onChange: (content: FlexMessage) => void
  mode?: 'bubble' | 'carousel'
  readOnly?: boolean
}

export function FlexBuilder({ initialContent, onChange, mode = 'bubble' }: FlexBuilderProps) {
  // Builder state
  const [selectedComponent, setSelectedComponent] = useState<string | null>(null)
  const [zoom, setZoom] = useState(1)
  const [showGrid, setShowGrid] = useState(true)
  
  return (
    <div className="flex h-full">
      {/* Left: Component Palette */}
      <FlexToolbar />
      
      {/* Center: Canvas + Preview */}
      <FlexCanvas 
        selectedId={selectedComponent}
        onSelect={setSelectedComponent}
        zoom={zoom}
        showGrid={showGrid}
      />
      
      {/* Right: Property Panel */}
      <FlexPropertyPanel 
        selectedId={selectedComponent}
        onUpdate={handleUpdate}
      />
    </div>
  )
}
```

#### 3.3 Drag-and-Drop Component Palette

**Components to support:**

| Category | Components |
|----------|------------|
| Container | Bubble, Box |
| Content | Text, Image, Icon |
| Interactive | Button, Filler |
| Layout | Separator, Spacer |

**Palette UI:**

```tsx
// FlexToolbar.tsx
const PALETTE_COMPONENTS = [
  { type: 'box', icon: Box, label: 'Box', category: 'container' },
  { type: 'text', icon: Type, label: 'Text', category: 'content' },
  { type: 'image', icon: Image, label: 'Image', category: 'content' },
  { type: 'button', icon: MousePointer, label: 'Button', category: 'interactive' },
  { type: 'separator', icon: Minus, label: 'Separator', category: 'layout' },
  { type: 'spacer', icon: Space, label: 'Spacer', category: 'layout' },
  { type: 'filler', icon: Expand, label: 'Filler', category: 'layout' },
]
```

#### 3.4 Property Panel

**Context-aware property editor:**

```tsx
// FlexPropertyPanel.tsx
export function FlexPropertyPanel({ selectedId, onUpdate }) {
  const component = useComponent(selectedId)
  
  if (!component) return <EmptyState />
  
  switch (component.type) {
    case 'text':
      return <TextPropertyEditor component={component} onChange={onUpdate} />
    case 'image':
      return <ImagePropertyEditor component={component} onChange={onUpdate} />
    case 'box':
      return <BoxPropertyEditor component={component} onChange={onUpdate} />
    case 'button':
      return <ButtonPropertyEditor component={component} onChange={onUpdate} />
    // ... other types
  }
}
```

**Property Editors to create:**

| Editor | Properties |
|--------|------------|
| TextPropertyEditor | text, size, weight, color, align, wrap, maxLines, decoration |
| ImagePropertyEditor | url, size, aspectRatio, aspectMode, action |
| BoxPropertyEditor | layout, spacing, backgroundColor, cornerRadius, padding, borderWidth, borderColor |
| ButtonPropertyEditor | style, color, height, action (type, label, uri/data) |
| SeparatorPropertyEditor | color, margin |
| SpacerPropertyEditor | size |

#### 3.5 Canvas with Live Preview

**Features:**
- Real-time preview using FlexPreview component
- Click-to-select components
- Drag-to-reorder within containers
- Visual drop zones
- Zoom controls (50% - 200%)
- Grid overlay toggle
- Device frame toggle (iPhone / Android)

#### 3.6 Undo/Redo System

**File:** `src/components/flex-builder/hooks/useFlexHistory.ts`

```typescript
interface FlexHistoryState {
  past: FlexMessage[]
  present: FlexMessage
  future: FlexMessage[]
}

export function useFlexHistory(initialState: FlexMessage) {
  const [state, setState] = useState<FlexHistoryState>({
    past: [],
    present: initialState,
    future: [],
  })
  
  const undo = () => { /* ... */ }
  const redo = () => { /* ... */ }
  const push = (newPresent: FlexMessage) => { /* ... */ }
  
  return { state: state.present, undo, redo, push, canUndo, canRedo }
}
```

#### 3.7 Export & Save

- Export as JSON (LINE Flex Message format)
- Save as template
- Copy JSON to clipboard
- Preview in LINE app (via LINE Notify or test endpoint)

---

### Phase 4: Template Library UI (Week 5-6)
**Goal:** Dedicated template management page

#### 4.1 Template Library Page

**File:** `src/app/inbox/broadcast-templates/page.tsx`

**Features:**
- Dashboard view with stats
- Grid/List view toggle
- Advanced filters
- Bulk actions (delete, archive, change category)
- Import/Export templates
- Template folders/collections

#### 4.2 Template Categories Management

- CRUD categories
- Category icons
- Category colors
- Nested categories (future)

#### 4.3 Template Analytics

- Usage trends chart
- Most used templates
- Performance metrics (if tracking enabled)

---

### Phase 5: Integration & Polish (Week 6-7)
**Goal:** Seamless integration with existing features

#### 5.1 Integration Points

| Feature | Integration |
|---------|-------------|
| Broadcast Dialog | Use new template selector + Flex builder |
| Quick Reply | Option to save as broadcast template |
| Chat Reply | Insert template into conversation |
| Campaign | Use templates for campaign messages |

#### 5.2 Template Variables Enhancement

**Support for dynamic variables:**

```typescript
interface TemplateVariable {
  name: string
  type: 'text' | 'date' | 'number' | 'customer' | 'product'
  defaultValue?: string
  required: boolean
}

// Predefined variables
const SYSTEM_VARIABLES = [
  { name: 'customer_name', type: 'customer', description: 'ชื่อลูกค้า' },
  { name: 'customer_phone', type: 'customer', description: 'เบอร์โทร' },
  { name: 'current_date', type: 'date', description: 'วันที่ปัจจุบัน' },
  { name: 'current_time', type: 'date', description: 'เวลาปัจจุบัน' },
]
```

#### 5.3 Template Inheritance

- Base templates with overrides
- Seasonal variations
- A/B testing variants (future)

---

## Technical Decisions

### State Management

**Recommendation:** Zustand for Flex Builder state

```typescript
// stores/flex-builder-store.ts
interface FlexBuilderStore {
  content: FlexMessage
  selectedId: string | null
  history: FlexMessage[]
  historyIndex: number
  
  // Actions
  setContent: (content: FlexMessage) => void
  updateComponent: (id: string, updates: Partial<FlexComponent>) => void
  addComponent: (parentPath: string, component: FlexComponent) => void
  removeComponent: (id: string) => void
  moveComponent: (fromPath: string, toPath: string) => void
  
  // History
  undo: () => void
  redo: () => void
  
  // Selection
  select: (id: string | null) => void
}
```

### Drag and Drop

**Recommendation:** @dnd-kit/core

- Accessible
- No dependencies
- Good performance
- Flexible drop zones

### Validation

**Recommendation:** Zod + LINE Flex Message Schema

```typescript
// utils/flexValidators.ts
const FlexMessageSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('bubble'), ... }),
  z.object({ type: z.literal('carousel'), ... }),
])
```

---

## Database Migration Plan

### Step 1: Create New Table

```sql
CREATE TABLE broadcast_templates (
  id INT AUTO_INCREMENT PRIMARY KEY,
  line_account_id INT NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  template_type VARCHAR(50) DEFAULT 'text',
  content TEXT,
  media_url VARCHAR(500),
  flex_content LONGTEXT,
  category VARCHAR(100),
  tags TEXT,
  variables TEXT,
  thumbnail_url VARCHAR(500),
  use_count INT DEFAULT 0,
  last_used_at DATETIME,
  created_by INT,
  is_public BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_line_account (line_account_id),
  INDEX idx_template_type (template_type),
  INDEX idx_category (category)
);
```

### Step 2: Migrate Existing Data (Optional)

```sql
-- Migrate from flex_templates
INSERT INTO broadcast_templates (line_account_id, name, category, description, flex_content, thumbnail_url, use_count, created_by, created_at)
SELECT line_account_id, name, category, description, flex_json, thumbnail_url, use_count, created_by, created_at
FROM flex_templates;

-- Migrate from templates (text/image)
INSERT INTO broadcast_templates (line_account_id, name, category, template_type, content, media_url, created_at)
SELECT line_account_id, name, category, 
       CASE WHEN message_type = 'text' THEN 'text' ELSE 'image' END,
       content, content, created_at
FROM templates WHERE message_type IN ('text', 'image');
```

---

## Testing Strategy

### Unit Tests

- [ ] Template CRUD operations
- [ ] Variable substitution
- [ ] Flex JSON validation
- [ ] Component property updates

### Integration Tests

- [ ] Template selector in broadcast dialog
- [ ] Flex builder save to template
- [ ] Template usage in broadcast send

### E2E Tests

- [ ] Create text template → use in broadcast
- [ ] Create Flex template with builder → preview → use
- [ ] Search and filter templates

---

## Risk Assessment

| Risk | Impact | Mitigation |
|------|--------|------------|
| DB migration fails | High | Test on staging; backup before migration |
| Flex builder complexity | Medium | Start with basic components; iterate |
| Performance with large templates | Medium | Virtualize canvas; lazy load previews |
| LINE API spec changes | Low | Version lock Flex Message spec |

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Template creation time | < 2 minutes |
| Flex builder load time | < 1 second |
| Template reuse rate | > 60% |
| User satisfaction | > 4.5/5 |

---

## Timeline Summary

| Phase | Duration | Key Deliverables |
|-------|----------|------------------|
| 1. Unified Template Foundation | Week 1-2 | DB schema, API routes, types, hooks |
| 2. Enhanced Template Selector | Week 2-3 | Upgraded selector, preview, management dialog |
| 3. Visual Flex Builder | Week 3-5 | Full drag-drop builder |
| 4. Template Library UI | Week 5-6 | Dedicated management page |
| 5. Integration & Polish | Week 6-7 | Full integration, variables, testing |

---

## File Structure Summary

```
src/
├── app/
│   ├── api/inbox/broadcast-templates/
│   │   ├── route.ts
│   │   ├── [id]/route.ts
│   │   ├── categories/route.ts
│   │   └── stats/route.ts
│   └── inbox/
│       └── broadcast-templates/
│           └── page.tsx
├── components/
│   ├── broadcasts/
│   │   ├── TemplateSelector.tsx (upgrade)
│   │   ├── TemplatePreview.tsx (new)
│   │   ├── TemplateManagementDialog.tsx (new)
│   │   └── CreateBroadcastDialog.tsx (update)
│   └── flex-builder/
│       ├── FlexBuilder.tsx
│       ├── FlexCanvas.tsx
│       ├── FlexToolbar.tsx
│       ├── FlexPropertyPanel.tsx
│       ├── FlexTreeNavigator.tsx
│       └── components/
│           ├── BubbleEditor.tsx
│           ├── BoxEditor.tsx
│           ├── TextEditor.tsx
│           ├── ImageEditor.tsx
│           ├── ButtonEditor.tsx
│           ├── SeparatorEditor.tsx
│           └── SpacerEditor.tsx
├── hooks/
│   └── use-broadcast-templates.ts
├── stores/
│   └── flex-builder-store.ts
├── types/
│   └── broadcast-template.ts
└── lib/
    └── flex-validations.ts

prisma/
└── migrations/
    └── YYYYMMDD_add_broadcast_templates/
        └── migration.sql
```

---

## Next Steps

1. **Review & Approve Plan** - Get stakeholder sign-off
2. **Create Feature Branch** - `feature/broadcast-template-flex-builder`
3. **Phase 1 Kickoff** - Start with DB schema and API routes
4. **Weekly Check-ins** - Progress reviews and adjustments

---

*Last Updated: 2025-01-09*
