# Customer Analytics Dashboard Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** สร้าง Dashboard แสดง analytics ของลูกค้า รวมถึง customer segments, top customers, sales statistics และ behavior patterns โดยใช้ข้อมูลจาก database ที่มีอยู่

**Architecture:** 
- ใช้ Next.js App Router + TypeScript
- ใช้ Recharts สำหรับกราฟ
- ใช้ **Existing PHP/MySQL Database** (ผ่าน API หรือ Direct MySQL connection)
- ใช้ Tailwind + shadcn/ui components
- ใช้ TDD (เขียน test ก่อน code ทุกครั้ง)

**Tech Stack:** Next.js 14, TypeScript, MySQL2 (หรือ existing DB connection), Recharts, Tailwind CSS, shadcn/ui

**⚠️ ใช้ Database เดิม:**
- Database: MySQL (zrismpsz_cny)
- Host: 118.27.146.16:3306
- User: zrismpsz_cny / Pass: zrismpsz_cny
- ไม่ต้องสร้าง Prisma schema ใหม่

---

## Database Schema (ที่มีอยู่แล้ว)

```sql
Table: users
- id, member_id, display_name, phone, email
- total_spent, order_count, tier
- created_at, last_order_at
- province, district (optional)

Table: orders
- id, user_id, total_amount, status, created_at

Table: order_items
- id, order_id, product_id, quantity, price
```

---

## Task Structure

### Task 1: Setup Project Structure

**Files:**
- Create: `src/app/inbox/analytics/page.tsx`
- Create: `src/components/analytics/` (directory)
- Create: `src/lib/analytics/` (directory)
- Create: `tests/analytics/` (directory)

**Step 1: Create directory structure**

```bash
mkdir -p src/components/analytics
mkdir -p src/lib/analytics
mkdir -p tests/analytics
```

**Step 2: Verify directories created**

```bash
ls -la src/components/analytics src/lib/analytics tests/analytics
```

Expected: All directories exist

**Step 3: Commit**

```bash
git add .
git commit -m "chore: setup analytics dashboard directory structure"
```

---

### Task 2: Create Types and Interfaces

**Files:**
- Create: `src/lib/analytics/types.ts`
- Test: `tests/analytics/types.test.ts`

**Step 1: Write the failing test**

Create `tests/analytics/types.test.ts`:

```typescript
import { CustomerSegment, TopCustomer, SalesStats } from '@/lib/analytics/types';

describe('Analytics Types', () => {
  test('CustomerSegment should have required fields', () => {
    const segment: CustomerSegment = {
      name: 'VIP',
      tier: 'vip',
      minSpent: 100000,
      count: 10,
      percentage: 10
    };
    expect(segment.name).toBe('VIP');
    expect(segment.count).toBe(10);
  });

  test('TopCustomer should have required fields', () => {
    const customer: TopCustomer = {
      memberId: 'PC001',
      name: 'Test Customer',
      totalSpent: 50000,
      orderCount: 5,
      tier: 'gold'
    };
    expect(customer.memberId).toBe('PC001');
    expect(customer.totalSpent).toBe(50000);
  });

  test('SalesStats should have required fields', () => {
    const stats: SalesStats = {
      totalRevenue: 1000000,
      totalCustomers: 100,
      avgOrderValue: 5000,
      totalOrders: 200
    };
    expect(stats.totalRevenue).toBe(1000000);
    expect(stats.avgOrderValue).toBe(5000);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/analytics/types.test.ts
```

Expected: FAIL with "Cannot find module '@/lib/analytics/types'"

**Step 3: Write minimal implementation**

Create `src/lib/analytics/types.ts`:

```typescript
export interface CustomerSegment {
  name: string;
  tier: 'vip' | 'gold' | 'silver' | 'bronze';
  minSpent: number;
  maxSpent?: number;
  count: number;
  percentage: number;
}

export interface TopCustomer {
  memberId: string;
  name: string | null;
  totalSpent: number;
  orderCount: number;
  tier: string;
  avgOrderValue: number;
}

export interface SalesStats {
  totalRevenue: number;
  totalCustomers: number;
  avgOrderValue: number;
  totalOrders: number;
}

export interface BehaviorPattern {
  name: string;
  description: string;
  count: number;
  percentage: number;
}

export interface AnalyticsData {
  segments: CustomerSegment[];
  topCustomers: TopCustomer[];
  stats: SalesStats;
  behaviorPatterns: BehaviorPattern[];
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/analytics/types.test.ts
```

