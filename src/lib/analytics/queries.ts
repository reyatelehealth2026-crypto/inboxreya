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
// Sales Stats Queries
// ============================================

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

// ============================================
// Customer Segment Queries
// ============================================

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
    { name: 'VIP Customers', tier: 'vip' as const, minSpent: 100000, count: vip, percentage: total ? Math.round((vip / total) * 100) : 0 },
    { name: 'Gold Customers', tier: 'gold' as const, minSpent: 50000, maxSpent: 99999, count: gold, percentage: total ? Math.round((gold / total) * 100) : 0 },
    { name: 'Silver Customers', tier: 'silver' as const, minSpent: 20000, maxSpent: 49999, count: silver, percentage: total ? Math.round((silver / total) * 100) : 0 },
    { name: 'Bronze Customers', tier: 'bronze' as const, minSpent: 1, maxSpent: 19999, count: bronze, percentage: total ? Math.round((bronze / total) * 100) : 0 }
  ].filter(s => s.count > 0);
}

// ============================================
// Top Customers Query
// ============================================

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

// ============================================
// Behavior Pattern Queries
// ============================================

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

// ============================================
// Sales Trend Query
// ============================================

export async function getSalesTrend(days: number = 30): Promise<SalesTrendPoint[]> {
  const [rows] = await pool.execute(`
    SELECT 
      DATE(created_at) as date,
      COALESCE(SUM(total_spent), 0) as revenue,
      COALESCE(SUM(order_count), 0) as orders
    FROM users
    WHERE created_at >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
      AND total_spent > 0
    GROUP BY DATE(created_at)
    ORDER BY date ASC
  `, [days]);

  return (rows as any[]).map(row => ({
    date: row.date,
    revenue: Number(row.revenue || 0),
    orders: Number(row.orders || 0)
  }));
}

// ============================================
// Sentiment Stats Query
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
    // Return neutral if table doesn't exist or error
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
// Complaint Stats Query
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

// ============================================
// Recent Issues Query
// ============================================

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

// ============================================
// Top Complainers Query
// ============================================

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
// Unified Analytics Query
// ============================================

export async function getUnifiedAnalyticsData(): Promise<UnifiedAnalyticsData> {
  // Fetch all data in parallel
  const [
    salesStats,
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
    getSalesStats(),
    getCustomerSegments(),
    getTopCustomers(10),
    getBehaviorPatterns(),
    getSalesTrend(30),
    getAvgSentimentScore(),
    getSentimentDistribution(30),
    getComplaintCategories(30),
    getRecentIssues(10),
    getTopComplainers(10)
  ]);

  return {
    stats: {
      ...salesStats,
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
