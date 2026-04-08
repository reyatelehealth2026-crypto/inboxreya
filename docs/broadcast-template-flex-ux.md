# Broadcast / Template / Flex Builder — UX & IA Draft

Status: working draft
Last updated: 2026-04-08
Scope: `inboxreya`

## 1. Product direction

The product should split this area into 3 connected workspaces:

1. **Broadcast Center**
2. **Template Center**
3. **Flex Builder**

The key UX decision is:

- **do not force everything into one modal**
- use the current dialog only for simple sends
- move rich creation/editing flows to full pages

## 2. Recommended route map

### Stable routes

- `/inbox/broadcasts` → Broadcast Center landing + current broadcast list
- `/inbox/broadcasts/campaigns` → campaign workspace
- `/inbox/broadcasts/template-center` → template management workspace
- `/inbox/broadcasts/flex-builder` → visual flex builder

### Optional future detail routes

- `/inbox/broadcasts/template-center/new`
- `/inbox/broadcasts/template-center/[id]`
- `/inbox/broadcasts/flex-builder/new`
- `/inbox/broadcasts/flex-builder/[id]`
- `/inbox/broadcasts/campaigns/[id]`

## 3. Information architecture

## 3.1 Broadcast Center

Purpose:
- create/send broadcasts
- browse previous broadcasts
- jump into template/flex workflows

Recommended sections on page:
- header + CTA
- workspace cards
- recent broadcasts list
- status filters
- quick stats

### Primary actions
- สร้าง Broadcast ใหม่
- เปิด Template Center
- เปิด Flex Builder
- ดู Campaigns

## 3.2 Template Center

Purpose:
- manage reusable templates for broadcast use

Tabs / filters:
- ทั้งหมด
- ข้อความ
- รูปภาพ
- Flex
- archived

List/table fields:
- template name
- type
- preview thumbnail
- category/tag
- updated at
- used count
- status

Actions:
- create
- edit
- duplicate
- archive
- test send
- open in flex builder

## 3.3 Flex Builder

Purpose:
- build/edit Flex messages visually

Layout recommendation: **3-panel editor**

- **left panel**: block palette + layer tree
- **center panel**: LINE-style preview
- **right panel**: property inspector

Top toolbar:
- back
- template name
- draft/published state
- undo / redo
- preview data
- switch `Visual / JSON`
- save
- test send

## 4. User flows

## Flow A — simple broadcast from existing template

1. เข้า `/inbox/broadcasts`
2. กดสร้าง broadcast
3. เลือก template
4. เลือก target
5. preview
6. ส่งทันที / ตั้งเวลา

## Flow B — create new text template

1. เข้า `/inbox/broadcasts/template-center`
2. กดสร้าง template
3. เลือกประเภท `text`
4. กรอก content + variables + category
5. preview
6. save draft / publish

## Flow C — create flex template visually

1. เข้า `/inbox/broadcasts/flex-builder`
2. เลือก preset หรือเริ่มว่าง
3. ลาก block ลง canvas
4. ปรับ property ด้านขวา
5. preview แบบ LINE
6. save as template
7. ใช้ template ใน broadcast

## Flow D — convert quick reply into broadcast template

1. เข้า Template Center
2. เลือก import from quick reply
3. map content/category/tags
4. save เป็น broadcast template ชนิด text

## 5. Flex Builder UX details

## 5.1 Left panel

### Block palette
- text
- image
- button
- separator
- spacer
- box
- hero preset
- footer CTA preset
- product card preset

### Layer tree
Show nested structure like:

- bubble
  - hero
  - header
  - body
    - box
      - text
      - text
  - footer
    - button

Actions per node:
- select
- duplicate
- delete
- move up/down
- lock

## 5.2 Center preview

Modes:
- mobile bubble preview
- carousel preview
- dark/light shell preview (optional later)

Need:
- quick refresh
- sample data binding
- overflow warnings

## 5.3 Right property panel

For each component type, expose only relevant controls.

### Text controls
- text
- color
- size
- weight
- wrap
- alignment
- margin

### Image controls
- URL / asset picker
- aspect ratio
- aspect mode
- size
- margin

### Button controls
- label
- action type
- uri/text/data
- style
- color
- height

### Box controls
- layout
- spacing
- padding
- background
- align items
- justify content
- border radius / border color (future)

## 6. Design principles

### Principle 1 — builder must be usable by non-technical staff

Visual mode should be the default.

### Principle 2 — advanced users must not get trapped

Always keep a JSON mode.

### Principle 3 — templates should feel reusable

Every finished flex should be savable as a template and reusable in broadcast flows.

### Principle 4 — preview should match send reality

Avoid fake previews that differ from payload output.

## 7. Suggested component breakdown

## Broadcast Center
- `BroadcastWorkspaceCards`
- `BroadcastCenterHeader`
- `BroadcastCreateEntry`
- `BroadcastRecentList`

## Template Center
- `BroadcastTemplateList`
- `BroadcastTemplateFilters`
- `BroadcastTemplateEditor`
- `BroadcastTemplatePreviewPanel`
- `BroadcastTemplateTypeBadge`

## Flex Builder
- `FlexBuilderLayout`
- `FlexComponentPalette`
- `FlexLayerTree`
- `FlexPropertyInspector`
- `FlexBuilderToolbar`
- `FlexBuilderCanvas`
- `FlexBuilderPreviewPane`
- `FlexJsonEditor`

## 8. MVP vs later

## MVP
- Broadcast Center landing
- Template Center scaffold
- Flex Builder scaffold
- template list + preview
- text/flex selection for broadcast
- JSON fallback for flex

## Later
- drag/drop nesting
- full asset manager
- reusable snippets
- publish workflow
- analytics per template
- team approval flow

## 9. Current scaffold status in repo

The repo already has basic workspace scaffolding now at:

- `src/app/inbox/broadcasts/page.tsx`
- `src/components/broadcasts/BroadcastWorkspaceCards.tsx`
- `src/app/inbox/broadcasts/campaigns/page.tsx`
- `src/app/inbox/broadcasts/template-center/page.tsx`
- `src/app/inbox/broadcasts/flex-builder/page.tsx`

This is a good base to keep evolving without breaking current quick-reply flows.