Expected: PASS (3 tests passed)

**Step 5: Commit**

```bash
git add tests/analytics/types.test.ts src/lib/analytics/types.ts
git commit -m "feat(analytics): add analytics types and interfaces"
```

---

### Task 3: Create Database Queries (MySQL2 - Existing DB)

**Files:**
- Create: `src/lib/analytics/queries.ts`
- Create: `src/lib/db.ts` (MySQL connection pool)
- Test: `tests/analytics/queries.test.ts`

**Step 1: Install mysql2 (ถ้ายังไม่มี)**

```bash
npm install mysql2
```

**Step 2: Create MySQL connection**

Create `src/lib/db.ts`:

```typescript
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
  host: process.env.DB_HOST || '118.27.146.16',
  port: parseInt(process.env.DB_PORT || '3306'),
  user: process.env.DB_USER || 'zrismpsz_cny',
  password: process.env.DB_PASSWORD || 'zrismpsz_cny',
  database: process.env.DB_NAME || 'zrismpsz_cny',
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
});

export default pool;
```

**Step 3: Write the failing test**

Create `tests/analytics/queries.test.ts`:

```typescript
import { getCustomerSegments, getTopCustomers, getSalesStats } from '@/lib/analytics/queries';

describe('Analytics Queries', () => {
  test('getSalesStats should return statistics', async () => {
    const stats = await getSalesStats();
    expect(stats).toHaveProperty('totalRevenue');
    expect(stats).toHaveProperty('totalCustomers');
    expect(stats).toHaveProperty('avgOrderValue');
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
  });

  test('getCustomerSegments should return array', async () => {
    const segments = await getCustomerSegments();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThan(0);
  });

  test('getTopCustomers should return top 10', async () => {
    const customers = await getTopCustomers(10);
    expect(Array.isArray(customers)).toBe(true);
    expect(customers.length).toBeLessThanOrEqual(10);
  });
});
```

**Step 4: Run test to verify it fails**

```bash
npm test tests/analytics/queries.test.ts
```

Expected: FAIL with module not found

**Step 5: Write minimal implementation using MySQL2**

Create `src/lib/analytics/queries.ts`:

