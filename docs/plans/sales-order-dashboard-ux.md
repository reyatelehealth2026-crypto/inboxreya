# Sales Order Dashboard - UX Optimized Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Dashboard จัดการออเดอร์ที่ใช้งานสะดวก รวดเร็ว และรองรับทุก Device

---

## 🎨 UX Design Principles

### 1. **Mobile-First Design** 📱
- Kanban 4 คอลัมน์ บน Desktop → **List View** บน Mobile
- Touch-friendly buttons (min 44px)
- Swipe to change status บน Mobile

### 2. **Power User Features** ⌨️
- **Keyboard Shortcuts:**
  - `Cmd/Ctrl + K` - Quick search
  - `Cmd/Ctrl + N` - สร้างออเดอร์ใหม่
  - `Arrow Keys` - Navigate between orders
  - `Enter` - Open detail
  - `E` - Edit order
  - `1-4` - Change status (1=PENDING, 2=PROCESSING, etc.)

### 3. **Quick Actions** ⚡
- **Right-click Context Menu:** เปลี่ยนสถานะเร็ว
- **Bulk Actions:** เลือกหลายออเดอร์ อัปเดตพร้อมกัน
- **Quick Filter:** กรองตามวัน/สัปดาห์/เดือน

### 4. **Smart Notifications** 🔔
- Toast notifications แทน Alert
- Sound notification (optional)
- Browser notification สำหรับออเดอร์ด่วน

---

## 🏗️ Layout Design

### Desktop (1200px+)
```
┌──────────────────────────────────────────────────────────────┐
│ 📦 Order Dashboard                                    [🔍] [+]│
├──────────────────────────────────────────────────────────────┤
│ 🔥 ติดตาม (5)  📄 ส่งบิล (3)  📞 ติดต่อ (2)  ⚠️ ปัญหา (1)    │
├──────────────────────────────────────────────────────────────┤
│ ┌──────────┬──────────┬──────────┬──────────┐ [Filters ▼]    │
│ │PENDING ⬇️│PROCESSING│ SHIPPED  │DELIVERED │                │
│ │   (12)   │   (8)    │   (15)   │   (45)   │                │
│ ├──────────┼──────────┼──────────┼──────────┤                │
│ │ [Order]  │ [Order]  │ [Order]  │ [Order]  │                │
│ │ [Order]  │ [Order]  │ [Order]  │ [Order]  │                │
│ │ [Order]  │          │          │ [Order]  │                │
│ └──────────┴──────────┴──────────┴──────────┘                │
└──────────────────────────────────────────────────────────────┘
```

### Tablet (768px - 1199px)
```
┌────────────────────────────────────────┐
│ 📦 Order Dashboard              [🔍]   │
├────────────────────────────────────────┤
│ [Queue Cards - 2x2 Grid]               │
├────────────────────────────────────────┤
│ [Horizontal Scroll Kanban]             │
│ ← PENDING | PROCESSING | SHIPPED | →   │
└────────────────────────────────────────┘
```

### Mobile (< 768px)
```
┌──────────────────────────┐
│ 📦 Orders           [🔍] │
├──────────────────────────┤
│ 🔥 ติดตาม 5     ▶       │
│ 📄 ส่งบิล 3      ▶       │
│ 📞 ติดต่อ 2      ▶       │
│ ⚠️ ปัญหา 1       ▶       │
├──────────────────────────┤
│ [Filter: ทั้งหมด ▼]     │
├──────────────────────────┤
│ ┌──────────────────────┐ │
│ │ #SO-001              │ │
│ │ ร้าน ABC    ฿5,000   │ │
│ │ ⏱️ รอดำเนินการ      │ │
│ └──────────────────────┘ │
│ ┌──────────────────────┐ │
│ │ #SO-002              │ │
│ │ ...                  │ │
│ └──────────────────────┘ │
└──────────────────────────┘
```

---

## 🎯 Enhanced Features

