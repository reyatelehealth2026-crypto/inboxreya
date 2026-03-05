import { NextResponse } from 'next/server';
import { runBatchSentimentAnalysis } from '@/lib/ai/sentiment';

/**
 * POST /api/analytics/analyze
 * Trigger AI sentiment analysis on unanalyzed messages
 * 
 * Query params:
 * - batchSize: number of messages to analyze (default: 50, max: 100)
 */
export async function POST(request: Request) {
  try {
    // Check for API secret if configured
    const apiSecret = process.env.INTERNAL_API_SECRET;
    if (apiSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${apiSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    // Parse batch size from query params
    const { searchParams } = new URL(request.url);
    const batchSize = Math.min(
      parseInt(searchParams.get('batchSize') || '50', 10),
      100
    );

    const result = await runBatchSentimentAnalysis(batchSize);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      complaints: result.complaints,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Analyze API error:', error);
    return NextResponse.json(
      { error: 'Failed to run sentiment analysis' },
      { status: 500 }
    );
  }
}
