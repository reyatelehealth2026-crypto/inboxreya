import { NextResponse } from 'next/server';
import { getUnifiedAnalyticsData } from '@/lib/analytics/queries';

/**
 * GET /api/analytics
 * Returns unified analytics data including:
 * - Sales stats and trends
 * - Customer segments and behavior
 * - AI sentiment analysis
 * - Complaint categories and recent issues
 */
export async function GET() {
  try {
    const data = await getUnifiedAnalyticsData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
