import { NextResponse } from 'next/server';
import { getAllAnalyticsData } from '@/lib/analytics/queries';

export async function GET() {
  try {
    const data = await getAllAnalyticsData();
    return NextResponse.json(data);
  } catch (error) {
    console.error('Analytics API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics data' },
      { status: 500 }
    );
  }
}
