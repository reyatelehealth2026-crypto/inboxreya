# 📸 Screenshot & Video Guide for REYA User Guide

**จุดประสงค์**: ช่วยให้เอกสาร REYA Guide มี visual content ชัดเจน

**ผู้รับผิดชอบ**: Admin / Training Team
**เวลาโดยประมาณ**: 3-4 ชั่วโมง (รูป) + 2-3 ชั่วโมง (วิดีโอ)

---

## 📋 Part 1: Screenshot Checklist

### ขั้นตอนการถ่ายรูป

```
1. เตรียมระบบ REYA
   □ Login ด้วย Test Account
   □ มี Sample Data (ลูกค้า 10+, Broadcasts 3+)
   □ Browser: Chrome (recommended)
   □ Resolution: 1920x1080 (Full HD)

2. สร้าง Folder เก็บรูป
   □ C:\Users\Administrator\inboxreya\screenshots\
   □ ตั้งชื่อไฟล์ชัดเจน: "01_login_page.png"

3. ถ่ายรูป + บันทึกลงไฟล์
   □ ไม่ต้องลบ Sensitive data (เป็น Test Account)
   □ เน้นส่วนที่สำคัญ (อย่า crop เกิน)
```

---

## 🎬 SECTION 1: LOGIN & DASHBOARD (3 Screenshots)

### 1.1 Login Page

**File**: `01_login_page.png`
**Location in Guide**: Line 20-31 (เข้าสู่ระบบ)
**Purpose**: แสดงหน้า Login

**ขั้นตอนถ่าย:**
```
1. ไปที่ https://reya.example.com
2. หยุดที่หน้า Login (ยังไม่ login)
3. ถ่ายรูปทั้งหน้า
   ✓ Username field
   ✓ Password field
   ✓ Sign In button
   ✓ "Forgot Password?" link
```

**ที่ใช้ใน Guide:**
- Line 26: `**[Screenshot: Login Page - username/password fields]**`

---

### 1.2 Dashboard Overview

**File**: `02_dashboard_overview.png`
**Location in Guide**: Line 71 (Dashboard - หน้าแรก)
**Purpose**: แสดง KPI cards + Menu ซ้าย

**ขั้นตอนถ่าย:**
```
1. Login → เข้า Dashboard
2. ถ่ายรูปหน้า Dashboard แบบ Full
   ✓ ด้านบน: KPI cards (Conversations, Customers, Unread, Response Time)
   ✓ ด้านซ้าย: Menu (Dashboard, Inbox, Customers, Tags, etc.)
   ✓ ด้านขวา: Graphs/Charts
```

**Annotations (เพิ่มเติม):**
- Label KPI cards ด้วยธรรมชาติ (หรือเพิ่มในคำอธิบาย)
- ชัดเจน: Numbers (124 conversations, 1,245 customers)

---

### 1.3 Dashboard KPI Detail

**File**: `03_dashboard_kpi_cards.png`
**Location in Guide**: Line 80-87 (สถิติด้านบน)
**Purpose**: Close-up KPI Cards

**ขั้นตอนถ่าย:**
```
1. Focus ที่ KPI cards ด้านบน
2. Zoom in / Crop เพื่อให้เห็นชัด
   ✓ 📱 Conversations: 124
   ✓ 👤 Customers: 1,245
   ✓ 📨 Unread: 18
   ✓ ⏱️ Response Time (avg): 8 นาที
```

---

## 🎬 SECTION 2: INBOX (6 Screenshots)

### 2.1 Inbox Overview

**File**: `04_inbox_overview.png`
**Location in Guide**: Line 144 (หน้า Inbox)
**Purpose**: แสดงโครงสร้าง Inbox (Left + Right panels)

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → Inbox
2. ถ่ายรูป Inbox ทั้งหน้า
   ✓ ด้านซ้าย: Customer list (John Unread, Sarah, Mike VIP, Lisa)
   ✓ ด้านขวา: Conversation window (ข้อความจาก John)
```

---

### 2.2 Open a Conversation

**File**: `05_inbox_click_customer.png`
**Location in Guide**: Line 203 (เปิดการสนทนา)
**Purpose**: แสดงการคลิกเลือกลูกค้า

**ขั้นตอนถ่าย:**
```
1. Inbox เปิด
2. Click ที่ "John" (ด้านซ้าย)
   ✓ Highlight ที่ row "John"
   ✓ ด้านขวา: ข้อความแสดงขึ้น
3. ถ่ายรูป (ให้เห็นการเลือก highlight)
```

---

### 2.3 Customer Profile Panel

**File**: `06_customer_profile_panel.png`
**Location in Guide**: Line 208-219 (Customer Profile)
**Purpose**: แสดง Profile modal/panel

**ขั้นตอนถ่าย:**
```
1. Inbox เปิด > เลือก John
2. ด้านขวาบน → คลิก 👤 "Customer Profile" button
3. Panel/Modal แสดง:
   ✓ ชื่อ: John
   ✓ เบอร์โทร / Email
   ✓ Tags: VIP, ติดตาม
   ✓ Last Purchase: [date & amount]
   ✓ Close button
