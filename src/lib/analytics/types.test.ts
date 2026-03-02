import { describe, it, expect } from 'vitest';
import type {
  CustomerSegment,
  TopCustomer,
  SalesStats,
  SalesTrendPoint,
  SentimentDistribution,
  ComplaintCategory,
  RecentIssue,
  TopComplainer,
  SentimentAnalysisResult,
  UnifiedAnalyticsData
} from './types';

describe('Analytics Types', () => {
  describe('SalesStats', () => {
    it('should accept valid sales stats', () => {
      const stats: SalesStats = {
        totalRevenue: 4200000,
        totalCustomers: 102,
        avgOrderValue: 17156.86,
        totalOrders: 245
      };
      
      expect(stats.totalRevenue).toBe(4200000);
      expect(stats.totalCustomers).toBe(102);
    });
  });

  describe('CustomerSegment', () => {
    it('should accept valid customer segment', () => {
      const segment: CustomerSegment = {
        name: 'VIP Customers',
        tier: 'vip',
        minSpent: 100000,
        count: 10,
        percentage: 10
      };
      
      expect(segment.tier).toBe('vip');
      expect(segment.percentage).toBe(10);
    });

    it('should accept all tier types', () => {
      const tiers: CustomerSegment['tier'][] = ['vip', 'gold', 'silver', 'bronze'];
      expect(tiers).toHaveLength(4);
    });
  });

  describe('SalesTrendPoint', () => {
    it('should accept valid trend point', () => {
      const point: SalesTrendPoint = {
        date: '2024-03-01',
        revenue: 150000,
        orders: 15
      };
      
      expect(point.date).toBe('2024-03-01');
      expect(point.revenue).toBe(150000);
    });
  });

  describe('SentimentDistribution', () => {
    it('should accept valid sentiment distribution', () => {
      const distribution: SentimentDistribution = {
        positive: 65,
        neutral: 25,
        negative: 10
      };
      
      expect(distribution.positive).toBe(65);
      expect(distribution.neutral).toBe(25);
      expect(distribution.negative).toBe(10);
    });
  });

  describe('ComplaintCategory', () => {
    it('should accept valid complaint category', () => {
      const category: ComplaintCategory = {
        category: 'delivery',
        count: 15,
        percentage: 30
      };
      
      expect(category.category).toBe('delivery');
      expect(category.count).toBe(15);
    });
  });

  describe('RecentIssue', () => {
    it('should accept valid recent issue', () => {
      const issue: RecentIssue = {
        id: '1',
        userId: 123,
        userName: 'Test User',
        message: 'ส่งช้ามาก',
        category: 'delivery',
        urgency: 'high',
        sentiment: 'negative',
        detectedAt: '2024-03-01T10:00:00Z'
      };
      
      expect(issue.urgency).toBe('high');
      expect(issue.category).toBe('delivery');
    });

    it('should accept all urgency levels', () => {
      const urgencies: RecentIssue['urgency'][] = ['high', 'medium', 'low'];
      expect(urgencies).toHaveLength(3);
    });
  });

  describe('SentimentAnalysisResult', () => {
    it('should accept valid sentiment analysis result', () => {
      const result: SentimentAnalysisResult = {
        sentiment: 'negative',
        confidence: 0.95,
        keywords: ['ส่งช้า', 'รอนาน'],
        categories: ['delivery'],
        summary: 'ลูกค้าไม่พอใจการจัดส่งล่าช้า',
        isComplaint: true,
        urgency: 'high'
      };
      
      expect(result.isComplaint).toBe(true);
      expect(result.confidence).toBe(0.95);
    });
  });

  describe('UnifiedAnalyticsData', () => {
    it('should accept complete unified analytics data', () => {
      const data: UnifiedAnalyticsData = {
        stats: {
          totalRevenue: 4200000,
          totalCustomers: 102,
          avgOrderValue: 17156.86,
          totalOrders: 245,
          avgSentiment: 85
        },
        salesTrend: [
          { date: '2024-03-01', revenue: 150000, orders: 15 }
        ],
        segments: [],
        topCustomers: [],
        behaviorPatterns: [],
        sentimentDistribution: {
          positive: 65,
          neutral: 25,
          negative: 10
        },
        complaintCategories: [],
        recentIssues: [],
        topComplainers: []
      };
      
      expect(data.stats.avgSentiment).toBe(85);
      expect(data.salesTrend).toHaveLength(1);
    });
  });
});
