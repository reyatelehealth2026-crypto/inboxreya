import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET as getAnalytics } from '@/app/api/analytics/route';
import { POST as postAnalyze } from '@/app/api/analytics/analyze/route';
import { GET as getCron } from '@/app/api/cron/analyze-messages/route';

// Mock the analytics queries
vi.mock('@/lib/analytics/queries', () => ({
  getUnifiedAnalyticsData: vi.fn()
}));

// Mock the sentiment service
vi.mock('@/lib/ai/sentiment', () => ({
  runBatchSentimentAnalysis: vi.fn()
}));

import { getUnifiedAnalyticsData } from '@/lib/analytics/queries';
import { runBatchSentimentAnalysis } from '@/lib/ai/sentiment';

describe('Analytics API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('GET /api/analytics', () => {
    it('should return unified analytics data', async () => {
      const mockData = {
        stats: { totalRevenue: 1000, totalCustomers: 10, avgOrderValue: 100, totalOrders: 10, avgSentiment: 75 },
        salesTrend: [],
        segments: [],
        topCustomers: [],
        behaviorPatterns: [],
        sentimentDistribution: { positive: 50, neutral: 30, negative: 20 },
        complaintCategories: [],
        recentIssues: [],
        topComplainers: []
      };

      vi.mocked(getUnifiedAnalyticsData).mockResolvedValueOnce(mockData);

      const request = new Request('http://localhost/api/analytics');
      const response = await getAnalytics(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json).toEqual(mockData);
      expect(json.stats.avgSentiment).toBe(75);
    });

    it('should return 500 on error', async () => {
      vi.mocked(getUnifiedAnalyticsData).mockRejectedValueOnce(new Error('DB Error'));

      const request = new Request('http://localhost/api/analytics');
      const response = await getAnalytics(request);
      const json = await response.json();

      expect(response.status).toBe(500);
      expect(json.error).toBe('Failed to fetch analytics data');
    });
  });

  describe('POST /api/analytics/analyze', () => {
    it('should run batch sentiment analysis', async () => {
      vi.mocked(runBatchSentimentAnalysis).mockResolvedValueOnce({ processed: 50, complaints: 5 });

      const request = new Request('http://localhost/api/analytics/analyze?batchSize=50');
      const response = await postAnalyze(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processed).toBe(50);
      expect(json.complaints).toBe(5);
      expect(json.timestamp).toBeDefined();
    });

    it('should cap batch size at 100', async () => {
      vi.mocked(runBatchSentimentAnalysis).mockResolvedValueOnce({ processed: 100, complaints: 10 });

      const request = new Request('http://localhost/api/analytics/analyze?batchSize=200');
      await postAnalyze(request);

      expect(runBatchSentimentAnalysis).toHaveBeenCalledWith(100);
    });
  });

  describe('GET /api/cron/analyze-messages', () => {
    it('should run cron analysis', async () => {
      vi.mocked(runBatchSentimentAnalysis).mockResolvedValueOnce({ processed: 100, complaints: 10 });

      const request = new Request('http://localhost/api/cron/analyze-messages');
      const response = await getCron(request);
      const json = await response.json();

      expect(response.status).toBe(200);
      expect(json.success).toBe(true);
      expect(json.processed).toBe(100);
    });
  });
});
