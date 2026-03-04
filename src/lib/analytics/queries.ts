import pool from '@/lib/db';
import { 
  CustomerSegment, 
  TopCustomer, 
  SalesStats, 
  BehaviorPattern,
  SalesTrendPoint,
  UnifiedAnalyticsData
} from './types';

// ============================================
// Odoo-based Sales Stats Queries
// ============================================

export async function getOdooSalesStats(days: number = 1): Promise<SalesStats> {
  // Get stats from odoo_orders instead of users table
  const [rows] = await pool.execute(`
    SELECT 
      COALESCE(SUM(amount_total), 0) as total_revenue,
      COUNT(DISTINCT partner_id) as total_customers,
      COALESCE(AVG(amount_total), 0) as avg_order_value,
      COUNT(*) as total_orders
    FROM odoo_orders
    WHERE state NOT IN ('cancel', 'draft')
      AND date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
  `, [days]);

  const result = (rows as any[])[0];
  return {
    totalRevenue: Number(result.total_revenue || 0),
    totalCustomers: Number(result.total_customers || 0),
    avgOrderValue: Number(result.avg_order_value || 0),
    totalOrders: Number(result.total_orders || 0)
  };
}

// ============================================
// Get Total Customers (like Odoo Dashboard - 640)
// ============================================

export async function getTotalOdooCustomers(): Promise<number> {
  // Count unique customers from odoo_line_users (linked LINE-Odoo customers)
  const [rows] = await pool.execute(`
    SELECT COUNT(DISTINCT odoo_partner_id) as total
    FROM odoo_line_users
  `);

  return Number((rows as any[])[0]?.total || 0);
}

// ============================================
// Odoo Customer Segment Queries (based on order values)
// ============================================

export async function getOdooCustomerSegments(days: number = 1): Promise<CustomerSegment[]> {
  // Get customer spending from odoo_orders
  const [customerSpending] = await pool.execute(`
    SELECT 
      partner_id,
      SUM(amount_total) as total_spent,
      COUNT(*) as order_count
    FROM odoo_orders
    WHERE state NOT IN ('cancel', 'draft')
      AND date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY partner_id
  `, [days]);

  const customers = customerSpending as any[];
  const total = customers.length;

  if (total === 0) {
    return [];
  }

  // Calculate tiers based on spending
  const vip = customers.filter(c => c.total_spent >= 100000).length;
  const gold = customers.filter(c => c.total_spent >= 50000 && c.total_spent < 100000).length;
  const silver = customers.filter(c => c.total_spent >= 20000 && c.total_spent < 50000).length;
  const bronze = customers.filter(c => c.total_spent > 0 && c.total_spent < 20000).length;

  return [
    { name: 'VIP Customers', tier: 'vip' as const, minSpent: 100000, count: vip, percentage: Math.round((vip / total) * 100) },
    { name: 'Gold Customers', tier: 'gold' as const, minSpent: 50000, maxSpent: 99999, count: gold, percentage: Math.round((gold / total) * 100) },
    { name: 'Silver Customers', tier: 'silver' as const, minSpent: 20000, maxSpent: 49999, count: silver, percentage: Math.round((silver / total) * 100) },
    { name: 'Bronze Customers', tier: 'bronze' as const, minSpent: 1, maxSpent: 19999, count: bronze, percentage: Math.round((bronze / total) * 100) }
  ].filter(s => s.count > 0);
}

// ============================================
// Top Customers from Odoo
// ============================================

