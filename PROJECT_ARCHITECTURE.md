# โครงสร้างระบบ Re-Ya Project

เอกสารนี้สรุปโครงสร้างระบบทั้งหมดจากการวิเคราะห์โค้ดจริง แบ่งเป็น Frontend (Next.js Landing Page) และ Backend (PHP CRM Platform)

---

## 1. Frontend: Reya Landing Page (Next.js)

### 1.1 โครงสร้างไฟล์
```
reya-landing/
├── app/
│   ├── sections/
│   │   ├── HeroSection.tsx      # Hero section พร้อม CTA
│   │   ├── StatsSection.tsx     # สถิติ 13+ ปี, 10,000+ ลูกค้า
│   │   ├── ProductsSection.tsx  # แสดงสินค้า 6 รายการ
│   │   ├── WhySection.tsx       # จุดขาย 4 ข้อ
│   │   ├── TestimonialsSection.tsx # รีวิวลูกค้า 3 ราย
│   │   ├── OemSection.tsx       # บริการ OEM
│   │   └── Footer.tsx           # Footer พร้อม contact info
│   ├── globals.css              # Global styles + Tailwind
│   ├── layout.tsx               # Root layout + metadata
│   └── page.tsx                 # Main page (compose sections)
├── tailwind.config.js           # Tailwind configuration
├── package.json                 # Dependencies
└── dist/                        # Build output
```

### 1.2 Dependencies
| Package | Version | ใช้สำหรับ |
|---------|---------|-----------|
| next | ^14.0.0 | Framework |
| react | ^18.0.0 | UI Library |
| framer-motion | ^10.0.0 | Animations |
| lucide-react | ^0.300.0 | Icons |
| tailwindcss | ^3.4.0 | Styling |
| typescript | ^5.0.0 | Type Safety |

### 1.3 Design System
```javascript
// สีหลักจาก tailwind.config.js
colors: {
  primary: '#2D5A3D',    // เขียวธีมสมุนไพร
  cream: '#F5F0E8',      // ครีมพื้นหลัง
  gold: '#C9A962',       // ทองเน้น
  dark: '#2C2C2C',       // ตัวอักษรหลัก
  muted: '#6B6B6B'       // ตัวอักษรรอง
}

// Fonts
fontFamily: {
  heading: ['Prompt', 'sans-serif'],
  body: ['Sarabun', 'sans-serif']
}
```

### 1.4 Components หลัก

#### HeroSection
- Full-screen gradient background
- Floating animation elements
- Dual CTA buttons (ซื้อสบู่ / สนใจ OEM)
- Scroll indicator

#### ProductsSection
- Grid layout 3 columns (desktop)
- Product cards พร้อม hover effects
- 6 สูตรสบู่: อาโวคาโด, ชาร์โคล, ซัลเฟอร์, แคมูแคมู, กลูต้า, ไฮยาลูรอนิก

#### StatsSection
- 4 สถิติ: 13+ ปี, 10,000+ ลูกค้า, 50+ แบรนด์, GMP
- useInView animation

---

## 2. Backend: Re-Ya CRM Platform (PHP)

### 2.1 โครงสร้างไฟล์หลัก
```
inbox-master/re-ya/
├── *.php                        # 25+ page files
├── config/                      # Configuration
├── includes/                    # Shared components
│   ├── header.php
│   ├── footer.php
│   ├── components/
│   │   └── tabs.php            # Tab navigation component
│   └── ai-chat/
│   ├── broadcast/
│   ├── analytics/
│   └── accounting/
├── classes/                     # PHP Classes
└── *.sql                        # Migration files
```

### 2.2 Core Modules

#### 2.2.1 AI Chat System (`ai-chat.php`)
```php
// Consolidated page รวม 4 tabs:
- chat:     แชทกับ AI ทั่วไป
- chatbot:  ตั้งค่า AI Chatbot (OpenAI)
- settings: ตั้งค่า AI ตอบแชทอัตโนมัติ (Gemini)
- studio:   AI Studio (สร้างรูป, Flex, แคปชั่น, แปลภาษา)
```