```

---

### 2.4 Typing & Sending Message

**File**: `07_inbox_input_field.png`
**Location in Guide**: Line 242-254 (ตอบข้อความ)
**Purpose**: แสดง Input field + Send button + Template slash

**ขั้นตอนถ่าย:**
```
1. Inbox เปิด > เลือก John
2. Scroll ลงมาด้านล่าง
3. ถ่ายรูป Input area:
   ✓ Input field (มีข้อความ "ครับ มีจำนวนพอค่ะ")
   ✓ "Send" button (หรือ icon)
   ✓ "📎 Attach" button (ถ้ามี)
   ✓ "😊 Emoji" (ถ้ามี)
```

**Alternative**: Template dropdown
```
1. Type "/" ใน Input field
2. Template dropdown ปรากฏ:
   ✓ "สินค้าหมดหรือยัง"
   ✓ "ส่งรูปสินค้า"
   ✓ "ตอบลูกค้าใหม่"
3. ถ่ายรูป dropdown
```

---

### 2.5 Tag Button & Selection

**File**: `08_tag_selection_popup.png`
**Location in Guide**: Line 265-289 (ติด Tag)
**Purpose**: แสดง Tag popup

**ขั้นตอนถ่าย:**
```
1. Inbox > เลือก John
2. ด้านขวาบน → คลิก "🏷️ Tag" button
3. Popup/Dropdown ปรากฏ:
   ✓ List ของ Tags:
     - VIP (checkbox)
     - ติดตาม (checkbox)
     - ร้อน (checkbox)
     - ใหม่ (checkbox)
   ✓ "Done" / "Save" button
4. ถ่ายรูป popup
```

---

### 2.6 Status Dropdown (Closed)

**File**: `09_status_closed_dropdown.png`
**Location in Guide**: Line 357-375 (เปลี่ยน Status)
**Purpose**: แสดง Status change dropdown

**ขั้นตอนถ่าย:**
```
1. Inbox > เลือก John
2. ด้านขวาบน → คลิก "Status" dropdown
3. Options ปรากฏ:
   ✓ 🟢 Open
   ✓ 🟡 In Progress
   ✓ 🔵 Closed  ← เลือกอันนี้
   ✓ 🔴 Reopened
4. ถ่ายรูป dropdown
```

---

## 🎬 SECTION 3: TAGS & SEGMENTS (2 Screenshots)

### 3.1 Tags Menu

**File**: `10_tags_menu.png`
**Location in Guide**: Line 537 (Tags)
**Purpose**: แสดง Tags management page

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "🏷️ Tags"
2. Tags page แสดง:
   ✓ List ของ Tags ที่มี:
     - VIP (50 customers)
     - ติดตาม (25 customers)
     - ร้อน (15 customers)
     - เย็น (8 customers)
   ✓ "🆕 Create Tag" button
3. ถ่ายรูป ทั้งหน้า
```

---

### 3.2 Create Segment Modal

**File**: `11_create_segment_form.png`
**Location in Guide**: Line 564-593 (สร้าง Segment)
**Purpose**: แสดง Segment creation form

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "👥📊 Segments"
2. คลิก "🆕 Create Segment"
3. Form ปรากฏ:
   ✓ Name field: "Bangkok VIP"
   ✓ Condition fields:
     - [City] [=] [Bangkok]
     - [AND]
     - [Tag] [contains] [VIP]
   ✓ "Preview: จะได้ 45 ลูกค้า"
   ✓ "Save" button
4. ถ่ายรูป form
```

---

## 🎬 SECTION 4: TEMPLATES (3 Screenshots)

### 4.1 Templates List Page

**File**: `12_templates_list.png`
**Location in Guide**: Line 623 (Templates)
**Purpose**: แสดง Templates menu

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "📝 Templates"
2. Templates page แสดง:
   ✓ List ของ Templates:
     - "สินค้าหมดหรือยัง" (50 uses)
     - "ส่งรูปสินค้า" (25 uses)
     - "ตอบลูกค้าใหม่" (15 uses)
   ✓ "🆕 Create Template" button
   ✓ Each template: Edit, Delete buttons
3. ถ่ายรูป ทั้งหน้า
```

---

### 4.2 Template Editor

**File**: `13_template_editor.png`
**Location in Guide**: Line 649-665 (สร้างใหม่)
**Purpose**: แสดง Template creation/edit form

