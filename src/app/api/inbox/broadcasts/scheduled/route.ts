import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const broadcasts = await prisma.broadcastMessageV2.findMany({
      where: {
        lineAccountId: user.lineAccountId as number,
        status: 'scheduled',
      },
      orderBy: { scheduledAt: 'asc' },
    });

    const data = broadcasts.map((b) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(b.content);
      } catch {
        // leave parsed as empty object
      }
      return {
        id: b.id,
        title: (parsed.title as string) || 'โปรโมชั่น',
        messages: (parsed.messages as unknown[]) || [],
        tags: (parsed.tags as { id: number; name: string; color: string }[]) || [],
        tagIds: (parsed.tagIds as number[]) || [],
        scheduledAt: b.scheduledAt?.toISOString() || null,
        totalRecipients: b.totalRecipients,
        status: b.status,
        createdAt: b.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error('Error fetching scheduled broadcasts:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
