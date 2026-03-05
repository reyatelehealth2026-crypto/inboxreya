import { describe, test, expect } from 'vitest';
import { getUnifiedAnalyticsData } from '@/lib/analytics/queries';

describe('Analytics Dashboard Integration', () => {
  test('should fetch all analytics data successfully', async () => {
    const data = await getUnifiedAnalyticsData(1);
    
    // Verify structure
    expect(data).toHaveProperty('segments');
    expect(data).toHaveProperty('topCustomers');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('behaviorPatterns');
    
    // Verify arrays
    expect(Array.isArray(data.segments)).toBe(true);
    expect(Array.isArray(data.topCustomers)).toBe(true);
    expect(Array.isArray(data.behaviorPatterns)).toBe(true);
    
    // Verify stats structure
    expect(data.stats).toHaveProperty('totalRevenue');
    expect(data.stats).toHaveProperty('totalCustomers');
    expect(data.stats).toHaveProperty('avgOrderValue');
    expect(data.stats).toHaveProperty('totalOrders');
    
    // Verify data types
    expect(typeof data.stats.totalRevenue).toBe('number');
    expect(typeof data.stats.totalCustomers).toBe('number');
    expect(data.stats.totalRevenue).toBeGreaterThanOrEqual(0);
    expect(data.stats.totalCustomers).toBeGreaterThanOrEqual(0);
  });

  test('should have valid customer segments', async () => {
    const data = await getUnifiedAnalyticsData(1);
    
    if (data.segments.length > 0) {
      const segment = data.segments[0];
      expect(segment).toHaveProperty('name');
      expect(segment).toHaveProperty('tier');
      expect(segment).toHaveProperty('count');
      expect(segment).toHaveProperty('percentage');
      expect(typeof segment.count).toBe('number');
      expect(typeof segment.percentage).toBe('number');
    }
  });

  test('should have valid top customers', async () => {
    const data = await getUnifiedAnalyticsData(1);
    
    if (data.topCustomers.length > 0) {
      const customer = data.topCustomers[0];
      expect(customer).toHaveProperty('memberId');
      expect(customer).toHaveProperty('name');
      expect(customer).toHaveProperty('totalSpent');
      expect(customer).toHaveProperty('orderCount');
      expect(customer).toHaveProperty('tier');
      expect(typeof customer.totalSpent).toBe('number');
      expect(typeof customer.orderCount).toBe('number');
    }
  });
});
