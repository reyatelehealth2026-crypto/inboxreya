# AI-Powered Sales & Complaint Analytics Dashboard - Feature Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** สร้าง Dashboard วิเคราะห์ยอดขาย และข้อความเชิงบ่นจากลูกค้า โดยใช้ Gemini AI

**Architecture:**
- **Sales Analytics:** Line/Bar charts แสดงยอดขายรายวัน/เดือน/ปี
- **AI Sentiment Analysis:** ใช้ Gemini วิเคราะห์ messages จากลูกค้า
- **Complaint Detection:** จับ keywords เชิงบ่น + หมวดหมู่ (สินค้า, ส่งของ, ราคา)
- **Customer Risk Score:** ลูกค้าที่มีแนวโน้มร้องเรียน/เลิกใช้บริการ
- **Design:** Data-Dense Dashboard (จาก ui-ux-pro-max)

**Tech Stack:** Next.js 14, TypeScript, Recharts, Google Gemini API, MySQL2

---

## 🎯 Features

### 1. Sales Chart Section 📈
```
┌─────────────────────────────────────────┐
│ 📈 ยอดขาย (รายวัน/เดือน/ปี)            │
│                                         │
│  Line Chart: Revenue over time          │
│  - Filter: 7 วัน / 30 วัน / 12 เดือน   │
│  - Compare: เดือนปัจจุบัน vs ที่แล้ว   │
└─────────────────────────────────────────┘
```

### 2. AI Sentiment Analysis 🤖
```
┌─────────────────────────────────────────┐
│ 🤖 วิเคราะห์อารมณ์ลูกค้า (AI)           │
│                                         │
│  Donut Chart:                           │
│  😊 พอใจ (65%)                          │
│  😐 เฉยๆ (25%)                          │
│  😠 ไม่พอใจ (10%)                       │
│                                         │
│  [วิเคราะห์ล่าสุด: 2 ชม. ที่แล้ว]      │
└─────────────────────────────────────────┘
```

### 3. Complaint Categories ⚠️
```
┌─────────────────────────────────────────┐
│ ⚠️ หมวดหมู่ปัญหาที่พบบ่อย               │
│                                         │
│  Bar Chart:                             │
│  📦 ส่งของช้า (45%)                     │
│  📦 สินค้าขาด (30%)                     │
│  💰 ราคาแพง (15%)                       │
│  🔧 คุณภาพ (10%)                        │
└─────────────────────────────────────────┘
```

### 4. Recent Complaints Alert 🚨
```
┌─────────────────────────────────────────┐
│ 🚨 ข้อความเชิงบ่นล่าสุด (AI Detected)   │
│                                         │
│  1. ร้านค้า A - "ส่งช้ามาก 3 วันแล้ว" │
│     ⚠️ Category: ส่งของช้า              │
│     [ตอบกลับ] [ดูประวัติ]               │
│                                         │
│  2. ร้านค้า B - "สินค้าหมดอีกแล้ว"     │
│     ⚠️ Category: สินค้าขาด             │
└─────────────────────────────────────────┘
```

### 5. Top Complaining Customers 📝
```
┌─────────────────────────────────────────┐
│ 📝 ลูกค้าที่บ่นบ่อยที่สุด              │
│                                         │
│  1. ร้านค้า A - 5 ครั้ง/เดือน          │
│  2. ร้านค้า B - 3 ครั้ง/เดือน          │
│  3. ร้านค้า C - 2 ครั้ง/เดือน          │
└─────────────────────────────────────────┘
```

---

## 🗄️ Database Schema

```sql
-- ตาราง messages (มีอยู่แล้ว ใช้ได้เลย)
-- messages: id, user_id, content, created_at, type

-- 1. AI Sentiment Analysis Cache
CREATE TABLE message_sentiment_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  sentiment ENUM('positive', 'neutral', 'negative') NOT NULL,
  confidence DECIMAL(3,2), -- 0.00 - 1.00
  keywords JSON, -- ["ส่งช้า", "ไม่พอใจ"]
  categories JSON, -- ["delivery", "complaint"]
  summary TEXT, -- AI summary
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_message (message_id),
  INDEX idx_sentiment (sentiment),
  INDEX idx_categories ( (CAST(categories AS CHAR(255) ARRAY)) )
);

-- 2. Daily Sales Summary (pre-computed)
CREATE TABLE daily_sales_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  total_revenue DECIMAL(12,2) DEFAULT 0,
  total_orders INT DEFAULT 0,
  total_customers INT DEFAULT 0,
  avg_order_value DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_date (date)
);

-- 3. Complaint Summary by Date
CREATE TABLE daily_complaint_summary (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  category VARCHAR(50) NOT NULL, -- 'delivery', 'product', 'price', 'service'
  count INT DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_date_category (date, category)
);
```

---

## 🤖 Gemini AI Integration

### Prompt Template:
```typescript
const SENTIMENT_PROMPT = `
วิเคราะห์ข้อความต่อไปนี้จากลูกค้า (ร้านขายยา):

ข้อความ: "{message}"

