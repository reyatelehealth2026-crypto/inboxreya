# Unified Analytics Dashboard - Feature Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** รวม Customer Analytics + Sales Analytics + AI Sentiment เป็นหน้า Dashboard เดียวที่ครบถ้วน

**Architecture:**
- **Tab Navigation:** สลับระหว่าง Overview | Sales | Customers | AI Insights
- **Unified Design:** Data-Dense Dashboard (จาก ui-ux-pro-max)
- **Real-time:** Pusher สำหรับอัปเดตสด
- **AI Integration:** Gemini สำหรับวิเคราะห์ sentiment

**Tech Stack:** Next.js 14, TypeScript, Recharts, MySQL2, Google Gemini API, Tailwind, shadcn/ui

---

## 🎨 Design System

```css
/* Colors */
--primary: #7C3AED;      /* Purple */
--secondary: #A78BFA;
--cta: #F97316;          /* Orange */
--success: #22C55E;      /* Green */
--warning: #F59E0B;      /* Amber */
--danger: #EF4444;       /* Red */
--bg: #FAF5FF;
--text: #4C1D95;

/* Typography */
font-family: 'Fira Code', 'Fira Sans', sans-serif;
```

---

## 📱 Page Layout

```
┌─────────────────────────────────────────────────────────────────┐
│ 📊 Unified Analytics Dashboard                    [Tab: Overview]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────┬─────────┬─────────┬─────────┐                     │
│  │💰 Revenue│👥 Customers│📦 Orders│😊 Sentiment│              │
│  │ ฿4.2M   │  102     │  245    │ 85%      │              │
│  └─────────┴─────────┴─────────┴─────────┘                     │
│                                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ 📈 Revenue Trend           │  │ 🥧 Customer Segments       ││
│  │  [Line Chart]              │  │  [Pie Chart]               ││
│  │  Last 30 days              │  │  VIP | Gold | Silver       ││
│  └────────────────────────────┘  └────────────────────────────┘│
│                                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ 🤖 AI Sentiment Analysis   │  │ ⚠️ Top Complaint Categories││
│  │  😊 65% 😐 25% 😠 10%     │  │  [Bar Chart]               ││
│  │  Last analyzed: 2 hrs ago  │  │  Delivery | Product | Price││
│  └────────────────────────────┘  └────────────────────────────┘│
│                                                                 │
│  ┌────────────────────────────────────────────────────────────┐│
│  │ 🚨 Recent Issues (AI Detected)                            ││
│  │  • ร้านค้า A - "ส่งช้ามาก" [Delivery] [High] - 2h ago     ││
│  │  • ร้านค้า B - "สินค้าหมด" [Product] [Medium] - 5h ago    ││
│  └────────────────────────────────────────────────────────────┘│
│                                                                 │
│  ┌────────────────────────────┐  ┌────────────────────────────┐│
│  │ 🏆 Top Customers           │  │ 📝 Top Complaining         ││
│  │  [Table: Name, Revenue]    │  │  [Table: Name, Complaints] ││
│  └────────────────────────────┘  └────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🗂️ Tab Navigation

| Tab | เนื้อหา |
|-----|---------|
| **📊 Overview** | สรุปรวมทั้งหมด (Stats + Mini Charts) |
| **📈 Sales** | กราฟยอดขายละเอียด, Trends, Comparisons |
| **👥 Customers** | Segments, Top Customers, Behavior |
| **🤖 AI Insights** | Sentiment, Complaints, Risk Analysis |

---

## 🗄️ Database Schema Updates

```sql
-- 1. Message Sentiment Analysis (NEW)
CREATE TABLE message_sentiment_analysis (
  id INT AUTO_INCREMENT PRIMARY KEY,
  message_id INT NOT NULL,
  user_id INT NOT NULL,
  sentiment ENUM('positive', 'neutral', 'negative') NOT NULL,
  confidence DECIMAL(3,2),
  keywords JSON,
  categories JSON, -- ["delivery", "product", "price", "service"]
  summary TEXT,
  is_complaint BOOLEAN DEFAULT FALSE,
  urgency ENUM('high', 'medium', 'low'),
  analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY unique_message (message_id),
  INDEX idx_user_sentiment (user_id, sentiment),
  INDEX idx_categories ( (CAST(categories AS CHAR(255) ARRAY)) ),
  INDEX idx_complaint (is_complaint, urgency)
);