**ขั้นตอนถ่าย:**
```
1. Templates > "🆕 Create Template"
2. Form ปรากฏ:
   ✓ Template Name: "สินค้าหมดหรือยัง"
   ✓ Content area:
     "สวัสดีค่ะ {name}
      สินค้า {product}
      ราคา {price} บาท
      มีจำนวนพอค่ะ
      สั่งได้เลยค่ะ ⭐"
   ✓ Preview pane (ด้านขวา)
   ✓ "Save" button
3. ถ่ายรูป form
```

---

### 4.3 Template in Inbox (Slash)

**File**: `14_template_slash_dropdown.png`
**Location in Guide**: Line 706-725 (ใช้ Template)
**Purpose**: แสดง Slash dropdown ในขณะตอบ

**ขั้นตอนถ่าย:**
```
1. Inbox > เลือก John
2. Input field → พิมพ์ "/"
3. Dropdown ปรากฏ:
   ✓ "สินค้าหมดหรือยัง"
   ✓ "ส่งรูปสินค้า"
   ✓ "ตอบลูกค้าใหม่"
   ✓ [อื่น ๆ]
4. ถ่ายรูป dropdown
```

---

## 🎬 SECTION 5: BROADCASTS (4 Screenshots)

### 5.1 Broadcasts Main Page

**File**: `15_broadcasts_list.png`
**Location in Guide**: Line 750 (Broadcasts)
**Purpose**: แสดง Broadcasts menu

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "📢 Broadcasts"
2. Broadcasts page แสดง:
   ✓ List ของ Campaigns ที่ส่อนไปแล้ว:
     - "VIP - ของใหม่" (Apr 5, 2026)
     - "ลดราคา 50%" (Apr 4, 2026)
     - "ยินดี VIP" (Apr 3, 2026)
   ✓ "🆕 New Campaign" button
   ✓ Each campaign: Status, Date, Recipients, Stats
3. ถ่ายรูป ทั้งหน้า
```

---

### 5.2 Create Campaign Form (Part 1)

**File**: `16_create_campaign_form.png`
**Location in Guide**: Line 788-810 (สร้าง Campaign)
**Purpose**: แสดง Campaign creation - Name + Target

**ขั้นตอนถ่าย:**
```
1. Broadcasts > "🆕 New Campaign"
2. Form page 1 ปรากฏ:
   ✓ Name field: "VIP - ของใหม่"
   ✓ Target Audience section:
     [ ] All Customers
     [✓] By Tags
         └─ Select: VIP (50 customers)
     [ ] By Segments
     [ ] Custom
3. ถ่ายรูป form
```

---

### 5.3 Message Editor

**File**: `17_message_editor.png`
**Location in Guide**: Line 813-843 (เขียนข้อความ)
**Purpose**: แสดง Message content editor

**ขั้นตอนถ่าย:**
```
1. Broadcast form > Message section
2. Editor ปรากฏ:
   ✓ Message type: [Text] [Template] [Flex]
   ✓ Content area:
     "สวัสดีค่ะ!
      
      ของใหม่เข้ามาแล้ว:
      • Shirt Red (899 บาท)
      • Shirt Blue (899 บาท)
      
      สั่งเลยค่ะ ⭐"
   ✓ Character count
   ✓ "👁️ Preview" button
   ✓ "Clear" / "Template" options
3. ถ่ายรูป editor
```

---

### 5.4 Broadcast Preview

**File**: `18_broadcast_preview.png`
**Location in Guide**: Line 843-850 (Preview)
**Purpose**: แสดง Preview ของข้อความ

**ขั้นตอนถ่าย:**
```
1. Broadcast editor > คลิก "👁️ Preview"
2. Preview modal ปรากฏ:
   ✓ Mock-up ของ LINE message:
     "สวัสดีค่ะ!
      
      ของใหม่เข้ามาแล้ว:
      • Shirt Red (899 บาท)
      • Shirt Blue (899 บาท)
      
      สั่งเลยค่ะ ⭐"
   ✓ ความยาว: 150 characters
   ✓ "Close" / "Edit" buttons
3. ถ่ายรูป preview
```

---

## 🎬 SECTION 6: ANALYTICS (2 Screenshots)

### 6.1 Analytics Dashboard

**File**: `19_analytics_overview.png`
**Location in Guide**: Line 965 (Analytics)
**Purpose**: แสดง Analytics main page

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "📈 Analytics"
2. Analytics page แสดง:
   ✓ Date range selector (This Week)
   ✓ KPI cards:
     - Total Messages: 12,450
     - Conversations: 854
     - Avg Response Time: 8 min
     - Satisfaction: 94%
   ✓ Graphs:
     - Messages per Day (bar chart)
     - Response Time Distribution (pie chart)
3. ถ่ายรูป ทั้งหน้า
```

---

### 6.2 Broadcast Stats

**File**: `20_broadcast_stats.png`
**Location in Guide**: Line 925-950 (Broadcast Stats)
**Purpose**: แสดง Broadcast performance metrics

