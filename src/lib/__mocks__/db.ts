import { vi } from 'vitest';

/**
 * Automatic mock for src/lib/db.ts (mysql2/promise pool).
 * Used by vitest when a test calls `vi.mock('@/lib/db')` without a factory.
 *
 * The mock's `execute` function inspects the SQL string and returns
 * realistic stub data so analytics query functions can be unit-tested
 * without a real database connection.
 */
const execute = vi.fn().mockImplementation((sql: string) => {
  const s = String(sql);

  // ── Odoo queries (queries.ts) ──────────────────────────────────────────

  // Top customers: JOIN between odoo_orders and odoo_line_users
  if (s.includes('odoo_line_users') && s.includes('odoo_orders')) {
    return Promise.resolve([[
      { partner_id: 1, member_id: 'PC001', name: 'Test Customer', total_spent: 150000, order_count: 5 }
    ], []]);
  }

  // Total customer count from odoo_line_users
  if (s.includes('odoo_line_users')) {
    return Promise.resolve([[{ total: 640 }], []]);
  }

  // Sales trend: grouped by date
  if (s.includes('DATE(date_order)')) {
    return Promise.resolve([[
      { date: '2026-01-01', revenue: 1000, orders: 5 }
    ], []]);
  }

  // Odoo sales stats aggregate
  if (s.includes('COALESCE(SUM(amount_total), 0) as total_revenue')) {
    return Promise.resolve([[
      { total_revenue: 4220946, total_customers: 102, avg_order_value: 17229, total_orders: 245 }
    ], []]);
  }

  // Customer segments: SUM(amount_total) as total_spent grouped by partner
  if (s.includes('odoo_orders') && s.includes('total_spent') && s.includes('GROUP BY partner_id')) {
    return Promise.resolve([[
      { partner_id: 1, total_spent: 150000, order_count: 5 },
      { partner_id: 2, total_spent: 60000, order_count: 3 },
      { partner_id: 3, total_spent: 25000, order_count: 7 }
    ], []]);
  }

  // Behavior patterns: order_count grouped by partner
  if (s.includes('odoo_orders') && s.includes('order_count') && s.includes('GROUP BY partner_id')) {
    return Promise.resolve([[
      { partner_id: 1, order_count: 7 },
      { partner_id: 2, order_count: 4 },
      { partner_id: 3, order_count: 2 }
    ], []]);
  }

  // ── Sentiment / complaint queries (queries.ts, try/catch) ─────────────

  // Sentiment average score
  if (s.includes('message_sentiment_analysis') && s.includes('AVG(')) {
    return Promise.resolve([[{ avg_score: 75 }], []]);
  }

  // Sentiment distribution (positive / neutral / negative counts)
  if (s.includes('message_sentiment_analysis') && s.includes('SUM(CASE WHEN sentiment')) {
    return Promise.resolve([[{ positive: 10, neutral: 5, negative: 2 }], []]);
  }

  // Complaint total count
  if (
    s.includes('message_sentiment_analysis') &&
    s.includes('is_complaint = TRUE') &&
    s.includes('COUNT(*) as total')
  ) {
    return Promise.resolve([[{ total: 5 }], []]);
  }

  // Complaint category breakdown
  if (s.includes('message_sentiment_analysis') && s.includes('JSON_UNQUOTE')) {
    return Promise.resolve([[{ category: 'delivery', count: 3 }], []]);
  }

  // Recent issues (joins messages table)
  if (s.includes('message_sentiment_analysis') && s.includes('JOIN messages')) {
    return Promise.resolve([[{
      id: 1, userId: 1, userName: 'Test User', message: 'Test complaint',
      category: 'delivery', urgency: 'low', sentiment: 'negative',
      detectedAt: '2026-01-01T00:00:00'
    }], []]);
  }

  // Top complainers
  if (s.includes('message_sentiment_analysis') && s.includes('complaintCount')) {
    return Promise.resolve([[{
      userId: 1, userName: 'Test User', complaintCount: 3,
      lastComplaintAt: '2026-01-01T00:00:00'
    }], []]);
  }

  // ── Legacy queries (queries-old.ts) ───────────────────────────────────

  // getSalesStats: aggregate from users table
  if (s.includes('SUM(total_spent)') && s.includes('FROM users')) {
    return Promise.resolve([[
      { total_spent: 4220946, count: 102, avg_spent: 41382, total_orders: 245 }
    ], []]);
  }

  // getCustomerSegments tier COUNT queries
  if (s.includes('COUNT(*) as count') && s.includes('FROM users') && s.includes('total_spent')) {
    return Promise.resolve([[{ count: 7 }], []]);
  }

  // getTopCustomers from users
  if (s.includes('FROM users') && s.includes('ORDER BY total_spent DESC')) {
    return Promise.resolve([[{
      member_id: 'PC001', name: 'Test Customer',
      total_spent: 180000, order_count: 10, tier: 'vip'
    }], []]);
  }

  // Default: return a single empty row so callers that access rows[0] don't throw
  return Promise.resolve([[{}], []]);
});

const mockPool = { execute };

export default mockPool;
