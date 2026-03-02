import { CustomerSegment, TopCustomer, SalesStats } from '@/lib/analytics/types';

describe('Analytics Types', () => {
  test('CustomerSegment should have required fields', () => {
    const segment: CustomerSegment = {
      name: 'VIP',
      tier: 'vip',
      minSpent: 100000,
      count: 10,
      percentage: 10
    };
    expect(segment.name).toBe('VIP');
    expect(segment.count).toBe(10);
  });

  test('TopCustomer should have required fields', () => {
    const customer: TopCustomer = {
      memberId: 'PC001',
      name: 'Test Customer',
      totalSpent: 50000,
      orderCount: 5,
      tier: 'gold'
    };
    expect(customer.memberId).toBe('PC001');
    expect(customer.totalSpent).toBe(50000);
  });

  test('SalesStats should have required fields', () => {
    const stats: SalesStats = {
      totalRevenue: 1000000,
      totalCustomers: 100,
      avgOrderValue: 5000,
      totalOrders: 200
    };
    expect(stats.totalRevenue).toBe(1000000);
    expect(stats.avgOrderValue).toBe(5000);
  });
});