**ขั้นตอนถ่าย:**
```
1. Broadcasts > เลือก Campaign ที่ส่อนไปแล้ว (เช่น "VIP - ของใหม่")
2. Stats page แสดง:
   ✓ Campaign name: "VIP - ของใหม่"
   ✓ Sent date: Apr 5, 2026
   ✓ Metrics:
     - Sent: 50
     - Delivered: 48 (96%)
     - Opened: 42 (87%)
     - Clicked: 28 (58%)
     - Conversion: 12 (24%)
   ✓ Bar/pie chart
3. ถ่ายรูป stats
```

---

## 🎬 SECTION 7: AUTO-REPLY (1 Screenshot)

### 7.1 Auto-Reply Settings

**File**: `21_autoreply_settings.png`
**Location in Guide**: Line 1183-1220 (Auto-Reply)
**Purpose**: แสดง Auto-Reply configuration

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "⚙️ Settings"
2. ด้านขวา → "🤖 Auto-Reply"
3. Settings page แสดง:
   ✓ Toggle: [🟢 ON] / [🔴 OFF]
   ✓ Message field:
     "สวัสดีค่ะ {name}
      
      เรากำลังออกนอกที่ทำงานขณะนี้
      ตอบกลับให้เร็ว ๆ ในวันรุ่งขึ้นค่ะ
      
      ขอบคุณค่ะ 🙏"
   ✓ Schedule Time:
     - Start: 18:00
     - End: 09:00
     - Timezone: Asia/Bangkok
   ✓ "Save" button
4. ถ่ายรูป settings
```

---

## 🎬 SECTION 8: ADDITIONAL (2 Screenshots)

### 8.1 Settings Menu

**File**: `22_settings_general.png`
**Location in Guide**: Line 1461-1490 (Settings)
**Purpose**: แสดง Settings options

**ขั้นตอนถ่าย:**
```
1. Menu ซ้าย → "⚙️ Settings"
2. Settings page แสดง:
   ✓ Left sidebar menu:
     - General
     - Security
     - Notifications
     - Team (ถ้า Admin)
     - Auto-Reply
   ✓ Main panel: ตัวอย่าง General settings
     - Language: Thai
     - Timezone: Asia/Bangkok
3. ถ่ายรูป settings
```

---

### 8.2 Dashboard Sidebar Menu

**File**: `23_sidebar_menu.png`
**Location in Guide**: Line 100-113 (Menu)
**Purpose**: แสดง Menu ด้านซ้ายชัด

**ขั้นตอนถ่าย:**
```
1. ใดก็ได้หน้า REYA
2. ถ่ายรูปแค่ด้านซ้าย sidebar:
   ✓ 🏠 Dashboard
   ✓ 💬 Inbox
   ✓ 👥 Customers
   ✓ 🏷️ Tags
   ✓ 👥📊 Segments
   ✓ 📝 Templates
   ✓ 📢 Broadcasts
   ✓ 📈 Analytics
   ✓ 🤖 Auto-Reply
   ✓ 👨‍👩‍👧‍👦 Groups
   ✓ 🛒 Orders
   ✓ ⚙️ Settings
3. ถ่ายรูป ชัดเจน
```

---

## 📹 Part 2: Video Scripts

### Video Overview

```
Total Videos: 8 videos
Duration: ~3-5 minutes each (24-40 minutes total)
Format: MP4, 1080p, with subtitles (Thai)
Platform: YouTube / Internal Wiki
```

---

## 🎥 VIDEO 1: "Inbox Workflow - ตอบลูกค้าแบบ Pro"

**Duration**: 4 minutes
**Target**: Employees & Sales
**Location in Guide**: Section 3 (Inbox)

### Script:

```
[00:00-00:15] Intro
Voiceover: "สวัสดีค่ะ! วิดีโอนี้จะสอนวิธีตอบลูกค้าแบบ Pro ใน REYA"
Visual: Dashboard → Click Inbox

[00:15-00:45] Step 1: Open Inbox
Voiceover: "ขั้นที่ 1 เข้า Inbox และดูลูกค้า"
Visual: 
  - Menu ซ้าย > Inbox
  - List ลูกค้า (John, Sarah, Mike)
  - Status filter (All/Open/In Progress/Closed)

[00:45-01:15] Step 2: Select Customer + View Profile
Voiceover: "ขั้นที่ 2 เลือกลูกค้า สำคัญ! ต้องอ่าน Profile ก่อน"
Visual:
  - Click John (ด้านซ้าย)
  - Profile panel เปิด (Name, Phone, Tags, Purchase history)
  - Highlight: "VIP" tag

[01:15-02:00] Step 3: Answer Message
Voiceover: "ขั้นที่ 3 ตอบลูกค้า"
Visual:
  - Conversation window (John: "สินค้าหมดแล้วไหมคะ?")
  - Scroll down > Input field
  - Type answer: "มีจำนวนพอค่ะ"
  - Click Send button OR Press Ctrl+Enter

