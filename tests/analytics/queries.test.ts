import { vi } from 'vitest';
import { getCustomerSegments, getTopCustomers, getSalesStats } from '@/lib/analytics/queries';

vi.mock('@/lib/db');

describe('Analytics Queries', () => {
  test('getSalesStats should return statistics', async () => {
    const stats = await getSalesStats();
    expect(stats).toHaveProperty('totalRevenue');
    expect(stats).toHaveProperty('totalCustomers');
    expect(stats).toHaveProperty('avgOrderValue');
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
  });

  test('getCustomerSegments should return array', async () => {
    const segments = await getCustomerSegments();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThanOrEqual(0);
  });

  test('getTopCustomers should return top 10', async () => {
    const customers = await getTopCustomers(10);
    expect(Array.isArray(customers)).toBe(true);
    expect(customers.length).toBeLessThanOrEqual(10);
  });
});

describe('Analytics Queries', () => {
  test('getSalesStats should return statistics', async () => {
    const stats = await getSalesStats();
    expect(stats).toHaveProperty('totalRevenue');
    expect(stats).toHaveProperty('totalCustomers');
    expect(stats).toHaveProperty('avgOrderValue');
    expect(stats.totalRevenue).toBeGreaterThanOrEqual(0);
  });

  test('getCustomerSegments should return array', async () => {
    const segments = await getCustomerSegments();
    expect(Array.isArray(segments)).toBe(true);
    expect(segments.length).toBeGreaterThanOrEqual(0);
  });

  test('getTopCustomers should return top 10', async () => {
    const customers = await getTopCustomers(10);
    expect(Array.isArray(customers)).toBe(true);
    expect(customers.length).toBeLessThanOrEqual(10);
  });
});