export async function getOdooTopCustomers(limit: number = 10, days: number = 1): Promise<TopCustomer[]> {
  const [rows] = await pool.execute(`
    SELECT 
      o.partner_id,
      MAX(olu.odoo_customer_code) as member_id,
      MAX(olu.odoo_partner_name) as name,
      SUM(o.amount_total) as total_spent,
      COUNT(*) as order_count
    FROM odoo_orders o
    LEFT JOIN odoo_line_users olu ON o.partner_id = olu.odoo_partner_id
    WHERE o.state NOT IN ('cancel', 'draft')
      AND o.date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY o.partner_id
    ORDER BY total_spent DESC
    LIMIT ?
  `, [days, limit]);

  return (rows as any[]).map((user, index) => ({
    memberId: user.member_id || `CUST-${user.partner_id}`,
    name: user.name || `ลูกค้า ${user.partner_id}`,
    totalSpent: Number(user.total_spent || 0),
    orderCount: user.order_count || 0,
    tier: getTierBySpending(Number(user.total_spent)),
    avgOrderValue: user.order_count ? Number(user.total_spent || 0) / user.order_count : 0
  }));
}

function getTierBySpending(spent: number): string {
  if (spent >= 100000) return 'vip';
  if (spent >= 50000) return 'gold';
  if (spent >= 20000) return 'silver';
  return 'bronze';
}

// ============================================
// Odoo Behavior Patterns Query (NEW)
// ============================================

export async function getOdooBehaviorPatterns(days: number = 1): Promise<BehaviorPattern[]> {
  // Get order counts per customer from odoo_orders
  const [customerOrders] = await pool.execute(`
    SELECT 
      partner_id,
      COUNT(*) as order_count
    FROM odoo_orders
    WHERE state NOT IN ('cancel', 'draft')
      AND date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY partner_id
  `, [days]);

  const customers = customerOrders as any[];
  const total = customers.length;

  if (total === 0) {
    return [
      { name: 'Frequent Buyers', description: '6+ orders', count: 0, percentage: 0 },
      { name: 'Regular Buyers', description: '3-5 orders', count: 0, percentage: 0 },
      { name: 'Occasional Buyers', description: '1-2 orders', count: 0, percentage: 0 }
    ];
  }

  // Frequent: 6+ orders
  const frequent = customers.filter(c => c.order_count >= 6).length;
  // Regular: 3-5 orders
  const regular = customers.filter(c => c.order_count >= 3 && c.order_count < 6).length;
  // Occasional: 1-2 orders
  const occasional = customers.filter(c => c.order_count >= 1 && c.order_count < 3).length;

  return [
    { 
      name: 'Frequent Buyers', 
      description: '6+ orders', 
      count: frequent, 
      percentage: total ? Math.round((frequent / total) * 100) : 0 
    },
    { 
      name: 'Regular Buyers', 
      description: '3-5 orders', 
      count: regular, 
      percentage: total ? Math.round((regular / total) * 100) : 0 
    },
    { 
      name: 'Occasional Buyers', 
      description: '1-2 orders', 
      count: occasional, 
      percentage: total ? Math.round((occasional / total) * 100) : 0 
    }
  ].filter(p => p.count > 0);
}

// ============================================
// Odoo Sales Trend Query
// ============================================

export async function getOdooSalesTrend(days: number = 30): Promise<SalesTrendPoint[]> {
  const [rows] = await pool.execute(`
    SELECT 
      DATE(date_order) as date,
      COALESCE(SUM(amount_total), 0) as revenue,
      COUNT(*) as orders
    FROM odoo_orders
    WHERE date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND state NOT IN ('cancel', 'draft')
    GROUP BY DATE(date_order)
    ORDER BY date ASC
  `, [days]);

  return (rows as any[]).map(row => ({
    date: row.date,
    revenue: Number(row.revenue || 0),
    orders: Number(row.orders || 0)
  }));
}

// ============================================
// Order Status Distribution (from Odoo)
// ============================================

export async function getOdooOrderStatusStats(days: number = 1): Promise<Array<{
  status: string;
  count: number;
  percentage: number;
}>> {
  const [rows] = await pool.execute(`
    SELECT 
      state_display as status,
      COUNT(*) as count,
      ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 1) as percentage
    FROM odoo_orders
    WHERE date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    GROUP BY state_display
    ORDER BY count DESC
  `, [days]);

  return (rows as any[]).map(row => ({
    status: row.status,
    count: Number(row.count),
    percentage: Number(row.percentage)
  }));
}