### 1. **Smart Order Card** 🎴
```
┌─────────────────────────────────────┐
│ 📌 #SO-2024-001        🕐 2ชม.ที่แล้ว│
│                                     │
│ 🏪 ข้ามโขงเอ็กซ์เพรส                │
│ 💰 ฿9,500  •  📦 5 รายการ          │
│                                     │
│ ┌─────────────────────────────────┐ │
│ │ ⚠️ สินค้า "ยาแก้ไอ" ใกล้หมด      │ │
│ └─────────────────────────────────┘ │
│                                     │
│ [🚚 จัดส่ง] [📄 บิล] [💬 LINE]     │
└─────────────────────────────────────┘
```

**Features:**
- Pin 📌 สำหรับออเดอร์สำคัญ
- Warning banner สินค้าใกล้หมด/ที่อยู่ไม่ชัด
- Drag handle (⋮⋮) สำหรับ Desktop
- Swipe gestures สำหรับ Mobile

### 2. **Collapsible Queue** 📋
```
┌─────────────────────────────────────┐
│ 📋 งานที่ต้องทำ           [▼]        │
├─────────────────────────────────────┤
│ 🔥 ติดตามออเดอร์              (5)   │
│ 📄 ส่งบิล/ใบเสร็จ             (3)   │
│ 📞 ติดต่อลูกค้า               (2)   │
│ ⚠️ แจ้งปัญหา                  (1)   │
└─────────────────────────────────────┘
          ↓ Click to collapse
┌─────────────────────────────────────┐
│ 📋 งานที่ต้องทำ           [▶]   (11)│
└─────────────────────────────────────┘
```

### 3. **Quick Search & Filter** 🔍
```
┌────────────────────────────────────────────────────────┐
│ 🔍 ค้นหาออเดอร์, ชื่อร้าน...              [🔥 ด่วน] [▼]│
├────────────────────────────────────────────────────────┤
│ กรอง: [วันนี้ ▼] [ทั้งหมด ▼] [เรียง: ใหม่สุด ▼]      │
└────────────────────────────────────────────────────────┘
```

**Filter Options:**
- **เวลา:** วันนี้, 7 วัน, 30 วัน, เดือนนี้, กำหนดเอง
- **สถานะ:** ทั้งหมด, รอดำเนินการ, กำลังจัดส่ง, สำเร็จ
- **เรียงลำดับ:** ใหม่สุด, เก่าสุด, มูลค่าสูงสุด, ด่วนที่สุด

### 4. **Context Menu (Right-click)** 🖱️
```
┌───────────────────────┐
│ 📋 ดูรายละเอียด       │
│ ✏️ แก้ไขออเดอร์       │
│ ━━━━━━━━━━━━━━━━━━━   │
│ 🚚 เปลี่ยนเป็น "จัดส่ง"│
│ ✅ เปลี่ยนเป็น "สำเร็จ"│
│ ━━━━━━━━━━━━━━━━━━━   │
│ 📄 ดาวน์โหลดบิล       │
│ 📞 โทรหาลูกค้า        │
│ 💬 ส่งข้อความ LINE    │
│ ━━━━━━━━━━━━━━━━━━━   │
│ 🏷️ ติดป้ายกำกับ       │
│ 📌 ปักหมุด           │
└───────────────────────┘
```

### 5. **Bulk Actions** ✓
```
┌─────────────────────────────────────────────────────────┐
│ ☑️ เลือกทั้งหมด (3)                          [Actions ▼]│
├─────────────────────────────────────────────────────────┤
│ ☑️ ┌──────────────┐                                   │
│    │ #SO-001      │                                   │
│    │ ร้าน ABC    │                                   │
│    └──────────────┘                                   │
│ ☑️ ┌──────────────┐                                   │
│    │ #SO-002      │                                   │
│    └──────────────┘                                   │
└─────────────────────────────────────────────────────────┘
```

**Actions:**
- เปลี่ยนสถานะเป็นชุด
- ส่งบิลทีเดียวหลายออเดอร์
- ติดป้ายกำกับ
- ลบ (ย้ายไปถังขยะ)

