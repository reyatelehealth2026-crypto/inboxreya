import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const { messages, tagIds, scheduledAt, totalRecipients, title } = body;

    if (!messages || !tagIds || !scheduledAt) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Fetch tag names for display
    const tags = await prisma.userTag.findMany({
      where: { id: { in: tagIds } },
      select: { id: true, name: true, color: true },
    });

    const content = JSON.stringify({
      type: 'catalog_broadcast',
      title: title || 'โปรโมชั่น',
      messages,
      tagIds,
      tags: tags.map((t) => ({ id: t.id, name: t.name, color: t.color })),
    });

    const broadcast = await prisma.broadcastMessageV2.create({
      data: {
        lineAccountId: user.lineAccountId as number,
        content,
        scheduledAt: new Date(scheduledAt),
        totalRecipients: totalRecipients || 0,
        status: 'scheduled',
        createdBy: parseInt(user.id),
      },
    });

    return NextResponse.json({ success: true, data: { id: broadcast.id } });
  } catch (error) {
    console.error('Error scheduling broadcast:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
