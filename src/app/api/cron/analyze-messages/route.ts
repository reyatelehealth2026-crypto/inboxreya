import { NextResponse } from 'next/server';
import { runBatchSentimentAnalysis } from '@/lib/ai/sentiment';

/**
 * GET /api/cron/analyze-messages
 * Cron job endpoint for hourly sentiment analysis
 * Called by Vercel Cron or external scheduler
 * 
 * Environment:
 * - CRON_SECRET: Required secret for authorization
 */
export async function GET(request: Request) {
  try {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get('authorization');
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json(
          { error: 'Unauthorized' },
          { status: 401 }
        );
      }
    }

    console.log('[Cron] Starting batch sentiment analysis...');
    
    const result = await runBatchSentimentAnalysis(100);

    console.log(`[Cron] Processed ${result.processed} messages, found ${result.complaints} complaints`);

    return NextResponse.json({
      success: true,
      processed: result.processed,
      complaints: result.complaints,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('[Cron] Analysis error:', error);
    return NextResponse.json(
      { error: 'Failed to run cron analysis' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cron/analyze-messages
 * Alternative endpoint for POST requests
 */
export async function POST(request: Request) {
  return GET(request);
}