[02:00-02:30] Step 4: Use Template (faster!)
Voiceover: "ขั้นที่ 4 ใช้ Template ตอบเร็ว"
Visual:
  - Input field > Type "/"
  - Template dropdown ปรากฏ
  - Select "สินค้าหมดหรือยัง"
  - Variables auto-fill: {name}=John, {product}=Shirt

[02:30-03:00] Step 5: Tag Customer
Voiceover: "ขั้นที่ 5 ติด Tag เพื่อจัดหมวดหมู่"
Visual:
  - Top right > Click "🏷️ Tag" button
  - Tag popup ปรากฏ
  - Select "VIP" + "ร้อน"
  - Click Done

[03:00-03:30] Step 6: Change Status (Close)
Voiceover: "ขั้นที่ 6 ปิดการสนทนา"
Visual:
  - Top right > Click "Status" dropdown
  - Select "Closed"
  - Status changes to 🔵 Closed

[03:30-04:00] Tips & Outro
Voiceover: "Tips: ตอบวิคเลิก 30 นาที = ดี, ใช้ Template เพื่อเร็ว"
Visual: Summary overlay showing:
  - Response Time target: < 30 min
  - Use Templates: / key
  - Tag for organization
  - Close when done
Outro: "ลองเอง! หากมีคำถาม ถาม Support"
```

---

## 🎥 VIDEO 2: "Broadcasts - ส่งข้อความแบบ Batch ให้ลูกค้า"

**Duration**: 5 minutes
**Target**: Sales Team
**Location in Guide**: Section 7 (Broadcasts)

### Script:

```
[00:00-00:15] Intro
Voiceover: "วิดีโอนี้สอนวิธีส่อง Broadcast ใน REYA"
Visual: Broadcast icon animation

[00:15-00:45] What is Broadcast?
Voiceover: "Broadcast = ส่งข้อความเดียวให้หลายคน พร้อมกัน"
Visual:
  - 1 message → arrows → 50 customers
  - Example: "VIP - ของใหม่" ส่อนให้ VIP 50 คน

[00:45-01:15] Step 1: New Campaign
Voiceover: "ขั้นที่ 1 สร้าง Campaign ใหม่"
Visual:
  - Menu > Broadcasts
  - Click "🆕 New Campaign" button
  - Form page 1

[01:15-02:00] Step 2: Target Audience
Voiceover: "ขั้นที่ 2 เลือก Target (สำคัญ!)"
Visual:
  - Form > Target Audience section
  - Show 3 options:
    ☐ All Customers
    ☑ By Tags → Select "VIP" (50 customers)
    ☐ By Segments
  - Highlight: "50 customers" counter

[02:00-02:45] Step 3: Write Message
Voiceover: "ขั้นที่ 3 เขียนข้อความ"
Visual:
  - Message editor
  - Type example:
    "สวัสดีค่ะ!
     ของใหม่เข้ามาแล้ว
     • Shirt Red 899 บาท
     สั่งเลยค่ะ ⭐"
  - Show character count: "150 / 2000"

[02:45-03:15] Step 4: Preview
Voiceover: "ขั้นที่ 4 Preview ตรวจสอบก่อนส่อง"
Visual:
  - Click "👁️ Preview"
  - Preview modal ปรากฏ
  - Show: Message looks good? Link works? Emoji OK?
  - Checklist overlay

[03:15-03:45] Step 5: Send Now or Schedule
Voiceover: "ขั้นที่ 5 ส่อง เลือก Send Now หรือ Schedule"
Visual:
  - Send options:
    [✓] Send Now (ส่อนทันที)
    [ ] Schedule (ส่อนตามเวลา)
  - If Schedule: Set Date/Time picker
  - Click "Send"

[03:45-04:15] Step 6: Check Stats
Voiceover: "ขั้นที่ 6 ตรวจสอบผลลัพธ์"
Visual:
  - Broadcasts > Select Campaign "VIP - ของใหม่"
  - Stats ปรากฏ:
    Sent: 50
    Delivered: 48 (96%)
    Opened: 42 (87%) ✓ Good!
    Clicked: 28 (58%) ✓ Good!
    Conversion: 12 (24%) ✓ Great!

[04:15-05:00] Tips & Outro
Voiceover: "Tips: 
  1. ตรวจสอบ Target ให้ดี (ไม่ 0 ลูกค้า)
  2. Preview ก่อนส่อง
  3. ดูผล (Opened > 70%, Clicked > 40%)
  4. ปรับ Copy ถ้า Clicked ต่ำ"
