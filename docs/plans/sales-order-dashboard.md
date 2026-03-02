# Sales Admin Order Management Dashboard - Feature Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** สร้างหน้า Dashboard สำหรับ Sales Admin จัดการออเดอร์ ติดตามสถานะ และส่งบิลให้ลูกค้า

**Architecture:**
- **Layout:** Kanban board ตามสถานะออเดอร์ + Order Queue + Quick Actions
- **Drag & Drop:** @dnd-kit/core - ลากออเดอร์เปลี่ยนสถานะ
- **Real-time:** Pusher (ใช้ที่มีอยู่แล้ว) สำหรับอัปเดตสถานะ
- **Design System:** Data-Dense Dashboard (จาก ui-ux-pro-max)
  - Primary: #7C3AED (Purple)
  - CTA: #F97316 (Orange)
  - Background: #FAF5FF
  - Typography: Fira Code / Fira Sans

**Tech Stack:** Next.js 14, TypeScript, Tailwind CSS, @dnd-kit/core, Pusher, shadcn/ui

---

## 🎨 Design System (จาก ui-ux-pro-max)

```css
/* Colors */
--primary: #7C3AED;
--secondary: #A78BFA;
--cta: #F97316;
--bg: #FAF5FF;
--text: #4C1D95;
--success: #22C55E;
--warning: #F59E0B;
--danger: #EF4444;

/* Typography */
font-family: 'Fira Code', 'Fira Sans', sans-serif;

/* Effects */
- Hover tooltips
- Smooth transitions (150-300ms)
- Row highlighting on hover
- Status badges with colors
```

---

## 🎯 Features หลัก

### 1. Order Queue (งานที่ต้องทำวันนี้)
```
┌─────────────────────────────────────┐
│ 📋 งานประจำวัน          [+ สร้าง]  │
├─────────────────────────────────────┤
│ 🔥 ติดตามออเดอร์ (5)                │
│ 📄 ส่งบิลรอออเดอร์ (3)              │
│ 📞 ติดต่อลูกค้า (2)                 │
│ ⚠️ ออเดอร์มีปัญหา (1)               │
└─────────────────────────────────────┘
```

**ประเภทงาน:**
- 🔥 **ติดตามออเดอร์** - ออเดอร์ที่ยังไม่เสร็จ ต้องติดตาม
- 📄 **ส่งบิล** - ออเดอร์ที่ต้องส่งใบเสร็จ/ใบกำกับภาษี
- 📞 **ติดต่อลูกค้า** - ต้องโทร/ส่งข้อความแจ้งลูกค้า
- ⚠️ **ออเดอร์มีปัญหา** - สินค้าขาด, ที่อยู่ไม่ชัด, etc.

### 2. Kanban Board (จัดการออเดอร์)
```
┌─────────────┬─────────────┬─────────────┬─────────────┐
│   PENDING   │  PROCESSING │   SHIPPED   │  DELIVERED  │
├─────────────┼─────────────┼─────────────┼─────────────┤
│ [Order      │ [Order      │ [Order      │ [Order      │
│  Widget]    │  Widget]    │  Widget]    │  Widget]    │
│             │             │             │             │
│ [Order      │ [Order      │             │ [Order      │
│  Widget]    │  Widget]    │             │  Widget]    │
└─────────────┴─────────────┴─────────────┴─────────────┘
```

**Drag & Drop:** ลากออเดอร์เปลี่ยนสถานะได้

### 3. Order Widget
```
┌─────────────────────────────────┐
│ #ORD-2024-001    🕐 10:30 AM   │
├─────────────────────────────────┤
│ 👤 ร้านยาสมชาย                  │
│ 📞 081-234-5678                │
│                                 │
│ 💊 สินค้า: 5 รายการ            │
│ 💰 ฿2,500                      │
│                                 │
│ 🏷️ สถานะ: PROCESSING          │
│                                 │
│ [📄 ส่งบิล] [📞 โทร] [💬 LINE]│
└─────────────────────────────────┘
```

**Quick Actions:**
- 📄 ส่งบิล/ใบเสร็จ
- 📞 โทรหาลูกค้า
- 💬 ส่งข้อความ LINE
- 📝 ดูรายละเอียด
- ✏️ แก้ไขออเดอร์

### 4. Order Detail Modal
```
┌─────────────────────────────────┐
│ ออเดอร์ #ORD-2024-001      [X] │
├─────────────────────────────────┤
│ 👤 ข้อมูลลูกค้า                │
│    ร้านยาสมชาย                 │
│    081-234-5678                │
│                                 │
│ 📦 รายการสินค้า                │
│    - ยา A x 2 = ฿500          │
│    - ยา B x 1 = ฿800          │
│    - ยา C x 3 = ฿1,200        │
│    ─────────────────          │
│    รวม: ฿2,500                │
│                                 │
│ 🚚 ที่อยู่จัดส่ง               │
│    123 ถนนสุขุมวิท...         │
│                                 │
│ [อัปเดตสถานะ] [ส่งบิล]        │
└─────────────────────────────────┘
```