// ============================================
// Recent Odoo Orders
// ============================================

export async function getRecentOdooOrders(limit: number = 10, days: number = 1): Promise<Array<{
  id: string;
  orderName: string;
  customerName: string;
  amount: number;
  status: string;
  date: string;
  isPaid: boolean;
  isDelivered: boolean;
}>> {
  const [rows] = await pool.execute(`
    SELECT 
      o.order_id as id,
      o.order_name as orderName,
      COALESCE(olu.odoo_partner_name, 'ไม่ระบุชื่อ') as customerName,
      o.amount_total as amount,
      o.state_display as status,
      o.date_order as date,
      o.is_paid as isPaid,
      o.is_delivered as isDelivered
    FROM odoo_orders o
    LEFT JOIN odoo_line_users olu ON o.partner_id = olu.odoo_partner_id
    WHERE o.date_order >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
    ORDER BY o.date_order DESC
    LIMIT ?
  `, [days, limit]);

  return (rows as any[]).map(row => ({
    id: String(row.id),
    orderName: row.orderName,
    customerName: row.customerName,
    amount: Number(row.amount),
    status: row.status,
    date: row.date,
    isPaid: !!row.isPaid,
    isDelivered: !!row.isDelivered
  }));
}

// ============================================
// Sentiment Stats Query (unchanged - from messages)
// ============================================

export async function getAvgSentimentScore(): Promise<number> {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        COALESCE(AVG(
          CASE sentiment
            WHEN 'positive' THEN 100
            WHEN 'neutral' THEN 50
            WHEN 'negative' THEN 0
            ELSE 50
          END
        ), 50) as avg_score
      FROM message_sentiment_analysis
      WHERE analyzed_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
    `);

    return Math.round(Number((rows as any[])[0]?.avg_score || 50));
  } catch {
    return 50;
  }
}

export async function getSentimentDistribution(days: number = 30): Promise<{
  positive: number;
  neutral: number;
  negative: number;
}> {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        COALESCE(SUM(CASE WHEN sentiment = 'positive' THEN 1 ELSE 0 END), 0) as positive,
        COALESCE(SUM(CASE WHEN sentiment = 'neutral' THEN 1 ELSE 0 END), 0) as neutral,
        COALESCE(SUM(CASE WHEN sentiment = 'negative' THEN 1 ELSE 0 END), 0) as negative
      FROM message_sentiment_analysis
      WHERE analyzed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);

    const result = (rows as any[])[0];
    return {
      positive: Number(result.positive || 0),
      neutral: Number(result.neutral || 0),
      negative: Number(result.negative || 0)
    };
  } catch {
    return { positive: 0, neutral: 0, negative: 0 };
  }
}

// ============================================
// Complaint Stats Query (unchanged)
// ============================================

export async function getComplaintCategories(days: number = 30): Promise<Array<{
  category: string;
  count: number;
  percentage: number;
}>> {
  try {
    const [countRows] = await pool.execute(`
      SELECT COUNT(*) as total
      FROM message_sentiment_analysis
      WHERE is_complaint = TRUE
        AND analyzed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [days]);

    const total = Number((countRows as any[])[0]?.total || 0);

    if (total === 0) {
      return [];
    }

    const [rows] = await pool.execute(`
      SELECT 
        JSON_UNQUOTE(JSON_EXTRACT(categories, '$[0]')) as category,
        COUNT(*) as count
      FROM message_sentiment_analysis
      WHERE is_complaint = TRUE
        AND analyzed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
      GROUP BY JSON_UNQUOTE(JSON_EXTRACT(categories, '$[0]'))
      ORDER BY count DESC
      LIMIT 5
    `, [days]);

    return (rows as any[]).map(row => ({
      category: row.category || 'other',
      count: Number(row.count),
      percentage: Math.round((Number(row.count) / total) * 100)
    }));
  } catch {
    return [];
  }
}

