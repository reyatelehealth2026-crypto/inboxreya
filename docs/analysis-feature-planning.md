# 📋 สรุป Analysis & Feature Planning - inboxreya

**วันที่วิเคราะห์:** 3 มีนาคม 2026  
**Branch:** refactor/customer-odoo-components  
**Based on commit:** febedc6

---

## 1️⃣ Spec ที่มีอยู่ (จากเอกสารใน Repo)

### 🏗️ ระบบหลัก: LINE Telepharmacy CRM
- **ชื่อเต็ม:** LINE OA Manager
- **เป้าหมาย:** ระบบจัดการ LINE Official Account สำหรับร้านขายยา/เภสัชกร
- **รองรับ:** หลายบัญชี LINE OA + หลายผู้ใช้

### ✨ Features ที่มีแล้ว

#### สำหรับ Admin
- ✅ จัดการหลายบัญชี LINE OA
- ✅ จัดการผู้ใช้ระบบ (Admin/User)
- ✅ Dashboard รวมสถิติทุกบัญชี
- ✅ ดูและตอบข้อความลูกค้า
- ✅ Broadcast ข้อความ
- ✅ Auto-Reply
- ✅ ระบบร้านค้าออนไลน์
- ✅ Analytics และรายงาน

#### สำหรับ User ทั่วไป
- ✅ เชื่อมต่อ LINE OA ตัวเอง
- ✅ จัดการข้อความลูกค้า
- ✅ ส่ง Broadcast
- ✅ ตั้งค่าตอบกลับอัตโนมัติ
- ✅ จัดการสินค้าและคำสั่งซื้อ
- ✅ ตั้งค่าข้อความต้อนรับ
- ✅ ดูสถิติการใช้งาน

### 🎨 UI Components ที่มีแล้ว (จาก febedc6)
- ✅ **Sidebar Navigation** - 6 กลุ่มเมนู พร้อม collapsible
- ✅ **CustomerProfile** - โปรไฟล์ลูกค้า (refactored ล่าสุด)
- ✅ **OdooDashboardPanel** - Dashboard integration (refactored ล่าสุด)
- ✅ **InboxLayout** - Layout wrapper พร้อม sidebar
- ✅ **Group Chat** - แชทกลุ่ม (เพิ่มใหม่)

---

## 2️⃣ Tech Stack

```
Frontend:  Next.js + TypeScript + Tailwind CSS
Backend:   PHP API + Next.js API Routes
Database:  MySQL + Prisma ORM
Real-time: Pusher
External:  LINE Messaging API, Google Gemini AI, Telegram Bot
```

### โครงสร้างไฟล์หลัก
```
src/
├── components/
│   ├── inbox/           # CustomerProfile, OdooDashboardPanel
│   ├── groups/          # Group chat components
│   ├── layout/          # Sidebar, InboxLayout
│   ├── odoo/            # Odoo integration
│   └── ui/              # UI components
├── app/inbox/           # Next.js app routes
├── prisma/              # Database schema
└── scripts/             # Utility scripts
```

---

## 3️⃣ การวิเคราะห์โค้ดปัจจุบัน (febedc6)

### 🔧 ที่เพิ่ง Refactor (CustomerProfile + OdooDashboardPanel)
- ลบ unused imports
- ปรับ tab navigation ให้ชัดเจนขึ้น
- เพิ่ม userId prop ใน OdooDashboardPanel
- ลบ code ที่เกี่ยวกับ slips (อาจย้ายไปอยู่ที่อื่น)
- ปรับ rendering logic ให้ performant ขึ้น

### 📝 ไฟล์ที่ยังไม่ commit (current status)
1. `package.json` - modified
2. `scripts/get-daily-stats.ts` - untracked (ใหม่)

---

## 4️⃣ 🧠 Brainstorm: Feature Ideas ใหม่

