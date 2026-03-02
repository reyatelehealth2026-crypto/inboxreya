import { GET } from '@/app/api/analytics/route';

describe('Analytics API', () => {
  test('GET should return analytics data', async () => {
    const response = await GET();
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('segments');
    expect(data).toHaveProperty('topCustomers');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('behaviorPatterns');
    expect(Array.isArray(data.segments)).toBe(true);
    expect(Array.isArray(data.topCustomers)).toBe(true);
  });
});
