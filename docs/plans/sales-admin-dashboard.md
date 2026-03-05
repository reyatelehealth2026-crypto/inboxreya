# Sales Admin Daily Dashboard - Feature Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** สร้างหน้า Dashboard สำหรับ Sales Admin ที่ได้รับมอบหมายดูแลลูกค้า สามารถจัดการงานประจำวัน กำหนดธาตุประจำวัน และลากวิดเจ็ตลูกค้าเปลี่ยนสถานะได้

**Architecture:**
- **Layout:** Kanban-style board + Daily Focus Widget + Customer Profile Widgets
- **Drag & Drop:** @dnd-kit/core หรือ react-beautiful-dnd
- **State Management:** React useState/useReducer (local state) หรือ Zustand
- **Design System:** Data-Dense Dashboard (จาก ui-ux-pro-max)
  - Primary: #7C3AED (Purple)
  - Secondary: #A78BFA
  - CTA: #F97316 (Orange)
  - Background: #FAF5FF
  - Typography: Fira Code / Fira Sans

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, @dnd-kit/core, shadcn/ui

---

## 🎨 Design System (จาก ui-ux-pro-max)

```css
/* Colors */
--primary: #7C3AED;
--secondary: #A78BFA;
--cta: #F97316;
--bg: #FAF5FF;
--text: #4C1D95;

/* Typography */
font-family: 'Fira Code', 'Fira Sans', sans-serif;

/* Effects */
- Hover tooltips
- Smooth filter animations (150-300ms)
- Row highlighting on hover
- Data loading spinners
```

---

## Database Schema (ที่ต้องเพิ่ม/ใช้)

```sql
-- ตารางที่มีอยู่แล้ว (users)
-- ต้องเพิ่ม:

-- 1. Sales Admin Assignments
CREATE TABLE sales_assignments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  customer_id INT NOT NULL,
  assigned_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  priority ENUM('high', 'medium', 'low') DEFAULT 'medium',
  notes TEXT,
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- 2. Daily Focus / Tasks
CREATE TABLE daily_tasks (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  customer_id INT,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  status ENUM('todo', 'in_progress', 'done', 'follow_up') DEFAULT 'todo',
  due_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES users(id)
);

-- 3. Daily Element / Focus Theme
CREATE TABLE daily_focus (
  id INT AUTO_INCREMENT PRIMARY KEY,
  admin_id INT NOT NULL,
  focus_date DATE NOT NULL,
  element VARCHAR(50) NOT NULL, -- e.g., "follow_up", "new_leads", "retention"
  note TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_admin_date (admin_id, focus_date)
);
```

---

## 🎯 Features หลัก

### 1. Daily Focus Widget
- กำหนด "ธาตุประจำวัน" (Daily Element) เช่น:
  - 🔥 ติดตามลูกค้าเก่า (Follow-up)
  - 🌱 ลูกค้าใหม่ (New Leads)
  - 💎 รักษาฐานลูกค้า (Retention)
  - 📞 โทรติดตาม (Call Queue)
- แสดงเป็น Card ที่ด้านบน
- สามารถเปลี่ยนได้ทุกวัน

### 2. Kanban Board (Drag & Drop)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   TODO      │ IN PROGRESS │    DONE     │ FOLLOW UP   │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ [Customer   │ [Customer   │ [Customer   │ [Customer   │
│  Widget]    │  Widget]    │  Widget]    │  Widget]    │
│             │             │             │             │
│ [Customer   │ [Customer   │             │ [Customer   │
│  Widget]    │  Widget]    │             │  Widget]    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

### 3. Customer Profile Widget
```
┌─────────────────────┐
│  [รูปโปรไฟล์]       │
│  ชื่อร้านค้า        │
│  💰 ยอดซื้อสะสม    │
│  📞 เบอร์โทร        │
│  🏷️ VIP            │
│  [ปุ่มดูรายละเอียด] │
└─────────────────────┘
```

### 4. Quick Actions
- โทรหาลูกค้า (Click to call)
- ส่งข้อความ LINE
- บันทึก Note
- นัดหมาย

---

## Task Structure

### Task 1: Setup & Database Migration

**Files:**
- Create: `src/lib/sales/types.ts`
- Create: `prisma/migrations/add_sales_tables.sql`

**Steps:**
1. Create types for Sales Admin domain
2. Create SQL migration for new tables
3. Run migration on database
4. Commit

---

### Task 2: Database Queries

**Files:**
- Create: `src/lib/sales/queries.ts`
- Create: `src/lib/db.ts` (reuse existing)

