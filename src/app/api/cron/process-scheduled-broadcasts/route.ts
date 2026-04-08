import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { sendBroadcastRecord } from '@/lib/broadcast-runtime';

/**
 * GET /api/cron/process-scheduled-broadcasts
 *
 * Cron job that finds all broadcasts with status='scheduled' whose
 * scheduledAt has passed, and sends them to the targeted LINE users.
 *
 * Expected to be called every minute via Vercel Cron or external scheduler.
 */
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret to prevent unauthorized access
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const now = new Date();

    // Find all scheduled broadcasts that are due
    const dueBroadcasts = await prisma.broadcastMessageV2.findMany({
      where: {
        status: 'scheduled',
        scheduledAt: { lte: now },
      },
      orderBy: { scheduledAt: 'asc' },
    });

    if (dueBroadcasts.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'No scheduled broadcasts to process',
        processed: 0,
      });
    }

    const results: Array<{
      id: number;
      status: string;
      successCount: number;
      failCount: number;
      error?: string;
    }> = [];

    for (const broadcast of dueBroadcasts) {
      // Mark as sending immediately to prevent duplicate processing
      await prisma.broadcastMessageV2.update({
        where: { id: broadcast.id },
        data: { status: 'sending' },
      });

      try {
        const result = await sendBroadcastRecord({
          id: broadcast.id,
          lineAccountId: broadcast.lineAccountId,
          content: broadcast.content,
          mediaUrl: broadcast.mediaUrl,
        });

        await prisma.broadcastMessageV2.update({
          where: { id: broadcast.id },
          data: {
            status: result.finalStatus,
            sentAt: result.finalStatus === 'sent' ? new Date() : null,
            deliveredCount: result.successCount,
            totalRecipients: result.totalRecipients,
          },
        });

        results.push({
          id: broadcast.id,
          status: result.finalStatus,
          successCount: result.successCount,
          failCount: result.failCount,
        });
      } catch (error) {
        // Mark as failed if processing errors out
        await prisma.broadcastMessageV2.update({
          where: { id: broadcast.id },
          data: { status: 'failed' },
        });

        results.push({
          id: broadcast.id,
          status: 'failed',
          successCount: 0,
          failCount: 0,
          error: (error as Error).message,
        });

        console.error(
          `Failed to process broadcast ${broadcast.id}:`,
          (error as Error).message
        );
      }
    }

    console.log(
      `[cron] Processed ${results.length} scheduled broadcasts:`,
      results.map((r) => `#${r.id}=${r.status}`).join(', ')
    );

    return NextResponse.json({
      success: true,
      processed: results.length,
      results,
    });
  } catch (error) {
    console.error('Error in process-scheduled-broadcasts cron:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