```typescript
import pool from '@/lib/db';
import { CustomerSegment, TopCustomer, SalesStats, BehaviorPattern } from './types';

export async function getSalesStats(): Promise<SalesStats> {
  const [rows] = await pool.execute(`
    SELECT 
      COALESCE(SUM(total_spent), 0) as total_spent,
      COUNT(*) as count,
      COALESCE(AVG(total_spent), 0) as avg_spent,
      COALESCE(SUM(order_count), 0) as total_orders
    FROM users
    WHERE total_spent > 0
  `);

  const result = (rows as any[])[0];
  return {
    totalRevenue: Number(result.total_spent || 0),
    totalCustomers: Number(result.count || 0),
    avgOrderValue: Number(result.avg_spent || 0),
    totalOrders: Number(result.total_orders || 0)
  };
}

export async function getCustomerSegments(): Promise<CustomerSegment[]> {
  const stats = await getSalesStats();
  const total = stats.totalCustomers;

  // VIP: 100,000+
  const [vipRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE total_spent >= ?',
    [100000]
  );
  const vip = Number((vipRows as any[])[0].count);

  // Gold: 50,000 - 99,999
  const [goldRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE total_spent >= ? AND total_spent < ?',
    [50000, 100000]
  );
  const gold = Number((goldRows as any[])[0].count);

  // Silver: 20,000 - 49,999
  const [silverRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE total_spent >= ? AND total_spent < ?',
    [20000, 50000]
  );
  const silver = Number((silverRows as any[])[0].count);

  // Bronze: 1 - 19,999
  const [bronzeRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE total_spent >= ? AND total_spent < ?',
    [1, 20000]
  );
  const bronze = Number((bronzeRows as any[])[0].count);

  return [
    { name: 'VIP Customers', tier: 'vip', minSpent: 100000, count: vip, percentage: total ? Math.round((vip / total) * 100) : 0 },
    { name: 'Gold Customers', tier: 'gold', minSpent: 50000, maxSpent: 99999, count: gold, percentage: total ? Math.round((gold / total) * 100) : 0 },
    { name: 'Silver Customers', tier: 'silver', minSpent: 20000, maxSpent: 49999, count: silver, percentage: total ? Math.round((silver / total) * 100) : 0 },
    { name: 'Bronze Customers', tier: 'bronze', minSpent: 1, maxSpent: 19999, count: bronze, percentage: total ? Math.round((bronze / total) * 100) : 0 }
  ].filter(s => s.count > 0);
}

export async function getTopCustomers(limit: number = 10): Promise<TopCustomer[]> {
  const [rows] = await pool.execute(`
    SELECT 
      member_id,
      COALESCE(real_name, display_name, custom_display_name) as name,
      total_spent,
      order_count,
      tier
    FROM users
    WHERE total_spent > 0
    ORDER BY total_spent DESC
    LIMIT ?
  `, [limit]);

  return (rows as any[]).map(user => ({
    memberId: user.member_id || '',
    name: user.name,
    totalSpent: Number(user.total_spent || 0),
    orderCount: user.order_count || 0,
    tier: user.tier || 'bronze',
    avgOrderValue: user.order_count ? Number(user.total_spent || 0) / user.order_count : 0
  }));
}

export async function getBehaviorPatterns(): Promise<BehaviorPattern[]> {
  const [totalRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE total_spent > 0'
  );
  const total = Number((totalRows as any[])[0].count);

  // Frequent: 6+ orders
  const [frequentRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE order_count >= ?',
    [6]
  );
  const frequent = Number((frequentRows as any[])[0].count);

  // Regular: 3-5 orders
  const [regularRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE order_count >= ? AND order_count < ?',
    [3, 6]
  );
  const regular = Number((regularRows as any[])[0].count);

  // Occasional: 1-2 orders
  const [occasionalRows] = await pool.execute(
    'SELECT COUNT(*) as count FROM users WHERE order_count >= ? AND order_count < ?',
    [1, 3]
  );
  const occasional = Number((occasionalRows as any[])[0].count);

  return [
    { name: 'Frequent Buyers', description: '6+ orders', count: frequent, percentage: total ? Math.round((frequent / total) * 100) : 0 },
    { name: 'Regular Buyers', description: '3-5 orders', count: regular, percentage: total ? Math.round((regular / total) * 100) : 0 },
    { name: 'Occasional Buyers', description: '1-2 orders', count: occasional, percentage: total ? Math.round((occasional / total) * 100) : 0 }
  ].filter(p => p.count > 0);
}

export async function getAllAnalyticsData() {
  const [segments, topCustomers, stats, behaviorPatterns] = await Promise.all([
    getCustomerSegments(),
    getTopCustomers(10),
    getSalesStats(),
    getBehaviorPatterns()
  ]);

  return {
    segments,
    topCustomers,
    stats,
    behaviorPatterns
  };
}
```

**Step 6: Run test to verify it passes**

```bash
npm test tests/analytics/queries.test.ts -- --testTimeout=10000
```

Expected: PASS (3 tests passed)

**Step 7: Commit**

```bash
git add src/lib/db.ts tests/analytics/queries.test.ts src/lib/analytics/queries.ts
git commit -m "feat(analytics): add MySQL2 database queries for existing DB"
```

---

### Task 4: Create API Route

**Files:**
- Create: `src/app/api/analytics/route.ts`
- Test: `tests/api/analytics.test.ts`

**Step 1: Write the failing test**

Create `tests/api/analytics.test.ts`:

```typescript
import { GET } from '@/app/api/analytics/route';

describe('Analytics API', () => {
  test('GET should return analytics data', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('segments');
    expect(data).toHaveProperty('topCustomers');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('behaviorPatterns');
    expect(Array.isArray(data.segments)).toBe(true);
    expect(Array.isArray(data.topCustomers)).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/api/analytics.test.ts
```

Expected: FAIL with module not found

**Step 3: Write minimal implementation**

Create `src/app/api/analytics/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { getAllAnalyticsData } from '@/lib/analytics/queries';

export async function GET() {
  try {
    const data = await getAllAnalyticsData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/api/analytics.test.ts -- --testTimeout=10000
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/api/analytics.test.ts src/app/api/analytics/route.ts
git commit -m "feat(api): add analytics endpoint"
```

---

### Task 5: Create Stats Cards Component

**Files:**
- Create: `src/components/analytics/StatsCards.tsx`
- Test: `tests/analytics/StatsCards.test.tsx`

**Step 1: Write the failing test**

