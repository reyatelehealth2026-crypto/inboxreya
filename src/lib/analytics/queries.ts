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