-- 2. Daily Sales Summary (NEW)
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

-- 3. Daily Metrics (for caching)
CREATE TABLE daily_metrics (
  id INT AUTO_INCREMENT PRIMARY KEY,
  date DATE NOT NULL,
  metric_type VARCHAR(50) NOT NULL, -- 'sales', 'sentiment', 'complaints'
  metric_data JSON NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_date_type (date, metric_type)
);
```

---

## 🤖 Gemini AI Prompts

### Sentiment Analysis
```typescript
const SENTIMENT_PROMPT = `
วิเคราะห์ข้อความจากลูกค้าร้านขายยา:

ข้อความ: "{message}"

ตอบ JSON:
{
  "sentiment": "positive" | "neutral" | "negative",
  "confidence": 0.0-1.0,
  "keywords": ["keyword1", "keyword2"],
  "categories": ["delivery" | "product" | "price" | "service" | "other"],
  "summary": "สรุป 1 ประโยค",
  "is_complaint": boolean,
  "urgency": "high" | "medium" | "low"
}
`;
```

---

## 📁 File Structure

```
src/
├── lib/
│   ├── analytics/
│   │   ├── types.ts           # Shared types
│   │   ├── queries.ts         # DB queries
│   │   └── utils.ts           # Format helpers
│   ├── ai/
│   │   ├── gemini.ts          # Gemini API
│   │   ├── sentiment.ts       # Sentiment service
│   │   └── prompts.ts         # AI prompts
│   └── db.ts                  # MySQL connection
│
├── app/
│   ├── api/
│   │   ├── analytics/
│   │   │   ├── route.ts       # GET /api/analytics (unified)
│   │   │   └── analyze/route.ts # POST trigger AI analysis
│   │   └── cron/
│   │       └── analyze-messages/route.ts # Hourly AI job
│   │
│   └── inbox/
│       └── analytics/
│           ├── page.tsx       # Main unified page with tabs
│           ├── loading.tsx    # Loading skeleton
│           └── components/    # Sub-components
│
└── components/
    └── analytics/
        ├── OverviewTab.tsx
        ├── SalesTab.tsx
        ├── CustomersTab.tsx
        ├── AIInsightsTab.tsx
        ├── StatCards.tsx
        ├── RevenueChart.tsx
        ├── SentimentChart.tsx
        ├── ComplaintChart.tsx
        ├── SegmentPieChart.tsx
        ├── TopCustomersTable.tsx
        ├── RecentIssuesList.tsx
        └── TabNavigation.tsx
```

---

## 🎯 Task Structure

### Task 1: Setup Unified Types & Database

**Files:**
- Create/Update: `src/lib/analytics/types.ts`
- Create: `prisma/migrations/add_analytics_tables.sql`

**Types:**
```typescript
interface UnifiedAnalyticsData {
  // Overview
  stats: {
    totalRevenue: number;
    totalCustomers: number;
    totalOrders: number;
    avgSentiment: number; // 0-100
  };
  
  // Sales
  salesTrend: { date: string; revenue: number; orders: number }[];
  
  // Customers
  segments: CustomerSegment[];
  topCustomers: TopCustomer[];
  
