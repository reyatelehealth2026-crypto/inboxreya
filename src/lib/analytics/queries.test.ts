import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSalesStats,
  getCustomerSegments,
  getTopCustomers,
  getBehaviorPatterns,
  getSalesTrend,
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

  describe('getSalesStats', () => {
    it('should return sales statistics', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [{ total_spent: 4200000, count: 102, avg_spent: 17156.86, total_orders: 245 }]
      ] as any);

      const result = await getSalesStats();

      expect(result).toEqual({
        totalRevenue: 4200000,
        totalCustomers: 102,
        avgOrderValue: 17156.86,
        totalOrders: 245
      });
    });
  });

  describe('getCustomerSegments', () => {
    it('should return customer segments', async () => {
      const mockExecute = vi.mocked(pool.execute);
      // First call for total count
      mockExecute.mockResolvedValueOnce([
        [{ total_spent: 1000000, count: 100, avg_spent: 10000, total_orders: 500 }]
      ] as any);
      // VIP count
      mockExecute.mockResolvedValueOnce([[{ count: 10 }]] as any);
      // Gold count
      mockExecute.mockResolvedValueOnce([[{ count: 20 }]] as any);
      // Silver count
      mockExecute.mockResolvedValueOnce([[{ count: 30 }]] as any);
      // Bronze count
      mockExecute.mockResolvedValueOnce([[{ count: 40 }]] as any);

      const result = await getCustomerSegments();

      expect(result).toHaveLength(4);
      expect(result[0].tier).toBe('vip');
      expect(result[0].count).toBe(10);
    });
  });

  describe('getTopCustomers', () => {
    it('should return top customers', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          { member_id: 'M001', name: 'Test Store', total_spent: 500000, order_count: 50, tier: 'gold' }
        ]
      ] as any);

      const result = await getTopCustomers(10);

      expect(result).toHaveLength(1);
      expect(result[0].memberId).toBe('M001');
      expect(result[0].avgOrderValue).toBe(10000);
    });
  });

  describe('getBehaviorPatterns', () => {
    it('should return behavior patterns', async () => {
      const mockExecute = vi.mocked(pool.execute);
      // Total count
      mockExecute.mockResolvedValueOnce([[{ count: 100 }]] as any);
      // Frequent buyers
      mockExecute.mockResolvedValueOnce([[{ count: 20 }]] as any);
      // Regular buyers
      mockExecute.mockResolvedValueOnce([[{ count: 30 }]] as any);
      // Occasional buyers
      mockExecute.mockResolvedValueOnce([[{ count: 50 }]] as any);

      const result = await getBehaviorPatterns();

      expect(result).toHaveLength(3);
      expect(result[0].name).toBe('Frequent Buyers');
    });
  });

  describe('getSalesTrend', () => {
    it('should return sales trend for given days', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          { date: '2024-03-01', revenue: 150000, orders: 15 },
          { date: '2024-03-02', revenue: 200000, orders: 20 }
        ]
      ] as any);

      const result = await getSalesTrend(30);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({
        date: '2024-03-01',
        revenue: 150000,
        orders: 15
      });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('DATE(created_at)'),
        [30]
      );
    });
  });

  describe('getUnifiedAnalyticsData', () => {
    it('should return unified analytics data', async () => {
      const mockExecute = vi.mocked(pool.execute);
      
      // Setup mocks for all parallel calls
      mockExecute
        // getSalesStats
        .mockResolvedValueOnce([[{ total_spent: 4200000, count: 102, avg_spent: 17156.86, total_orders: 245 }]] as any)
        // getCustomerSegments - total
        .mockResolvedValueOnce([[{ total_spent: 1000000, count: 100, avg_spent: 10000, total_orders: 500 }]] as any)
        // getCustomerSegments - VIP
        .mockResolvedValueOnce([[{ count: 10 }]] as any)
        // getCustomerSegments - Gold
        .mockResolvedValueOnce([[{ count: 20 }]] as any)
        // getCustomerSegments - Silver
        .mockResolvedValueOnce([[{ count: 30 }]] as any)
        // getCustomerSegments - Bronze
        .mockResolvedValueOnce([[{ count: 40 }]] as any)
        // getTopCustomers
        .mockResolvedValueOnce([[{ member_id: 'M001', name: 'Test', total_spent: 500000, order_count: 50, tier: 'gold' }]] as any)
        // getBehaviorPatterns - total
        .mockResolvedValueOnce([[{ count: 100 }]] as any)
        // getBehaviorPatterns - frequent
        .mockResolvedValueOnce([[{ count: 20 }]] as any)
        // getBehaviorPatterns - regular
        .mockResolvedValueOnce([[{ count: 30 }]] as any)
        // getBehaviorPatterns - occasional
        .mockResolvedValueOnce([[{ count: 50 }]] as any)
        // getSalesTrend
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

      const result = await getUnifiedAnalyticsData();

      expect(result).toHaveProperty('stats');
      expect(result).toHaveProperty('salesTrend');
      expect(result).toHaveProperty('segments');
      expect(result).toHaveProperty('topCustomers');
      expect(result).toHaveProperty('behaviorPatterns');
      expect(result).toHaveProperty('sentimentDistribution');
      expect(result).toHaveProperty('complaintCategories');
      expect(result).toHaveProperty('recentIssues');
      expect(result).toHaveProperty('topComplainers');
      
      // avgSentiment should be included in stats (default 50 if sentiment table has issues)
      expect(typeof result.stats.avgSentiment).toBe('number');
    });
  });
});
