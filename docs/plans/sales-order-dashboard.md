# Sales Order Dashboard - Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** สร้าง Dashboard จัดการออเดอร์สำหรับทีมขาย ติดตามสถานะ ส่งบิล และจัดการงานประจำวัน

**Architecture:**
- **Kanban Board:** PENDING → PROCESSING → SHIPPED → DELIVERED (ลากเปลี่ยนสถานะได้)
- **Order Queue:** งานที่ต้องทำ (ติดตามออเดอร์, ส่งบิล, ติดต่อลูกค้า, แจ้งปัญหา)
- **Real-time:** Pusher สำหรับอัปเดตสถานะออเดอร์แบบ Real-time
- **Data Source:** Odoo (odoo_orders, odoo_webhook_logs)

**Tech Stack:** Next.js 14, TypeScript, @dnd-kit/core (drag-drop), Recharts, MySQL2, Pusher

---

## 🎯 Features

### 1. Order Status Kanban Board 🏗️
```
┌──────────┬──────────┬──────────┬──────────┐
│ PENDING  │PROCESSING│ SHIPPED  │DELIVERED │
├──────────┼──────────┼──────────┼──────────┤
│ [Order   │ [Order   │ [Order   │ [Order   │
│  Card]   │  Card]   │  Card]   │  Card]   │
│          │          │          │          │
│ [Order   │ [Order   │          │ [Order   │
│  Card]   │  Card]   │          │  Card]   │
└──────────┴──────────┴──────────┴──────────┘
         ↑ Drag & Drop เปลี่ยนสถานะได้
```

**สถานะออเดอร์:**
- **PENDING** (รอดำเนินการ) - สีเหลือง
- **PROCESSING** (กำลังจัดเตรียม) - สีส้ม
- **SHIPPED** (จัดส่งแล้ว) - สีน้ำเงิน
- **DELIVERED** (ส่งสำเร็จ) - สีเขียว
- **CANCELLED** (ยกเลิก) - สีเทา

### 2. Order Queue (งานประจำวัน) 📋
```
┌─────────────────────────────────────┐
│ 📋 งานที่ต้องทำวันนี้              │
├─────────────────────────────────────┤
│ 🔥 ติดตามออเดอร์ (5)               │
│ 📄 ส่งบิล/ใบเสร็จ (3)              │
│ 📞 ติดต่อลูกค้า (2)                │
│ ⚠️ แจ้งปัญหา (1)                   │
└─────────────────────────────────────┘
```

**ประเภทงาน:**
| ไอคอน | ประเภท | คำอธิบาย |
|-------|--------|---------|
| 🔥 | ติดตามออเดอร์ | ออเดอร์ที่ยังไม่เสร็จเกินกำหนด |
| 📄 | ส่งบิล | ออเดอร์ที่ต้องส่งใบเสร็จ/กำกับภาษี |
| 📞 | ติดต่อลูกค้า | ต้องโทร/ส่งข้อความแจ้งสถานะ |
| ⚠️ | แจ้งปัญหา | สินค้าขาด, ที่อยู่ไม่ชัด, ฯลฯ |

### 3. Order Card Widget 🎴
```
┌─────────────────────────────┐
│ #SO-2024-001    🕐 10:30    │
│ ร้านข้ามโขงเอ็กซ์เพรส       │
│ 💰 ฿9,500                   │
│ 📦 5 รายการ                 │
│ 🏷️ PROCESSING               │
│                             │
│ [📄 ส่งบิล] [📞 โทร] [💬] │
└─────────────────────────────┘
```

**Quick Actions:**
- 📄 ส่งบิล/ใบเสร็จ (PDF)
- 📞 โทรหาลูกค้า
- 💬 ส่งข้อความ LINE
- 📝 ดูรายละเอียด
- ✏️ แก้ไขออเดอร์

### 4. Order Detail Modal 📄
```
┌─────────────────────────────────┐
│ ออเดอร์ #SO-2024-001        [X] │
├─────────────────────────────────┤
│ 👤 ข้ามโขงเอ็กซ์เพรส           │
│    📞 081-234-5678              │
│                                 │
│ 📦 รายการสินค้า                 │
│    - ยา A x 2 = ฿500           │
│    - ยา B x 1 = ฿800           │
│    ─────────────────           │
│    รวม: ฿9,500                 │
│                                 │
│ 🚚 ที่อยู่จัดส่ง               │
│    123 ถนนสุขุมวิท...          │
│                                 │
│ [อัปเดตสถานะ] [ส่งบิล]         │
└─────────────────────────────────┘
```

### 5. Real-time Updates ⚡
- อัปเดตสถานะออเดอร์แบบ Real-time ผ่าน Pusher
- แจ้งเตือนเมื่อมีออเดอร์ใหม่
- แจ้งเตือนเมื่อออเดอร์มีปัญหา

---

## 🗄️ Database Schema (Odoo Tables)