  // AI Insights
  sentimentDistribution: { positive: number; neutral: number; negative: number };
  complaintCategories: { category: string; count: number }[];
  recentIssues: RecentIssue[];
  topComplainers: TopComplainer[];
}
```

---

### Task 2: AI Service Layer

**Files:**
- Create: `src/lib/ai/gemini.ts`
- Create: `src/lib/ai/sentiment.ts`

**Functions:**
- `analyzeMessage(message: string)` - วิเคราะห์ข้อความเดี่ยว
- `analyzeBatch(messages: Message[])` - วิเคราะห์หลายข้อความ
- `getUnanalyzedMessages()` - ดึงข้อความที่ยังไม่ได้ analyze

---

### Task 3: Unified Database Queries

**Files:**
- Create/Update: `src/lib/analytics/queries.ts`

**Queries:**
- `getUnifiedAnalytics()` - ดึงข้อมูลรวมทั้งหมด
- `getSalesTrend(days)` - แนวโน้มยอดขาย
- `getSentimentStats(days)` - สถิติ sentiment
- `getComplaintStats(days)` - สถิติ complaints
- `getRecentIssues(limit)` - ปัญหาล่าสุด

---

### Task 4: API Routes

**Files:**
- Create: `src/app/api/analytics/route.ts` - GET ข้อมูลรวม
- Create: `src/app/api/analytics/analyze/route.ts` - POST สั่ง AI analyze
- Create: `src/app/api/cron/analyze-messages/route.ts` - Cron job

---

### Task 5: Stat Cards Component

**Files:**
- Create: `src/components/analytics/StatCards.tsx`

**4 Cards:**
1. 💰 Total Revenue (พร้อม % change)
2. 👥 Total Customers
3. 📦 Total Orders
4. 😊 Avg Sentiment Score

---

### Task 6: Revenue Chart Component

**Files:**
- Create: `src/components/analytics/RevenueChart.tsx`

**Features:**
- Line + Bar combo chart
- Filter: 7d / 30d / 90d / 1y
- Compare with previous period

---

### Task 7: Sentiment & Complaint Charts

**Files:**
- Create: `src/components/analytics/SentimentChart.tsx` - Donut chart
- Create: `src/components/analytics/ComplaintChart.tsx` - Horizontal bar

---

### Task 8: Recent Issues List

**Files:**
- Create: `src/components/analytics/RecentIssuesList.tsx`

**Features:**
- AI-detected complaints
- Urgency badge (red/yellow)
- Category icon
- Quick reply button

---

### Task 9: Tab Navigation & Main Page

**Files:**
- Create: `src/app/inbox/analytics/page.tsx`
- Create: `src/components/analytics/TabNavigation.tsx`

**Tabs:**
- Overview (default)
- Sales (detailed)
- Customers (segments + top)
- AI Insights (sentiment + complaints)

---

### Task 10: Sidebar Update & Integration

**Files:**
- Update: `src/components/layout/Sidebar.tsx`

**Menu:**
- กลุ่ม "ภาพรวม"
  - "Analytics Dashboard" → `/inbox/analytics`

---

## 📊 Data Flow

```
User visits /inbox/analytics
    ↓
API: GET /api/analytics
    ↓
Query Database (users, orders, messages)
    ↓
Return UnifiedAnalyticsData
    ↓
Render Dashboard with Tabs
```

**Background AI Process (Cron):**
```
Every hour
    ↓
Get unanalyzed messages
    ↓
Send to Gemini API
    ↓
Save sentiment results
    ↓
Update dashboard cache
```

---

## 🚀 Execution Plan

### Phase 1: Foundation (Tasks 1-4)
- Types, Database, AI Service, APIs
- **Time:** 30-40 min

### Phase 2: UI Components (Tasks 5-8)
- Charts, Tables, Lists
- **Time:** 40-50 min

### Phase 3: Integration (Tasks 9-10)
- Main page, Tabs, Sidebar
- **Time:** 20-30 min

### Total: 90-120 minutes

---

## ✅ Success Criteria

- [ ] Dashboard โหลดได้ภายใน 3 วินาที
- [ ] AI วิเคราะห์ข้อความได้แม่นยำ > 80%
- [ ] ข้อมูล real-time (อัปเดตทุกชั่วโมง)
- [ ] Responsive บน mobile
- [ ] TypeScript ไม่มี error

---

## 📝 Notes

**ใช้ข้อมูลที่มีอยู่:**
- `users` table - ข้อมูลลูกค้า
- `messages` table - ข้อความจาก LINE
- `orders` table - ออเดอร์ (ถ้ามี)

**ต้องสร้างใหม่:**
- `message_sentiment_analysis` - ผลวิเคราะห์ AI
- `daily_sales_summary` - สรุปยอดขายรายวัน

---

**Plan saved to:** `docs/plans/unified-analytics-dashboard.md`

**Ready to execute?** (Yes / Need adjustments)