**Queries:**
- `getAssignedCustomers(adminId)` - ดึงลูกค้าที่ถูก assign
- `getDailyTasks(adminId, date)` - ดึงงานประจำวัน
- `getDailyFocus(adminId, date)` - ดึงธาตุประจำวัน
- `updateTaskStatus(taskId, status)` - อัปเดตสถานะ
- `createDailyFocus(adminId, focus)` - สร้าง/อัปเดตธาตุประจำวัน

---

### Task 3: API Routes

**Files:**
- Create: `src/app/api/sales/customers/route.ts`
- Create: `src/app/api/sales/tasks/route.ts`
- Create: `src/app/api/sales/focus/route.ts`

**Endpoints:**
- `GET /api/sales/customers` - ลูกค้าที่ดูแล
- `GET /api/sales/tasks` - งานประจำวัน
- `POST /api/sales/tasks` - สร้างงานใหม่
- `PATCH /api/sales/tasks/:id` - อัปเดตสถานะ
- `GET /api/sales/focus` - ธาตุประจำวัน
- `POST /api/sales/focus` - ตั้งธาตุประจำวัน

---

### Task 4: Daily Focus Widget (ui-ux-pro-max)

**Files:**
- Create: `src/components/sales/DailyFocusWidget.tsx`

**Design:**
```typescript
// ใช้ Design System จาก ui-ux-pro-max
- Card style: bg-white, border border-purple-200
- Header: bg-gradient-to-r from-purple-600 to-purple-400
- Element selector: 4 options with icons
- Current focus: แสดง prominently
```

**Elements:**
- 🔥 Follow-up (Orange)
- 🌱 New Leads (Green)
- 💎 Retention (Purple)
- 📞 Call Queue (Blue)

---

### Task 5: Customer Profile Widget

**Files:**
- Create: `src/components/sales/CustomerWidget.tsx`

**Features:**
- รูปโปรไฟล์ (placeholder ถ้าไม่มี)
- ชื่อร้าน/ลูกค้า
- Badge: Tier (VIP, Gold, etc.)
- ยอดซื้อสะสม (formatted)
- Quick action buttons
- Hover: แสดงรายละเอียดเพิ่ม

---

### Task 6: Kanban Board with Drag & Drop

**Files:**
- Create: `src/components/sales/KanbanBoard.tsx`
- Create: `src/components/sales/KanbanColumn.tsx`
- Install: `@dnd-kit/core`, `@dnd-kit/sortable`

**Columns:**
1. **TODO** - งานที่ต้องทำ
2. **IN PROGRESS** - กำลังทำ
3. **DONE** - เสร็จแล้ว
4. **FOLLOW UP** - ติดตามต่อ

**Drag & Drop:**
- ลาก Customer Widget ระหว่าง columns
- อัปเดต status ใน database ทันที
- Animation smooth (150-300ms)

---

### Task 7: Main Sales Dashboard Page

**Files:**
- Create: `src/app/inbox/sales/dashboard/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: Sales Dashboard - [Date Picker]                 │
├─────────────────────────────────────────────────────────┤
│ Daily Focus Widget (Full Width)                         │
├─────────────────────────────────────────────────────────┤
│ Kanban Board                                            │
│ ┌──────────┬──────────┬──────────┬──────────┐          │
│ │  TODO    │IN PROGRESS│  DONE   │FOLLOW UP │          │
│ │ [Widgets]│ [Widgets] │[Widgets]│ [Widgets]│          │
│ └──────────┴──────────┴──────────┴──────────┘          │
└─────────────────────────────────────────────────────────┘
```

---

### Task 8: Add to Sidebar Menu

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Menu:**
- กลุ่ม: "งานขาย"
- เมนู: "Dashboard ลูกค้า" → `/inbox/sales/dashboard`

---

### Task 9: Integration & Testing

**Files:**
- Create: `tests/sales/dashboard.test.tsx`

**Test Cases:**
- Daily focus can be set
- Customer widgets display correctly
- Drag & drop updates status
- API endpoints work correctly

---

## Summary

### New Files:
1. Database: `prisma/migrations/add_sales_tables.sql`
2. Types: `src/lib/sales/types.ts`
3. Queries: `src/lib/sales/queries.ts`
4. APIs: `src/app/api/sales/*`
5. Components:
   - `DailyFocusWidget.tsx`
   - `CustomerWidget.tsx`
   - `KanbanBoard.tsx`
   - `KanbanColumn.tsx`
6. Page: `src/app/inbox/sales/dashboard/page.tsx`
7. Tests

### Dependencies to Install:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Total Tasks: 9
### Estimated Time: 60-90 minutes

---

## Execution Options

**Plan complete and saved to:** `docs/plans/sales-admin-dashboard.md`

**Two execution options:**

**1. Subagent-Driven** - Dispatch fresh subagent per task, review between tasks

**2. Parallel with existing** - Wait for Customer Analytics Dashboard to complete, then execute this

**Which approach?**