ให้ตอบกลับในรูปแบบ JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": 0.0-1.0,
  "keywords": ["คำสำคัญ1", "คำสำคัญ2"],
  "categories": ["delivery" | "product" | "price" | "service" | "other"],
  "summary": "สรุปประเด็น 1 ประโยค",
  "is_complaint": true | false,
  "urgency": "high" | "medium" | "low"
}
`;
```

---

## Task Structure

### Task 1: AI Sentiment Analysis Service

**Files:**
- Create: `src/lib/ai/gemini.ts` - Gemini API wrapper
- Create: `src/lib/ai/sentiment.ts` - Sentiment analysis service
- Create: `src/lib/ai/prompts.ts` - Prompt templates

**Steps:**
1. Setup Gemini API client
2. Create sentiment analysis function
3. Create batch analysis for historical messages
4. Cache results to database

---

### Task 2: Database Queries for Sales & Sentiment

**Files:**
- Create: `src/lib/sales-analytics/queries.ts`

**Queries:**
- `getDailySales(days)` - ยอดขายรายวัน
- `getSalesComparison()` - เปรียบเทียบเดือน
- `getSentimentDistribution(days)` - สัดส่วน sentiment
- `getComplaintCategories(days)` - หมวดหมู่ปัญหา
- `getRecentComplaints(limit)` - ข้อความบ่นล่าสุด
- `getTopComplainingCustomers(limit)` - ลูกค้าบ่นบ่อย

---

### Task 3: API Routes

**Files:**
- Create: `src/app/api/sales-analytics/sales/route.ts`
- Create: `src/app/api/sales-analytics/sentiment/route.ts`
- Create: `src/app/api/sales-analytics/complaints/route.ts`
- Create: `src/app/api/sales-analytics/analyze/route.ts` - Trigger AI analysis

---

### Task 4: Sales Chart Component

**Files:**
- Create: `src/components/sales-analytics/SalesChart.tsx`

**Features:**
- Line chart: ยอดขายรายวัน
- Bar chart: เปรียบเทียบเดือน
- Filter: 7 วัน / 30 วัน / 90 วัน / 1 ปี
- Tooltip: แสดงรายละเอียด

---

### Task 5: Sentiment Donut Chart

**Files:**
- Create: `src/components/sales-analytics/SentimentChart.tsx`

**Features:**
- Donut chart: Positive / Neutral / Negative
- Percentage labels
- Color coding: Green / Gray / Red
- Last updated timestamp

---

### Task 6: Complaint Categories Bar Chart

**Files:**
- Create: `src/components/sales-analytics/ComplaintCategories.tsx`

**Features:**
- Horizontal bar chart
- Categories: ส่งของช้า, สินค้าขาด, ราคา, คุณภาพ
- Icons for each category
- Percentage labels

---

### Task 7: Recent Complaints Alert

**Files:**
- Create: `src/components/sales-analytics/RecentComplaints.tsx`

**Features:**
- List of recent complaints (AI detected)
- Customer name + message preview
- Category badge
- Urgency indicator (red/yellow)
- Quick action buttons

---

### Task 8: Main Sales Analytics Page

**Files:**
- Create: `src/app/inbox/analytics/sales/page.tsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ Header: Sales & Sentiment Analytics                     │
├─────────────────────────────────────────────────────────┤
│ Sales Chart (full width)                                │
├─────────────────────────────────────────────────────────┤
│ Sentiment Chart │ Complaint Categories                  │
├─────────────────────────────────────────────────────────┤
│ Recent Complaints │ Top Complaining Customers           │
└─────────────────────────────────────────────────────────┘
```

---

### Task 9: Background AI Analysis Job

**Files:**
- Create: `src/app/api/cron/analyze-messages/route.ts`

**Function:**
- รันทุกชั่วโมง (cron job)
- ดึง messages ที่ยังไม่ได้ analyze
- ส่งให้ Gemini วิเคราะห์
- บันทึกผลลง database

---

### Task 10: Update Sidebar & Integration

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`
- Modify: `src/app/inbox/analytics/page.tsx` (add link)

**Menu:**
- กลุ่ม "ภาพรวมและสถิติ"
  - เมนู: "วิเคราะห์ยอดขาย & AI" → `/inbox/analytics/sales`

---

## Summary

### New Files:
1. AI Service: `src/lib/ai/*`
2. Queries: `src/lib/sales-analytics/queries.ts`
3. APIs: `src/app/api/sales-analytics/*`
4. Components:
   - `SalesChart.tsx`
   - `SentimentChart.tsx`
   - `ComplaintCategories.tsx`
   - `RecentComplaints.tsx`
5. Page: `src/app/inbox/analytics/sales/page.tsx`
6. Cron: `src/app/api/cron/analyze-messages/route.ts`

### Database:
- `message_sentiment_analysis` (ใหม่)
- `daily_sales_summary` (ใหม่)
- `daily_complaint_summary` (ใหม่)

### Total Tasks: 10
### Estimated Time: 90-120 minutes

---

## Execution Options

**Plan complete:** `docs/plans/sales-sentiment-analytics.md`

**Options:**
1. **Subagent-Driven** - Dispatch subagent per task
2. **Manual Implementation** - ทำทีละ task พร้อมกัน
3. **Parallel with fixes** - รอ Vercel build เสร็จก่อน

**Which approach?**