Create `tests/analytics/StatsCards.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { StatsCards } from '@/components/analytics/StatsCards';

describe('StatsCards', () => {
  const mockStats = {
    totalRevenue: 4220946.54,
    totalCustomers: 102,
    avgOrderValue: 41382,
    totalOrders: 245
  };

  test('renders all stat cards', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText(/รายได้รวม/i)).toBeInTheDocument();
    expect(screen.getByText(/จำนวนลูกค้า/i)).toBeInTheDocument();
    expect(screen.getByText(/มูลค่าออเดอร์เฉลี่ย/i)).toBeInTheDocument();
    expect(screen.getByText(/จำนวนออเดอร์/i)).toBeInTheDocument();
  });

  test('displays formatted numbers', () => {
    render(<StatsCards stats={mockStats} />);
    expect(screen.getByText(/4,220,947/)).toBeInTheDocument();
    expect(screen.getByText(/102/)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/analytics/StatsCards.test.tsx
```

Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/components/analytics/StatsCards.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SalesStats } from '@/lib/analytics/types';
import { formatCurrency, formatNumber } from '@/lib/utils';
import { TrendingUp, Users, ShoppingCart, Package } from 'lucide-react';

interface StatsCardsProps {
  stats: SalesStats;
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      title: 'รายได้รวม',
      value: formatCurrency(stats.totalRevenue),
      icon: TrendingUp,
      color: 'text-green-600',
      bgColor: 'bg-green-50'
    },
    {
      title: 'จำนวนลูกค้า',
      value: formatNumber(stats.totalCustomers),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50'
    },
    {
      title: 'มูลค่าออเดอร์เฉลี่ย',
      value: formatCurrency(stats.avgOrderValue),
      icon: ShoppingCart,
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'จำนวนออเดอร์',
      value: formatNumber(stats.totalOrders),
      icon: Package,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50'
    }
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {cards.map((card) => (
        <Card key={card.title}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">
              {card.title}
            </CardTitle>
            <div className={`p-2 rounded-lg ${card.bgColor}`}>
              <card.icon className={`h-4 w-4 ${card.color}`} />
            </div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
```

**Step 4: Add utility functions**

Update `src/lib/utils.ts` (ถ้ายังไม่มี):

```typescript
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('th-TH', {
    style: 'currency',
    currency: 'THB',
    minimumFractionDigits: 0
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('th-TH').format(num);
}
```

**Step 5: Run test to verify it passes**

```bash
npm test tests/analytics/StatsCards.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add tests/analytics/StatsCards.test.tsx src/components/analytics/StatsCards.tsx src/lib/utils.ts
git commit -m "feat(analytics): add StatsCards component"
```

---

### Task 6: Create Customer Segments Chart

**Files:**
- Create: `src/components/analytics/SegmentChart.tsx`
- Test: `tests/analytics/SegmentChart.test.tsx`

**Step 1: Write the failing test**

Create `tests/analytics/SegmentChart.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { SegmentChart } from '@/components/analytics/SegmentChart';

describe('SegmentChart', () => {
  const mockSegments = [
    { name: 'VIP', tier: 'vip', minSpent: 100000, count: 7, percentage: 7 },
    { name: 'Gold', tier: 'gold', minSpent: 50000, count: 6, percentage: 6 }
  ];

  test('renders chart with segment data', () => {
    render(<SegmentChart segments={mockSegments} />);
    expect(screen.getByText(/กลุ่มลูกค้า/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/analytics/SegmentChart.test.tsx
```

Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/components/analytics/SegmentChart.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { CustomerSegment } from '@/lib/analytics/types';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend
} from 'recharts';

interface SegmentChartProps {
  segments: CustomerSegment[];
}

const COLORS = {
  vip: '#FFD700',
  gold: '#FFA500',
  silver: '#C0C0C0',
  bronze: '#CD7F32'
};

export function SegmentChart({ segments }: SegmentChartProps) {
  const data = segments.map(s => ({
    name: s.name,
    value: s.count,
    percentage: s.percentage,
    tier: s.tier
  }));

  return (
    <Card className="col-span-1">
      <CardHeader>
        <CardTitle>กลุ่มลูกค้า</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              labelLine={false}
              label={({ name, percentage }) => `${name} (${percentage}%)`}
              outerRadius={80}
              fill="#8884d8"
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell 
                  key={`cell-${index}`} 
                  fill={COLORS[entry.tier as keyof typeof COLORS] || '#8884d8'} 
                />
              ))}
            </Pie>
            <Tooltip />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Install Recharts (ถ้ายังไม่มี)**

```bash
npm install recharts
```

**Step 5: Run test to verify it passes**

```bash
npm test tests/analytics/SegmentChart.test.tsx
```

Expected: PASS

**Step 6: Commit**

```bash
git add tests/analytics/SegmentChart.test.tsx src/components/analytics/SegmentChart.tsx
git commit -m "feat(analytics): add SegmentChart component with pie chart"
```

---

### Task 7: Create Top Customers Table

**Files:**
- Create: `src/components/analytics/TopCustomersTable.tsx`
- Test: `tests/analytics/TopCustomersTable.test.tsx`

**Step 1: Write the failing test**

Create `tests/analytics/TopCustomersTable.test.tsx`:

```typescript
import { render, screen } from '@testing-library/react';
import { TopCustomersTable } from '@/components/analytics/TopCustomersTable';

describe('TopCustomersTable', () => {
  const mockCustomers = [
    {
      memberId: 'PC001',
      name: 'Customer 1',
      totalSpent: 180000,
      orderCount: 10,
      tier: 'vip',
      avgOrderValue: 18000
    }
  ];

  test('renders table with customer data', () => {
    render(<TopCustomersTable customers={mockCustomers} />);
    expect(screen.getByText(/ลูกค้ายอดซื้อสูงสุด/i)).toBeInTheDocument();
    expect(screen.getByText('Customer 1')).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

```bash
npm test tests/analytics/TopCustomersTable.test.tsx
```

Expected: FAIL

**Step 3: Write minimal implementation**

Create `src/components/analytics/TopCustomersTable.tsx`:

```typescript
'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table';
import { TopCustomer } from '@/lib/analytics/types';
import { formatCurrency } from '@/lib/utils';
import { Trophy } from 'lucide-react';

interface TopCustomersTableProps {
  customers: TopCustomer[];
}

export function TopCustomersTable({ customers }: TopCustomersTableProps) {
  return (
    <Card className="col-span-2">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          ลูกค้ายอดซื้อสูงสุด
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">#</TableHead>
              <TableHead>ชื่อร้าน</TableHead>
              <TableHead>รหัสสมาชิก</TableHead>
              <TableHead className="text-right">ยอดซื้อ</TableHead>
              <TableHead className="text-right">ออเดอร์</TableHead>
              <TableHead>ระดับ</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((customer, index) => (
              <TableRow key={customer.memberId}>
                <TableCell className="font-medium">
                  {index + 1}
                </TableCell>
                <TableCell>{customer.name || 'ไม่ระบุชื่อ'}</TableCell>
                <TableCell className="font-mono text-sm">
                  {customer.memberId}
                </TableCell>
                <TableCell className="text-right font-medium">
                  {formatCurrency(customer.totalSpent)}
                </TableCell>
                <TableCell className="text-right">
                  {customer.orderCount}
                </TableCell>
                <TableCell>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    customer.tier === 'vip' ? 'bg-yellow-100 text-yellow-800' :
                    customer.tier === 'gold' ? 'bg-orange-100 text-orange-800' :
                    customer.tier === 'silver' ? 'bg-gray-100 text-gray-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {customer.tier.toUpperCase()}
                  </span>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
```

**Step 4: Run test to verify it passes**

```bash
npm test tests/analytics/TopCustomersTable.test.tsx
```

Expected: PASS

**Step 5: Commit**

```bash
git add tests/analytics/TopCustomersTable.test.tsx src/components/analytics/TopCustomersTable.tsx
git commit -m "feat(analytics): add TopCustomersTable component"
```

---

### Task 8: Create Main Analytics Page

**Files:**
- Create: `src/app/inbox/analytics/page.tsx`
- Modify: `src/app/inbox/analytics/loading.tsx` (optional)

**Step 1: Create main page**

Create `src/app/inbox/analytics/page.tsx`:

```typescript
import { Suspense } from 'react';
import { Metadata } from 'next';
import { InboxLayout } from '@/components/layout/InboxLayout';
import { StatsCards } from '@/components/analytics/StatsCards';
import { SegmentChart } from '@/components/analytics/SegmentChart';
import { TopCustomersTable } from '@/components/analytics/TopCustomersTable';
import { getAllAnalyticsData } from '@/lib/analytics/queries';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export const metadata: Metadata = {
  title: 'Analytics Dashboard | LINE OA Manager',
  description: 'Customer analytics and insights dashboard'
};

function LoadingSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i}>
            <CardHeader>
              <Skeleton className="h-4 w-24" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-8 w-32" />
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-[400px]" />
        <Skeleton className="h-[400px] lg:col-span-2" />
      </div>
    </div>
  );
}

async function AnalyticsContent() {
  const data = await getAllAnalyticsData();

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <StatsCards stats={data.stats} />

      {/* Charts and Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <SegmentChart segments={data.segments} />
        <TopCustomersTable customers={data.topCustomers} />
      </div>
    </div>
  );
}

export default function AnalyticsPage() {
  return (
    <InboxLayout>
      <div className="p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900">Analytics Dashboard</h1>
          <p className="text-gray-600">ข้อมูลวิเคราะห์ลูกค้าและสถิติการขาย</p>
        </div>

        <Suspense fallback={<LoadingSkeleton />}>
          <AnalyticsContent />
        </Suspense>
      </div>
    </InboxLayout>
  );
}
```

**Step 2: Add menu item to Sidebar**

Modify `src/components/layout/Sidebar.tsx`:

Add to menuGroups (ในกลุ่ม "ภาพรวมและสถิติ"):

```typescript
{
  groupId: 'overview',
  groupTitle: 'ภาพรวมและสถิติ',
  groupIcon: '📊',
  menus: [
    { title: 'หน้าภาพรวม', icon: <Home className="h-4 w-4" />, href: '/inbox' },
    { title: 'วิเคราะห์ข้อมูล', icon: <BarChart3 className="h-4 w-4" />, href: '/inbox/analytics' }, // NEW!
  ],
}
```

Import BarChart3 icon ด้วย:

```typescript
import { Home, BarChart3, ... } from 'lucide-react';
```

**Step 3: Test the page loads**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/inbox/analytics | head -20
```

Expected: HTML response with "Analytics Dashboard"

**Step 4: Commit**

```bash
git add src/app/inbox/analytics/page.tsx src/components/layout/Sidebar.tsx
git commit -m "feat(analytics): add main analytics page with dashboard"
```

---

### Task 9: Integration Test

**Files:**
- Create: `tests/integration/analytics-dashboard.test.ts`

**Step 1: Write integration test**

Create `tests/integration/analytics-dashboard.test.ts`:

```typescript
describe('Analytics Dashboard Integration', () => {
  test('dashboard displays all components', async () => {
    // This would be an E2E test with Playwright or similar
    // For now, verify all imports work
    const { getAllAnalyticsData } = await import('@/lib/analytics/queries');
    const data = await getAllAnalyticsData();
    
    expect(data).toHaveProperty('segments');
    expect(data).toHaveProperty('topCustomers');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('behaviorPatterns');
    expect(data.segments.length).toBeGreaterThan(0);
    expect(data.topCustomers.length).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test**

```bash
npm test tests/integration/analytics-dashboard.test.ts -- --testTimeout=15000
```

Expected: PASS

**Step 3: Commit**

```bash
git add tests/integration/analytics-dashboard.test.ts
git commit -m "test(analytics): add integration test for dashboard"
```

---

## Summary

### Files Created:
1. `src/lib/analytics/types.ts` - Type definitions
2. `src/lib/db.ts` - **MySQL2 connection pool (ใช้ DB เดิม)**
3. `src/lib/analytics/queries.ts` - Database queries (MySQL2)
4. `src/app/api/analytics/route.ts` - API endpoint
5. `src/components/analytics/StatsCards.tsx` - Stats overview cards
6. `src/components/analytics/SegmentChart.tsx` - Pie chart for segments
7. `src/components/analytics/TopCustomersTable.tsx` - Top customers table
8. `src/app/inbox/analytics/page.tsx` - Main dashboard page
9. Tests for all components

### Database Connection:
- **Using existing MySQL database** (zrismpsz_cny)
- **Host:** 118.27.146.16:3306
- **User:** zrismpsz_cny
- **Library:** mysql2 (not Prisma)

### Total Tasks: 9
### Estimated Time: 45-60 minutes (with TDD)

---

## Execution Options

**Plan complete and saved to:** `docs/plans/customer-analytics-dashboard.md`

**Two execution options:**

**1. Subagent-Driven (this session)** - I dispatch fresh subagent per task, review between tasks, fast iteration

**2. Parallel Session (separate)** - Open new session with executing-plans, batch execution with checkpoints

**Which approach?**