```sql
-- ตารางหลัก: odoo_orders
-- order_id, order_name, partner_id, customer_ref
-- amount_total, state, state_display
-- date_order, expected_delivery
-- is_paid, is_delivered
-- line_user_id

-- odoo_line_users - เชื่อม LINE User กับ Odoo Partner
-- line_user_id, odoo_partner_id, odoo_partner_name
-- odoo_customer_code, odoo_phone

-- odoo_webhook_logs - บันทึก events จาก Odoo
-- event_type, odoo_order_id, payload, processed
```

---

## 📁 File Structure

```
src/
├── app/
│   └── inbox/
│       └── orders/
│           └── dashboard/
│               ├── page.tsx           # Main Order Dashboard
│               ├── layout.tsx         # Order Dashboard Layout
│               └── loading.tsx        # Loading skeleton
│
├── components/
│   └── orders/
│       ├── KanbanBoard.tsx            # Drag-drop board
│       ├── KanbanColumn.tsx           # Status column
│       ├── OrderCard.tsx              # Order widget
│       ├── OrderQueue.tsx             # Daily tasks queue
│       ├── OrderDetailModal.tsx       # Order detail popup
│       ├── StatusBadge.tsx            # Status badge component
│       └── QuickActions.tsx           # Action buttons
│
├── lib/
│   └── orders/
│       ├── queries.ts                 # DB queries for orders
│       ├── types.ts                   # Order types
│       └── actions.ts                 # Server actions
│
└── hooks/
    └── use-orders.ts                  # React Query hooks
```

---

## 🎯 Task Structure

### Task 1: Types & Database Queries
**Files:**
- `src/lib/orders/types.ts`
- `src/lib/orders/queries.ts`

**Types:**
```typescript
interface Order {
  id: string;
  orderName: string;
  customerName: string;
  customerPhone: string;
  amount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  items: OrderItem[];
  createdAt: Date;
  expectedDelivery?: Date;
  isPaid: boolean;
  isDelivered: boolean;
}

interface OrderTask {
  id: string;
  type: 'follow_up' | 'send_bill' | 'contact' | 'issue';
  orderId: string;
  priority: 'high' | 'medium' | 'low';
  dueDate: Date;
}
```

**Queries:**
- `getOrdersByStatus(status)` - ดึงออเดอร์ตามสถานะ
- `getOrderTasks()` - ดึงงานที่ต้องทำ
- `updateOrderStatus(orderId, status)` - อัปเดตสถานะ
- `getOrderById(id)` - ดึงรายละเอียดออเดอร์

### Task 2: Kanban Board Components
**Files:**
- `src/components/orders/KanbanBoard.tsx`
- `src/components/orders/KanbanColumn.tsx`
- `src/components/orders/OrderCard.tsx`

**Features:**
- Drag & Drop ด้วย @dnd-kit/core
- 4 Columns (PENDING, PROCESSING, SHIPPED, DELIVERED)
- Order Card แสดงข้อมูลสำคัญ

### Task 3: Order Queue Component
**Files:**
- `src/components/orders/OrderQueue.tsx`

**Features:**
- แสดงงานแบ่งตามประเภท
- Badge แสดงจำนวน
- Click เพื่อกรองออเดอร์

### Task 4: Order Detail Modal
**Files:**
- `src/components/orders/OrderDetailModal.tsx`

**Features:**
- แสดงรายละเอียดออเดอร์
- รายการสินค้า
- ปุ่มอัปเดตสถานะ
- ปุ่มส่งบิล

### Task 5: Main Dashboard Page
**Files:**
- `src/app/inbox/orders/dashboard/page.tsx`

**Layout:**
```
┌──────────────────────────────────────────────────────┐
│ Header: Order Dashboard                [+ สร้างออเดอร์]│
├──────────────────────────────────────────────────────┤
│ Order Queue (4 cards)                                │
├──────────────────────────────────────────────────────┤
│ Kanban Board (4 columns)                             │
│ ┌──────────┬──────────┬──────────┬──────────┐       │
│ │ PENDING  │PROCESSING│ SHIPPED  │DELIVERED │       │
│ └──────────┴──────────┴──────────┴──────────┘       │
└──────────────────────────────────────────────────────┘
```

### Task 6: Sidebar Menu & Integration
**Files:**
- `src/components/layout/Sidebar.tsx` (update)

**Menu:**
- กลุ่ม "คำสั่งซื้อ"
  - จัดการออเดอร์ → `/inbox/orders/dashboard`

### Task 7: Real-time with Pusher
**Files:**
- `src/lib/pusher.ts`
- `src/hooks/use-orders.ts`

**Features:**
- Subscribe to order updates
- Auto-refresh on status change

---

## 🚀 Execution Plan

### Phase 1: Foundation (Tasks 1-2)
- Types, Database Queries
- Kanban Board structure
- **Time:** 30-40 min

### Phase 2: UI Components (Tasks 3-4)
- Order Queue, Order Detail
- **Time:** 40-50 min

### Phase 3: Integration (Tasks 5-7)
- Main page, Sidebar, Real-time
- **Time:** 20-30 min

### Total: 90-120 minutes

---

**Plan saved to:** `docs/plans/sales-order-dashboard.md`

**Ready to execute?** (Yes / Need adjustments)