#### 2.2.2 AI Studio (`ai-image.php`)
| Feature | Function |
|---------|----------|
| Chat | Gemini 2.0 Flash integration |
| Image Gen | Imagen 4.0 - สร้างรูปจาก prompt |
| Flex Builder | สร้าง LINE Flex Message ด้วย AI |
| Caption | สร้างแคปชั่นโซเชียลมีเดีย |
| Translate | แปลภาษา 5 ภาษา |

#### 2.2.3 Auto-Reply (`auto-reply.php`)
- 75,228 บรรทัด (ไฟล์ใหญ่สุด)
- รองรับ: keyword matching, Flex Message, Quick Reply
- Match types: contains, exact, starts_with, regex, all
- Features: Sender customization, Alt Text, Tags, Priority

#### 2.2.4 Admin Users (`admin-users.php`)
```php
// Role-based access control (RBAC)
$roleDefinitions = [
    'super_admin' => 'เจ้าของร้าน - เข้าถึงทุกอย่าง',
    'admin'       => 'ผู้ดูแลระบบ',
    'pharmacist'  => 'เภสัชกร - รับเคสแชท, Video Call',
    'staff'       => 'พนักงาน - จำกัดสิทธิ์',
    'marketing'   => 'การตลาด - Broadcast, Campaign',
    'tech'        => 'IT - API, Integrations'
];
```

#### 2.2.5 Appointments (`appointments-admin.php`)
- จัดการนัดหมายเภสัชกร
- Status flow: pending → confirmed → in_progress → completed
- รองรับ: cancellation, no_show, rating
- Filters: date, pharmacist, status, search

#### 2.2.6 Analytics (`analytics.php`)
```php
// 4 Tabs:
- overview:  ภาพรวมสถิติ (7/30/90 วัน)
- advanced:  วิเคราะห์ขั้นสูง (MVC pattern)
- crm:       CRM Analytics
- account:   สถิติแยกตามบอท
```

#### 2.2.7 Broadcast (`broadcast.php`)
```php
// 4 Tabs:
- send:      ส่งข้อความ Broadcast
- catalog:   Drag & Drop Catalog Builder
- products:  Broadcast สินค้า + Auto Tag
- stats:     สถิติ Broadcast
```

#### 2.2.8 Auto Tag Rules (`auto-tag-rules.php`)
| Trigger Type | คำอธิบาย |
|--------------|----------|
| follow | เมื่อ follow บอท |
| order_count | ตามจำนวน orders |
| total_spent | ตามยอดซื้อรวม |
| inactivity | ไม่มีกิจกรรม X วัน |
| birthday | วันเกิดเดือนนี้ |
| tier_upgrade | เมื่อเลื่อน Tier |
| point_milestone | สะสมแต้มครบ |
| video_call | ปรึกษาเภสัช |
| referral | แนะนำเพื่อน |

#### 2.2.9 Accounting (`accounting.php`)
```php
// Tab-based Accounting System
- dashboard: ภาพรวมบัญชี
- ap:        เจ้าหนี้การค้า (Account Payable)
- ar:        ลูกหนี้การค้า (Account Receivable)
- expenses:  ค่าใช้จ่าย
```

#### 2.2.10 Activity Logs (`activity-logs.php`)
```php
// Log types
$logTypes = [
    'auth'     => 'เข้าสู่ระบบ',
    'user'     => 'ผู้ใช้',
    'admin'    => 'แอดมิน',
    'data'     => 'ข้อมูล',
    'consent'  => 'ความยินยอม',
    'message'  => 'ข้อความ',
    'order'    => 'คำสั่งซื้อ',
    'pharmacy' => 'เภสัชกรรม',
    'ai'       => 'AI',
    'api'      => 'API',
    'system'   => 'ระบบ'
];
```

---

## 3. Database Schema (จาก SQL Files)

