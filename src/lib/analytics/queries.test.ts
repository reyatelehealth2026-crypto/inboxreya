import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getOdooSalesStats,
  getOdooCustomerSegments,
  getOdooTopCustomers,
  getOdooBehaviorPatterns,
  getOdooSalesTrend,
  getUnifiedAnalyticsData
} from './queries';

// Mock the database pool
vi.mock('@/lib/db', () => ({
  default: {
    execute: vi.fn()
  }
}));

import pool from '@/lib/db';

describe('Analytics Queries', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getOdooSalesStats', () => {
    it('should return sales statistics', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [{ total_revenue: 4200000, total_customers: 102, avg_order_value: 17156.86, total_orders: 245 }]
      ] as any);

      const result = await getOdooSalesStats(1);

      expect(result).toEqual({
        totalRevenue: 4200000,
        totalCustomers: 102,
        avgOrderValue: 17156.86,
        totalOrders: 245
      });
    });
  });

  describe('getOdooCustomerSegments', () => {
    it('should return customer segments', async () => {
      const mockExecute = vi.mocked(pool.execute);
      // First call for customer spending data
      mockExecute.mockResolvedValueOnce([
        [
          { partner_id: 1, total_spent: 150000, order_count: 10 },
          { partner_id: 2, total_spent: 80000, order_count: 8 },
          { partner_id: 3, total_spent: 30000, order_count: 5 },
          { partner_id: 4, total_spent: 5000, order_count: 2 }
        ]
      ] as any);

      const result = await getOdooCustomerSegments(1);

      expect(result.length).toBeGreaterThan(0);
      expect(result[0]).toHaveProperty('tier');
      expect(result[0]).toHaveProperty('count');
    });
  });

  describe('getOdooTopCustomers', () => {
    it('should return top customers', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          { partner_id: 1, member_id: 'M001', name: 'Test Store', total_spent: 500000, order_count: 50 }
        ]
      ] as any);

      const result = await getOdooTopCustomers(10, 1);

      expect(result).toHaveLength(1);
      expect(result[0].memberId).toBe('M001');
    });
  });

  describe('getOdooBehaviorPatterns', () => {
    it('should return behavior patterns', async () => {
      const mockExecute = vi.mocked(pool.execute);
      // Return customer order counts
      mockExecute.mockResolvedValueOnce([
        [
          { partner_id: 1, order_count: 10 },
          { partner_id: 2, order_count: 5 },
          { partner_id: 3, order_count: 3 },
          { partner_id: 4, order_count: 1 }
        ]
      ] as any);

      const result = await getOdooBehaviorPatterns(1);

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Frequent Buyers');
    });
  });

  describe('getOdooSalesTrend', () => {
    it('should return sales trend for given days', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          { date: '2024-03-01', revenue: 150000, orders: 15 },
          { date: '2024-03-02', revenue: 200000, orders: 20 }
        ]
      ] as any);

      const result = await getOdooSalesTrend(30);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-03-01',
        revenue: 150000,
        orders: 15
      });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DATE(date_order)'),
        [30]
      );
    });
  });

  describe('getUnifiedAnalyticsData', () => {
    it('should return unified analytics data', async () => {
      const mockExecute = vi.mocked(pool.execute);
      
      // Setup mocks for all parallel calls
      mockExecute
        // getOdooSalesStats
        .mockResolvedValueOnce([[{ total_revenue: 4200000, total_customers: 102, avg_order_value: 17156.86, total_orders: 245 }]] as any)
        // getTotalOdooCustomers
        .mockResolvedValueOnce([[{ total: 150 }]] as any)
        // getOdooCustomerSegments - customer spending
        .mockResolvedValueOnce([[{ partner_id: 1, total_spent: 150000, order_count: 10 }]] as any)
        // getOdooTopCustomers
        .mockResolvedValueOnce([[{ partner_id: 1, member_id: 'M001', name: 'Test', total_spent: 500000, order_count: 50 }]] as any)
        // getOdooBehaviorPatterns
        .mockResolvedValueOnce([[{ partner_id: 1, order_count: 10 }]] as any)
        // getOdooSalesTrend
        .mockResolvedValueOnce([[{ date: '2024-03-01', revenue: 150000, orders: 15 }]] as any)
        // getAvgSentimentScore - returns a row with avg_score
        .mockResolvedValueOnce([[{ avg_score: 85 }]] as any)
        // getSentimentDistribution
        .mockResolvedValueOnce([[{ positive: 65, neutral: 25, negative: 10 }]] as any)
        // getComplaintCategories - total count
        .mockResolvedValueOnce([[{ total: 20 }]] as any)
        // getComplaintCategories - breakdown
        .mockResolvedValueOnce([[{ category: 'delivery', count: 10 }, { category: 'product', count: 10 }]] as any)
        // getRecentIssues
        .mockResolvedValueOnce([[{ 
          id: 1, userId: 123, userName: 'Test', message: 'test', 
          category: 'delivery', urgency: 'high', sentiment: 'negative', detectedAt: '2024-03-01' 
        }]] as any)
        // getTopComplainers
        .mockResolvedValueOnce([[{ userId: 123, userName: 'Test', complaintCount: 5, lastComplaintAt: '2024-03-01' }]] as any);

      const result = await getUnifiedAnalyticsData(1);

      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('salesTrend');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('topCustomers');
      expect(result).toHaveProperty('behaviorPatterns');
      expect(result).toHaveProperty('sentimentDistribution');
      expect(result).toHaveProperty('complaintCategories');
      expect(result).toHaveProperty('recentIssues');
      expect(result).toHaveProperty('topComplainers');
      
      // avgSentiment should be included in stats
      expect(typeof result.stats.avgSentiment).toBe('number');
    });
  });
});