### A. CRM Enhancement (จาก Ontology ที่มี)
```
✅ มี: CustomerProfile, Segments
💡 เพิ่มได้:
   - Customer Analytics Dashboard (แบบที่ทำ report ไป)
   - Customer Tier Management (VIP, Gold, Silver, Bronze)
   - Behavior Pattern Analysis (Frequent, Regular, Occasional Buyers)
   - Customer Lifetime Value tracking
```

### B. Marketing Automation (จาก marketing-psychology skill)
```
✅ มี: Broadcast, Auto-Reply
💡 เพิ่มได้:
   - Campaign Builder with psychology triggers
   - A/B Testing for messages (ใช้ mental models)
   - Customer Journey Mapping
   - Retention Campaigns (ใช้ Loss Aversion)
   - Upsell/Cross-sell suggestions (ใช้ Pareto Principle)
```

### C. Analytics & Reporting
```
✅ มี: Dashboard สถิติ
💡 เพิ่มได้:
   - Real-time sales report (แบบที่ generate ไฟล์ docx)
   - Customer Segment Report
   - Top Products Report
   - Order Pattern Analysis
   - Revenue Forecasting
```

### D. Inventory Management
```
✅ มี: คลังสินค้า, สินค้าใกล้หมด
💡 เพิ่มได้:
   - Auto-reorder suggestions
   - Stock prediction
   - Supplier Management
   - Purchase Order generation
```

### E. Integration Enhancements
```
✅ มี: LINE API, Odoo, Gemini AI
💡 เพิ่มได้:
   - AI-powered customer support (Gemini + Chat history)
   - Voice message transcription
   - Image recognition for prescriptions
   - Multi-channel (Facebook, Instagram)
```

---

## 5️⃣ 🎯 Priority Recommendations

### 🥇 P0 - High Impact, Low Effort
1. **Customer Analytics Dashboard**
   - ใช้ข้อมูลจาก database ที่มีอยู่
   - แสดงกราฟยอดขาย, กลุ่มลูกค้า, top products
   - ใช้ ui-ux-pro-max skill ออกแบบ

2. **Marketing Psychology Integration**
   - เพิ่ม templates สำหรับ broadcast (ใช้ persuasion techniques)
   - A/B testing framework สำหรับข้อความ

### 🥈 P1 - Medium Impact
3. **Automated Reporting**
   - สร้าง report อัตโนมัติ (weekly/monthly)
   - Export เป็น PDF/Excel/Word
   - ส่ง email ให้ admin

4. **Customer Tier System**
   - Implement VIP/Gold/Silver/Bronze logic
   - สิทธิพิเศษตาม tier
   - Auto-upgrade/downgrade

### 🥉 P2 - Future Enhancements
5. **AI-powered Features**
   - Chatbot ตอบคำถามอัตโนมัติ
   - วิเคราะห์ sentiment จากข้อความ
   - แนะนำสินค้าด้วย AI

6. **Multi-channel Support**
   - Facebook Messenger
   - Instagram DM
   - WhatsApp Business

---

## 6️⃣ 📝 Next Steps

### ถ้าต้องการสร้าง Implementation Plan:

**เลือก Feature:**
- [ ] Customer Analytics Dashboard
- [ ] Marketing Campaign Builder
- [ ] Automated Reporting System
- [ ] Customer Tier Management
- [ ] อื่นๆ (บอกมา)

**Workflow:**
1. ✅ Analysis (เสร็จแล้ว)
2. 🔄 Brainstorm (เสร็จแล้ว)
3. ⏳ Writing Plans (รอเลือก feature)
4. ⏳ Implementation (TDD + Subagent-driven)

---

## 7️⃣ 📎 References

- **System Architecture:** `SYSTEM_ARCHITECTURE.md`
- **Sidebar Docs:** `SIDEBAR_NAVIGATION_COMPLETE.md`
- **Recent Commit:** febedc6 (CustomerProfile + OdooDashboardPanel refactor)
- **Ontology Data:** มีข้อมูลลูกค้า 102 ราย พร้อม segments

---

**เตรียมโดย:** The Maestro (Kimi Claw)  
**วันที่:** 3 มีนาคม 2026