---

## 📱 Mobile Optimizations

### Swipe Gestures
```
┌──────────────────────────────┐
│ ← ปัดซ้าย: เปลี่ยนสถานะ        │
│                              │
│    ┌──────────────┐          │
│    │   Order      │          │
│    │   Card       │          │
│    └──────────────┘          │
│                              │
│ → ปัดขวา: Quick actions      │
└──────────────────────────────┘
```

### Pull to Refresh
- ลากลงเพื่อโหลดข้อมูลใหม่
- แสดง spinner ตอนโหลด

### Bottom Sheet (Mobile Detail)
```
┌──────────────────────────┐
│        ━━━━━ (drag)      │  ← ลากขึ้น
│ #SO-001                  │
│ ร้าน ABC                 │
│ 💰 ฿9,500                │
│                          │
│ [สถานะ ▼] [ส่งบิล] [โทร] │
└──────────────────────────┘
```

---

## 🗄️ Database Queries (Optimized)

### Query: Get Orders with Pagination
```typescript
// รองรับ infinite scroll
async function getOrders({
  status,
  page = 1,
  limit = 20,
  search,
  sortBy = 'date_desc',
  dateRange
}: GetOrdersParams) {
  // Implementation
}
```

### Query: Get Order Tasks (Smart)
```typescript
// คำนวณความเร่งด่วนอัตโนมัติ
async function getOrderTasks() {
  // 1. ติดตามออเดอร์: expected_delivery < NOW() AND status != 'delivered'
  // 2. ส่งบิล: is_paid = false AND status = 'delivered'
  // 3. ติดต่อลูกค้า: status = 'shipped' AND is_delivered = false > 3 days
  // 4. แจ้งปัญหา: issues from webhook_logs
}
```

---

## 🎨 Color Scheme & Design Tokens

```css
/* Status Colors */
--status-pending: #F59E0B;    /* Amber-500 */
--status-processing: #F97316; /* Orange-500 */
--status-shipped: #3B82F6;    /* Blue-500 */
--status-delivered: #22C55E;  /* Green-500 */
--status-cancelled: #6B7280;  /* Gray-500 */

/* Priority Colors */
--priority-high: #EF4444;     /* Red-500 */
--priority-medium: #F59E0B;   /* Amber-500 */
--priority-low: #3B82F6;      /* Blue-500 */

/* Shadows */
--card-shadow: 0 1px 3px rgba(0,0,0,0.1);
--card-shadow-hover: 0 4px 6px rgba(0,0,0,0.1);

/* Transitions */
--drag-transition: transform 200ms cubic-bezier(0.2, 0, 0, 1);
--status-transition: all 300ms ease;
```

---

## 🎯 Task Structure (Revised)

### Phase 1: Core (Tasks 1-3)
1. **Types & Queries** - Database + API routes
2. **Mobile List View** - สำคัญที่สุด (ใช้บ่อย)
3. **Desktop Kanban** - Drag-drop

### Phase 2: UX Features (Tasks 4-6)
4. **Quick Actions** - Context menu, keyboard shortcuts
5. **Smart Queue** - Auto-calculate tasks
6. **Search & Filter** - Global search, filters

### Phase 3: Polish (Tasks 7-8)
7. **Real-time** - Pusher, notifications
8. **Bulk Actions** - Multi-select

### Total: 120-150 minutes

---

## ✅ Pre-Launch Checklist

- [ ] ทดสอบบน Mobile (iOS Safari, Android Chrome)
- [ ] ทดสอบบน Tablet (iPad)
- [ ] ทดสอบ Keyboard shortcuts
- [ ] ทดสอบ Drag-drop บน Touch screen
- [ ] ทดสอบ Performance (100+ orders)
- [ ] ทดสอบ Real-time updates

---

**Plan updated:** `docs/plans/sales-order-dashboard-ux.md`

**Ready to execute?** 🚀
