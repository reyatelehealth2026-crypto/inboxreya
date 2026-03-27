import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { pushLineMessage } from '@/lib/line-api';

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
        // Parse stored content
        let parsed: Record<string, unknown> = {};
        try {
          parsed = JSON.parse(broadcast.content);
        } catch {
          throw new Error('Invalid broadcast content JSON');
        }

        const messages = (parsed.messages as object[]) || [];
        const tagIds = (parsed.tagIds as number[]) || [];

        if (messages.length === 0) {
          throw new Error('No messages in broadcast content');
        }

        if (tagIds.length === 0) {
          throw new Error('No target tags in broadcast content');
        }

        // Fetch LINE users that have any of the requested tags
        const assignments = await prisma.userTagAssignment.findMany({
          where: {
            tagId: { in: tagIds },
            user: { lineAccountId: broadcast.lineAccountId },
          },
          select: {
            userId: true,
            user: { select: { lineUserId: true, lineAccountId: true } },
          },
          distinct: ['userId'],
        });

        const targetUsers = assignments
          .map((a) => a.user)
          .filter(
            (u): u is { lineUserId: string; lineAccountId: number | null } =>
              Boolean(u?.lineUserId)
          );

        if (targetUsers.length === 0) {
          throw new Error('No target users found for the given tags');
        }

        // Send messages to each user
        let successCount = 0;
        let failCount = 0;

        for (const targetUser of targetUsers) {
          const result = await pushLineMessage(
            targetUser.lineUserId,
            messages as Parameters<typeof pushLineMessage>[1],
            broadcast.lineAccountId
          );

          if (result.success) {
            successCount++;
          } else {
            failCount++;
          }
        }

        // Update broadcast status
        const finalStatus = failCount === targetUsers.length ? 'failed' : 'sent';
        await prisma.broadcastMessageV2.update({
          where: { id: broadcast.id },
          data: {
            status: finalStatus,
            sentAt: new Date(),
            deliveredCount: successCount,
            totalRecipients: targetUsers.length,
          },
        });

        results.push({
          id: broadcast.id,
          status: finalStatus,
          successCount,
          failCount,
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