---

## Task Structure

### Task 1: Database Schema & Types

**Files:**
- Create: `src/lib/orders/types.ts`

**Types:**
```typescript
interface Order {
  id: string;
  orderNumber: string;
  customerId: number;
  customerName: string;
  customerPhone: string;
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  createdAt: Date;
  updatedAt: Date;
}

interface OrderTask {
  id: string;
  orderId: string;
  type: 'follow_up' | 'send_bill' | 'contact_customer' | 'issue';
  priority: 'high' | 'medium' | 'low';
  status: 'todo' | 'done';
  dueDate: Date;
  notes?: string;
}
```

---

### Task 2: Database Queries

**Files:**
- Create: `src/lib/orders/queries.ts`

**Queries:**
- `getOrdersByStatus(status)` - ดึงออเดอร์ตามสถานะ
- `getOrdersByAdmin(adminId)` - ดึงออเดอร์ที่ admin ดูแล
- `getOrderTasks(adminId, date)` - ดึงงานที่ต้องทำ
- `updateOrderStatus(orderId, status)` - อัปเดตสถานะ
- `createOrderTask(task)` - สร้างงานใหม่

---

### Task 3: API Routes

**Files:**
- Create: `src/app/api/orders/route.ts`
- Create: `src/app/api/orders/[id]/route.ts`
- Create: `src/app/api/orders/tasks/route.ts`

---

### Task 4: Order Queue Widget

**Files:**
- Create: `src/components/orders/OrderQueueWidget.tsx`

**Features:**
- แสดงจำนวนงานแต่ละประเภท
- Click เพื่อกรอง Kanban
- Badge แสดงจำนวน

---

### Task 5: Order Widget (Kanban Card)

**Files:**
- Create: `src/components/orders/OrderWidget.tsx`

**Features:**
- ข้อมูลออเดอร์สรุป
- Quick action buttons
- Draggable (dnd-kit)

---

### Task 6: Kanban Board with Drag & Drop

**Files:**
- Create: `src/components/orders/KanbanBoard.tsx`
- Create: `src/components/orders/KanbanColumn.tsx`
- Install: `@dnd-kit/core`, `@dnd-kit/sortable`

**Columns:** PENDING → PROCESSING → SHIPPED → DELIVERED

---

### Task 7: Order Detail Modal

**Files:**
- Create: `src/components/orders/OrderDetailModal.tsx`

**Features:**
- แสดงรายละเอียดออเดอร์
- รายการสินค้า
- อัปเดตสถานะ
- ส่งบิล

---

### Task 8: Main Order Dashboard Page

**Files:**
- Create: `src/app/inbox/orders/dashboard/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: Order Dashboard - [Date] - [Create Order]       │
├─────────────────────────────────────────────────────────┤
│ Order Queue Widget (4 columns)                          │
├─────────────────────────────────────────────────────────┤
│ Kanban Board (4 columns)                                │
└─────────────────────────────────────────────────────────┘
```

---

### Task 9: Add to Sidebar

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

**Menu:**
- กลุ่ม: "คำสั่งซื้อ"
- เมนู: "จัดการออเดอร์" → `/inbox/orders/dashboard`

---

### Task 10: Real-time with Pusher

**Files:**
- Create: `src/lib/pusher.ts` (reuse existing)
- Modify: `src/components/orders/KanbanBoard.tsx`

**Features:**
- Subscribe to order updates
- Auto-refresh when order status changes

---

## Summary

### New Files:
1. Types: `src/lib/orders/types.ts`
2. Queries: `src/lib/orders/queries.ts`
3. APIs: `src/app/api/orders/*`
4. Components:
   - `OrderQueueWidget.tsx`
   - `OrderWidget.tsx`
   - `KanbanBoard.tsx`
   - `KanbanColumn.tsx`
   - `OrderDetailModal.tsx`
5. Page: `src/app/inbox/orders/dashboard/page.tsx`

### Dependencies:
```bash
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

### Total Tasks: 10
### Estimated Time: 60-90 minutes

---

## Execution Options

**Plan complete and saved to:** `docs/plans/sales-order-dashboard.md`

**Options:**
1. **Subagent-Driven** - Dispatch fresh subagent per task
2. **Parallel with Analytics** - Run both simultaneously
3. **Wait for Analytics** - Finish first dashboard, then this

**Which approach?**
