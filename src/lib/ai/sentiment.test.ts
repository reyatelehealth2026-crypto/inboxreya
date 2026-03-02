import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getSentimentStats,
  getComplaintStats,
  getRecentIssues,
  getTopComplainers
} from './sentiment';

// Mock the database pool
vi.mock('@/lib/db', () => ({
  default: {
    execute: vi.fn()
  }
}));

import pool from '@/lib/db';

describe('Sentiment Service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getSentimentStats', () => {
    it('should return sentiment distribution', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [{ positive: 65, neutral: 25, negative: 10, total: 100 }]
      ] as any);

      const result = await getSentimentStats(30);

      expect(result).toEqual({
        positive: 65,
        neutral: 25,
        negative: 10,
        total: 100
      });
      expect(mockExecute).toHaveBeenCalledWith(
        expect.stringContaining('SELECT'),
        [30]
      );
    });

    it('should handle zero results', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [{ positive: null, neutral: null, negative: null, total: 0 }]
      ] as any);

      const result = await getSentimentStats(7);

      expect(result).toEqual({
        positive: 0,
        neutral: 0,
        negative: 0,
        total: 0
      });
    });
  });

  describe('getComplaintStats', () => {
    it('should return complaint categories', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          { category: 'delivery', count: 15 },
          { category: 'product', count: 8 },
          { category: 'service', count: 5 }
        ]
      ] as any);

      const result = await getComplaintStats(30);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ category: 'delivery', count: 15 });
    });

    it('should return empty array when no complaints', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([[]] as any);

      const result = await getComplaintStats(7);

      expect(result).toEqual([]);
    });
  });

  describe('getRecentIssues', () => {
    it('should return recent issues with correct structure', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 123,
            userName: 'Test User',
            message: 'ส่งช้ามาก',
            category: 'delivery',
            urgency: 'high',
            sentiment: 'negative',
            detectedAt: '2024-03-01T10:00:00Z'
          }
        ]
      ] as any);

      const result = await getRecentIssues(10);

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: '1',
        userId: 123,
        userName: 'Test User',
        message: 'ส่งช้ามาก',
        category: 'delivery',
        urgency: 'high',
        sentiment: 'negative'
      });
    });

    it('should handle null userName', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          {
            id: 1,
            userId: 123,
            userName: null,
            message: 'test',
            category: 'other',
            urgency: 'low',
            sentiment: 'neutral',
            detectedAt: '2024-03-01T10:00:00Z'
          }
        ]
      ] as any);

      const result = await getRecentIssues(5);

      expect(result[0].userName).toBeNull();
    });
  });

  describe('getTopComplainers', () => {
    it('should return top complaining customers', async () => {
      const mockExecute = vi.mocked(pool.execute);
      mockExecute.mockResolvedValueOnce([
        [
          {
            userId: 123,
            userName: 'Problem Customer',
            complaintCount: 15,
            lastComplaintAt: '2024-03-01T10:00:00Z'
          },
          {
            userId: 456,
            userName: 'Another Customer',
            complaintCount: 8,
            lastComplaintAt: '2024-02-28T15:30:00Z'
          }
        ]
      ] as any);

      const result = await getTopComplainers(10);

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({
        userId: 123,
        userName: 'Problem Customer',
        complaintCount: 15
      });
    });
  });
});
