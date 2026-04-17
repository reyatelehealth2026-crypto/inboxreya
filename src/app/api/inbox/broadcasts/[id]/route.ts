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
