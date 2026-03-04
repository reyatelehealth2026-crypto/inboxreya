import { GET } from '@/app/api/analytics/route';

describe('Analytics API', () => {
  test('GET should return analytics data', async () => {
    // Create mock request with default days parameter
    const request = new Request('http://localhost:3000/api/analytics');
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('segments');
    expect(data).toHaveProperty('topCustomers');
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('behaviorPatterns');
    expect(Array.isArray(data.segments)).toBe(true);
    expect(Array.isArray(data.topCustomers)).toBe(true);
  });

  test('GET should accept days parameter', async () => {
    // Create mock request with days parameter
    const request = new Request('http://localhost:3000/api/analytics?days=7');
    const response = await GET(request);
    expect(response.status).toBe(200);
    
    const data = await response.json();
    expect(data).toHaveProperty('stats');
    expect(data).toHaveProperty('salesTrend');
  });
});