Visual: Summary with tips overlay
Outro: "พร้อมส่อง Broadcast? ทำตามขั้นตอนลองดู!"
```

---

## 🎥 VIDEO 3: "Templates - ตอบเร็ว ๆ ด้วย Template"

**Duration**: 3 minutes
**Target**: Employees & Sales
**Location in Guide**: Section 6 (Templates)

### Script:

```
[00:00-00:15] Intro
Voiceover: "ต้องตอบลูกค้าเยอะ? ใช้ Template!"
Visual: Template icon animation

[00:15-00:45] What is Template?
Voiceover: "Template = แม่แบบตอบเร็ว เปลี่ยนข้อมูลสั้น ๆ ก็ได้"
Visual:
  - Example: {name} → John, Sarah, Mike
  - {product} → Shirt, Pants, Accessories
  - Template ใหญ่ → Fast response

[00:45-01:30] Create Template
Voiceover: "สร้าง Template:"
Visual:
  - Menu > Templates
  - Click "🆕 Create Template"
  - Fill name: "สินค้าหมดหรือยัง"
  - Write content with variables:
    "สวัสดีค่ะ {name}
     สินค้า {product} มีจำนวนพอค่ะ
     ราคา {price} บาท
     สั่งได้เลยค่ะ ⭐"
  - Click Save

[01:30-02:15] Use Template in Inbox
Voiceover: "ใช้ Template ขณะตอบลูกค้า:"
Visual:
  - Inbox > Select customer
  - Input field > Type "/"
  - Template dropdown ปรากฏ
  - Select "สินค้าหมดหรือยัง"
  - Template insert → {name} auto-fill
  - Modify if needed
  - Click Send

[02:15-03:00] Tips & Outro
Voiceover: "Tips:
  1. ชื่อ Template ให้ชัด
  2. ใช้ {variables} สำหรับ auto-fill
  3. Template ยาว ค่อย ๆ แต่ครบ
  4. Update ถ้าราคาเปลี่ยน"
Visual: Summary
Outro: "ใช้ Template บ่อยขึ้น → ตอบเร็ว → ลูกค้าพอใจ!"
```

---

## 🎥 VIDEO 4: "Tags vs Segments - ต่างกันยังไง?"

**Duration**: 3 minutes
**Target**: New Employees
**Location in Guide**: Section 5 (Tags & Segments)

### Script:

```
[00:00-00:20] Intro & Confusion
Voiceover: "Tags หรือ Segments? งง! วิดีโอนี้จะ explain"
Visual: Question mark animation, Tags ❌ Segments ❓

[00:20-01:00] Tags Explained
Voiceover: "Tags = ป้ายชื่อส่วนตัว ติดเมื่อตอบลูกค้า"
Visual:
  - Inbox > Select John
  - Click 🏷️ Tag
  - Tag popup ปรากฏ
  - Select "VIP" + "ร้อน" ← 1 คนได้หลาย Tags
  - Done

[01:00-01:40] Segments Explained
Voiceover: "Segments = กลุ่มลูกค้าตามเงื่อนไข สร้างล่วงหน้า"
Visual:
  - Menu > Segments
  - Click "🆕 Create Segment"
  - Name: "Bangkok VIP"
  - Conditions:
    [City] [=] [Bangkok] AND [Tag] [=] [VIP]
  - Preview: "จะได้ 45 ลูกค้า"
  - Save

[01:40-02:30] Comparison Table
Voiceover: "เปรียบเทียบ:"
Visual: Table shows side-by-side:

| ลักษณะ | Tags | Segments |
|---|---|---|
| สร้างเมื่อ | ขณะตอบ (Inbox) | ล่วงหน้า (Menu) |
| ใช้ | Tag คนต่อหน่วย | ส่อง Broadcast |
| 1 คน | หลายอัน (VIP+ร้อน) | หลาย Segment ถ้าตรง |
| ตัวอย่าง | VIP, ติดตาม | Bangkok, ซื้อเกิน 50K |

[02:30-03:00] Use Case
Voiceover: "ตัวอย่าง:
  ต้องส่องให้ VIP → ใช้ Tag ผ่าน Broadcast
  ต้องส่องให้ Bangkok VIP → ใช้ Segment!"
Visual: Decision flow arrow

Outro: "ตอนนี้ไม่งง แล้วใช่ไหม?"
```

---

## 🎥 VIDEO 5: "Dashboard - อ่านตัวเลข"

**Duration**: 2.5 minutes
**Target**: All Users
**Location in Guide**: Section 2 (Dashboard)

### Script:

```
[00:00-00:10] Intro
Voiceover: "Dashboard = หน้า Control Center"
Visual: Dashboard hero animation

[00:10-00:50] KPI Cards
Voiceover: "ดูตัวเลขสำคัญ:"
Visual:
  - 📱 Conversations: 124 (ทั้งหมด)
  - 👤 Customers: 1,245 (ลูกค้ารวม)
  - 📨 Unread: 18 (ต้องตอบ!)
  - ⏱️ Response Time: 8 นาที (ตอบเร็ว!)