### 3.1 ตารางหลักที่พบจากโค้ด
```sql
-- Users/Customers
users (line_user_id, display_name, phone, email, created_at, updated_at)

-- LINE Integration
line_accounts (id, channel_id, channel_secret, access_token, gemini_api_key)

-- Appointments
appointments (id, user_id, pharmacist_id, appointment_date, appointment_time, status)

-- Auto-reply System
auto_replies (id, keyword, match_type, reply_type, reply_content, priority, is_active)

-- Tags
user_tags (id, name, color, line_account_id)
auto_tag_rules (id, tag_id, rule_name, trigger_type, conditions, is_active)

-- Accounting
account_payables, account_receivables, expenses

-- AI Settings
ai_settings (line_account_id, gemini_api_key, openai_api_key)

-- Activity Logging
activity_logs (id, type, action, description, admin_id, ip_address)
```

### 3.2 Migration Patterns
- ไฟล์ SQL แยกตาม feature: `fix_inbox_order.sql`, `update_custom_display_name.sql`
- การ update ข้อมูลเฉพาะทาง: UPDATE users SET display_name = '...' WHERE line_user_id = '...'

---

## 4. Integrations

### 4.1 LINE Platform
- LINE Messaging API (ส่งข้อความ, Broadcast)
- LINE Login
- LIFF (LINE Front-end Framework)
- Flex Message

### 4.2 AI Services
- **Gemini 2.0 Flash**: แชทบอท, แปลภาษา, สร้างแคปชั่น
- **Imagen 4.0**: สร้างรูปภาพ
- **OpenAI**: AI Chatbot (ตั้งค่าแยก)

### 4.3 Third-party
- Font Awesome (icons)
- Google Fonts (Prompt, Sarabun)
- Tailwind CSS (styling)

---

## 5. Architecture Patterns

### 5.1 Frontend (Next.js)
- **Page-based routing**: Each section = separate component
- **Client components**: 'use client' สำหรับ framer-motion
- **Tailwind + CSS Variables**: สีและ typography tokens
- **Responsive**: Mobile-first breakpoints

### 5.2 Backend (PHP)
- **Monolithic**: Single-page applications with tabs
- **Tab-based navigation**: ใช้ `includes/components/tabs.php`
- **Include pattern**: `include 'includes/xxx/content.php'`
- **Class-based utilities**: ActivityLogger, AutoTagManager, LineAPI
- **Session-based auth**: `$_SESSION['admin_user']`
- **RBAC**: Role-based access control 6 ระดับ

### 5.3 Database Access Pattern
```php
// Singleton Database Connection
$db = Database::getInstance()->getConnection();

// Prepared Statements
$stmt = $db->prepare("SELECT * FROM table WHERE id = ?");
$stmt->execute([$id]);
$result = $stmt->fetchAll(PDO::FETCH_ASSOC);
```

---

## 6. File Statistics

| ส่วน | จำนวนไฟล์ | บรรทัดโค้ด |
|-----|-----------|-------------|
| Frontend (TSX/TS/JS) | ~15 | ~906 |
| Backend (PHP) | 25+ | ~7,333 |
| SQL Migration | 5 | ~1,200+ |

### 6.2 ไฟล์ใหญ่สุดในระบบ
1. `auto-reply.php` - 75,228 บรรทัด
2. `ai-image.php` - 50,733 บรรทัด
3. `admin-users.php` - 48,417 บรรทัด

---

## 7. Security Considerations

จากการวิเคราะห์โค้ดพบ:
- ใช้ `htmlspecialchars()` สำหรับ output encoding
- Prepared statements สำหรับ database queries
- Session-based authentication
- CSRF protection ไม่ชัดเจนในทุกไฟล์
- Role-based access control (RBAC) มีการ implement

---

*สร้างเมื่อ: 1 มีนาคม 2026*
*วิเคราะห์จากโค้ดจริง ไม่อิงจากเอกสาร INITIAL.md*
