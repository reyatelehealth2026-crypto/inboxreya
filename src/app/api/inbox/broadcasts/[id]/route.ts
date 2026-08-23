import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { cacheInvalidate } from '@/lib/redis';

const LEGACY_BROADCAST_STATUS_ERROR = /data truncated for column 'status'/i;

const isLegacyBroadcastStatusError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  return LEGACY_BROADCAST_STATUS_ERROR.test(error.message);
};

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 }
      );
    }

    const body = (await request.json()) as {
      scheduledAt?: string
      replaceBcid?: boolean
    };

    const wantsReplaceBcid = body.replaceBcid === true;
    const wantsReschedule = typeof body.scheduledAt === 'string' && body.scheduledAt.length > 0;

    if (!wantsReschedule && !wantsReplaceBcid) {
      return NextResponse.json(
        { success: false, error: 'scheduledAt or replaceBcid is required' },
        { status: 400 }
      );
    }

    let newDate: Date | null = null;
    if (wantsReschedule) {
      newDate = new Date(body.scheduledAt as string);
      if (isNaN(newDate.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid scheduledAt' },
          { status: 400 }
        );
      }
      if (newDate.getTime() <= Date.now()) {
        return NextResponse.json(
          { success: false, error: 'scheduledAt must be in the future' },
          { status: 400 }
        );
      }
    }

    const broadcast = await prisma.broadcastMessageV2.findFirst({
      where: { id, lineAccountId: user.lineAccountId as number },
    });

    if (!broadcast) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    if (broadcast.status !== 'scheduled' && broadcast.status !== 'draft') {
      return NextResponse.json(
        { success: false, error: 'Only scheduled or draft broadcasts can be edited' },
        { status: 400 }
      );
    }

    // Build patch payload: optional content rewrite for {{BCID}} placeholders.
    const updateData: { scheduledAt?: Date; content?: string } = {};
    if (newDate) updateData.scheduledAt = newDate;

    let replacedCount = 0;
    if (wantsReplaceBcid && typeof broadcast.content === 'string') {
      const placeholder = '{{BCID}}';
      const idStr = String(id);
      const occurrences = broadcast.content.split(placeholder).length - 1;
      if (occurrences > 0) {
        updateData.content = broadcast.content.split(placeholder).join(idStr);
        replacedCount = occurrences;
      }
    }

    await prisma.broadcastMessageV2.update({
      where: { id },
      data: updateData,
    });

    await cacheInvalidate('broadcasts:*');

    return NextResponse.json({
      success: true,
      data: {
        id,
        scheduledAt: newDate?.toISOString() ?? broadcast.scheduledAt?.toISOString() ?? null,
        bcidReplacements: replacedCount,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const { id: idStr } = await params;
    const id = parseInt(idStr);
    if (isNaN(id)) {
      return NextResponse.json(
        { success: false, error: 'Invalid id' },
        { status: 400 }
      );
    }

    const broadcast = await prisma.broadcastMessageV2.findFirst({
      where: { id, lineAccountId: user.lineAccountId as number },
    });

    if (!broadcast) {
      return NextResponse.json(
        { success: false, error: 'Not found' },
        { status: 404 }
      );
    }

    try {
      await prisma.broadcastMessageV2.update({
        where: { id },
        data: { status: 'cancelled' },
      });
    } catch (error) {
      // Older databases still use the pre-cancel enum. Fall back to deleting
      // unsent broadcasts so the user can still cancel until the migration lands.
      const canDeleteLegacyRecord =
        broadcast.status === 'draft' || broadcast.status === 'scheduled';

      if (
        !canDeleteLegacyRecord ||
        !isLegacyBroadcastStatusError(error)
      ) {
        throw error;
      }

      await prisma.broadcastMessageV2.delete({
        where: { id },
      });
    }

    await cacheInvalidate('broadcasts:*');

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