[00:50-01:30] Charts
Voiceover: "ดูกราฟ:"
Visual:
  - Messages per Day (7 วัน)
    - Show bar chart: วันไหน เยอะสุด?
  - Response Time Distribution
    - Show pie: ตอบ < 5 min = 40%
  - Top customers
    - Show list: ใครคุยเยอะสุด?

[01:30-02:10] Targets (Team Lead)
Voiceover: "สำหรับ Lead/Admin:"
Visual:
  - Response Time: ต้อง < 30 min
  - Satisfaction: ต้อง > 90%
  - Unread: ไม่ควร > 50
  - Show green/yellow/red indicators

[02:10-02:30] Outro
Voiceover: "เช็ก Dashboard ตอนเข้าเลย! ดูว่า:
  1. มี unread ไหม? (ต้องตอบ!)
  2. Response Time พอไหม?
  3. Trend เพิ่มขึ้นไหม?"
Visual: Summary
```

---

## 🎥 VIDEO 6: "Analytics - เข้าใจผลลัพธ์"

**Duration**: 3 minutes
**Target**: Team Leads & Sales Managers
**Location in Guide**: Section 8 (Analytics)

### Script:

```
[00:00-00:15] Intro
Voiceover: "Analytics = รู้ผล แล้วปรับปรุง"
Visual: Analytics icon with chart

[00:15-00:50] Access Analytics
Voiceover: "เข้า Analytics:"
Visual:
  - Menu > Analytics
  - Page opens with:
    - Date range selector
    - KPI cards
    - Graphs

[00:50-01:30] Broadcast Stats
Voiceover: "ดูผล Broadcast:"
Visual:
  - Broadcasts > Select Campaign "VIP - ของใหม่"
  - Stats:
    Sent: 50 → Everyone got it?
    Delivered: 48 (96%) ✓
    Opened: 42 (87%) ✓ Good!
    Clicked: 28 (58%) ✓ Good!
    Conversion: 12 (24%) 🎉 Great!

[01:30-02:15] Interpretation
Voiceover: "วิเคราะห์:"
Visual: Interpretation guide:
  - Opened < 50%? → ข้อความไม่น่าสนใจ
  - Clicked < 30%? → Link ไม่ชัด/ราคาแพง
  - Conversion < 5%? → ลูกค้างหา competitor

[02:15-03:00] Improvement
Voiceover: "ปรับปรุง Broadcast ต่อไป:"
Visual:
  - Next campaign: ปรับ Copy
  - Test: A/B test messages
  - Track: ดู stats บ่อย ๆ

Outro: "Analytics = feedback ของลูกค้า!"
```

---

## 🎥 VIDEO 7: "Auto-Reply - ตอบเมื่อหยุด"

**Duration**: 2 minutes
**Target**: All Users
**Location in Guide**: Section 9 (Auto-Reply)

### Script:

```
[00:00-00:15] Intro & Why
Voiceover: "Auto-Reply = ตอบอัตโนมัติหลังเลิกงาน"
Visual: Clock showing 18:00 → Auto-Reply ON

[00:15-00:50] Enable Auto-Reply
Voiceover: "เปิด Auto-Reply:"
Visual:
  - Settings > Auto-Reply
  - Toggle: [OFF] → [ON]
  - Switch becomes green

[00:50-01:30] Set Message
Voiceover: "ตั้งข้อความ:"
Visual:
  - Message field:
    "สวัสดีค่ะ {name}
     เรากำลังออกนอกที่ทำงาน
     ตอบกลับเร็ว ๆ ในวันรุ่งขึ้นค่ะ
     ขอบคุณค่ะ 🙏"
  - Highlight: {name} auto-fill

[01:30-02:00] Schedule Time (Optional)
Voiceover: "เลือกเวลา (optional):"
Visual:
  - Schedule Time toggle: ON
  - Start: 18:00 (หลังเลิกงาน)
  - End: 09:00 (เข้างาน)
  - Click Save

[02:00-02:15] Outro
Voiceover: "เสร็จ! หลังเลิกงาน ลูกค้าจะได้ตอบอัตโนมัติ"
Visual: Timeline showing Auto-Reply trigger
```

---

## 🎥 VIDEO 8: "Setup Guide - วันแรก"

**Duration**: 4 minutes
**Target**: New Employees (Day 1)
**Location in Guide**: Section 13 (Checklist)

### Script:

```
[00:00-00:15] Intro
Voiceover: "วันแรกเข้า REYA? ทำตามนี้!"
Visual: Welcome animation

[00:15-00:45] Checklist Day 1
Voiceover: "วันแรก: Login + ดู Dashboard"
Visual: Checklist overlay:
  ☑ Login REYA ได้
  ☑ Explore Dashboard
  ☑ ตอบลูกค้า 5 คน ด้วย Template
  ☑ ติด Tag ลูกค้า (ทำความเข้าใจ)