export async function getRecentIssues(limit: number = 10): Promise<Array<{
  id: string;
  userId: number;
  userName: string | null;
  message: string;
  category: string;
  urgency: 'high' | 'medium' | 'low';
  sentiment: 'positive' | 'neutral' | 'negative';
  detectedAt: string;
}>> {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        msa.id,
        msa.user_id as userId,
        COALESCE(u.real_name, u.display_name, u.custom_display_name) as userName,
        m.content as message,
        JSON_UNQUOTE(JSON_EXTRACT(msa.categories, '$[0]')) as category,
        msa.urgency,
        msa.sentiment,
        msa.analyzed_at as detectedAt
      FROM message_sentiment_analysis msa
      JOIN messages m ON msa.message_id = m.id
      JOIN users u ON msa.user_id = u.id
      WHERE msa.is_complaint = TRUE
      ORDER BY msa.analyzed_at DESC
      LIMIT ?
    `, [limit]);

    return (rows as any[]).map(row => ({
      id: String(row.id),
      userId: row.userId,
      userName: row.userName,
      message: row.message,
      category: row.category || 'other',
      urgency: row.urgency || 'low',
      sentiment: row.sentiment,
      detectedAt: row.detectedAt
    }));
  } catch {
    return [];
  }
}

export async function getTopComplainers(limit: number = 10): Promise<Array<{
  userId: number;
  userName: string | null;
  complaintCount: number;
  lastComplaintAt: string;
}>> {
  try {
    const [rows] = await pool.execute(`
      SELECT 
        msa.user_id as userId,
        COALESCE(u.real_name, u.display_name, u.custom_display_name) as userName,
        COUNT(*) as complaintCount,
        MAX(msa.analyzed_at) as lastComplaintAt
      FROM message_sentiment_analysis msa
      JOIN users u ON msa.user_id = u.id
      WHERE msa.is_complaint = TRUE
      GROUP BY msa.user_id, u.real_name, u.display_name, u.custom_display_name
      ORDER BY complaintCount DESC
      LIMIT ?
    `, [limit]);

    return (rows as any[]).map(row => ({
      userId: row.userId,
      userName: row.userName,
      complaintCount: Number(row.complaintCount),
      lastComplaintAt: row.lastComplaintAt
    }));
  } catch {
    return [];
  }
}

// ============================================
// Unified Analytics Query (Odoo-based)
// ============================================

export async function getUnifiedAnalyticsData(days: number = 1): Promise<UnifiedAnalyticsData> {
  // Fetch all data in parallel using Odoo tables
  const [
    salesStats,
    totalOdooCustomers,
    customerSegments,
    topCustomers,
    behaviorPatterns,
    salesTrend,
    avgSentiment,
    sentimentDistribution,
    complaintCategories,
    recentIssues,
    topComplainers
  ] = await Promise.all([
    getOdooSalesStats(days),
    getTotalOdooCustomers(),
    getOdooCustomerSegments(days),
    getOdooTopCustomers(10, days),
    getOdooBehaviorPatterns(days),
    getOdooSalesTrend(days),
    getAvgSentimentScore(),
    getSentimentDistribution(days),
    getComplaintCategories(days),
    getRecentIssues(10),
    getTopComplainers(10)
  ]);

  // Override totalCustomers with Odoo linked customers count (like Odoo Dashboard shows ~640)
  return {
    stats: {
      ...salesStats,
      totalCustomers: totalOdooCustomers,
      avgSentiment
    },
    salesTrend,
    segments: customerSegments,
    topCustomers,
    behaviorPatterns,
    sentimentDistribution,
    complaintCategories,
    recentIssues,
    topComplainers
  };
}
// ============================================
// Legacy: Backward compatibility
// ============================================

export async function getAllAnalyticsData() {
  return getUnifiedAnalyticsData();
}

// Export old functions for compatibility
export { getSalesStats, getCustomerSegments, getTopCustomers } from './queries-old';