Visual shows: Each step with video

[00:45-01:30] Checklist Day 2-3
Voiceover: "วันที่ 2-3: Inbox operations"
Visual:
  ☑ Assign งานให้คนอื่น
  ☑ เปลี่ยน Status (Close conversation)
  ☑ เขียน Template ใหม่
  ☑ ดู Analytics ของตัวเอง

[01:30-02:15] Checklist Week 1
Voiceover: "สัปดาห์แรก: Performance targets"
Visual:
  ☑ ตอบลูกค้า 50+ คน
  ☑ Response Time < 30 นาที
  ☑ Tag + Assign ปกติ
  ☑ Ask Lead หากมีคำถาม

[02:15-04:00] Tips Throughout
Voiceover: "Pro tips:
  1. Ctrl+K = ค้นหาเร็ว
  2. / = Template เร็ว
  3. Tab = ไปคน ต่อไป
  4. Ask Leader ไม่เก่า (ไม่ต้องห่วย)
  5. ตอบเร็ว = ลูกค้าพอใจ = คุณสวยใจ 😊"
Visual: Montage of features

Outro: "Good luck! หากมีคำถาม ติดต่อ Support"
```

---

## 📋 CHECKLIST FOR IMPLEMENTATION

### Pre-Production:

- [ ] Prepare test REYA account with sample data
- [ ] Set up REYA in a controlled environment (no real customer data visible)
- [ ] Install screen recording software (Camtasia, OBS, ScreenFlow)
- [ ] Test microphone & audio setup
- [ ] Create template for video editing (intro, outro, branding)

### Screenshots (1-2 hours):

- [ ] 01_login_page.png
- [ ] 02_dashboard_overview.png
- [ ] 03_dashboard_kpi_cards.png
- [ ] 04_inbox_overview.png
- [ ] 05_inbox_click_customer.png
- [ ] 06_customer_profile_panel.png
- [ ] 07_inbox_input_field.png
- [ ] 08_tag_selection_popup.png
- [ ] 09_status_closed_dropdown.png
- [ ] 10_tags_menu.png
- [ ] 11_create_segment_form.png
- [ ] 12_templates_list.png
- [ ] 13_template_editor.png
- [ ] 14_template_slash_dropdown.png
- [ ] 15_broadcasts_list.png
- [ ] 16_create_campaign_form.png
- [ ] 17_message_editor.png
- [ ] 18_broadcast_preview.png
- [ ] 19_analytics_overview.png
- [ ] 20_broadcast_stats.png
- [ ] 21_autoreply_settings.png
- [ ] 22_settings_general.png
- [ ] 23_sidebar_menu.png

### Videos (3-4 hours):

- [ ] Video 1: Inbox Workflow (4 min)
- [ ] Video 2: Broadcasts (5 min)
- [ ] Video 3: Templates (3 min)
- [ ] Video 4: Tags vs Segments (3 min)
- [ ] Video 5: Dashboard (2.5 min)
- [ ] Video 6: Analytics (3 min)
- [ ] Video 7: Auto-Reply (2 min)
- [ ] Video 8: Setup Guide (4 min)

### Post-Production:

- [ ] Add Thai subtitles to all videos
- [ ] Add intro/outro animations
- [ ] Add background music (non-copyrighted)
- [ ] Add text overlays (key points)
- [ ] Export as MP4 (1080p)
- [ ] Upload to YouTube / Internal Wiki
- [ ] Update Guide links

---

## 📌 File Naming Convention

### Screenshots:
```
Format: NN_section_name.png
Example: 04_inbox_overview.png

Organized by:
01-03: Login & Dashboard
04-09: Inbox
10-11: Tags & Segments
12-14: Templates
15-18: Broadcasts
19-20: Analytics
21-22: Auto-Reply & Settings
23: Menu
```

### Videos:
```
Format: VIDEO_NN_name.mp4
Example: VIDEO_01_Inbox_Workflow.mp4

Subtitles: VIDEO_01_Inbox_Workflow_TH.srt
```

---

## 🎬 Video Export Settings

```
Resolution: 1920 x 1080 (Full HD)
Frame Rate: 30 fps
Bitrate: 5-8 Mbps
Format: MP4 (H.264)
Audio: AAC, 128 kbps, 48 kHz
Subtitles: SRT format (Thai)
```

---

## 📝 Notes for Team

1. **Be consistent**: ใช้ Test Account เดียวกันตลอด
2. **Keep it professional**: ไม่ต้อง fancy แต่ให้ชัด
3. **Speak slowly**: ให้ subscribers ทันตามได้
4. **Add captions**: ลูกค้ากำลังรับชม > ต้องเสียง
5. **Test everything**: Preview ทั้งหมด ก่อน publish

---

**Ready to shoot? Let's go! 🎬📸**
