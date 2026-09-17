import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { buildBroadcastEnvelope } from '@/lib/broadcast-runtime';
import { imagemapInputSchema } from '@/lib/imagemap-types';
import { z } from 'zod';

const scheduleImagemapSchema = z.object({
  imagemap: imagemapInputSchema,
  content: z.string().max(5000).optional(),
  flexContent: z.any().optional(),
  scheduledAt: z.string().min(1),
  totalRecipients: z.number().int().nonnegative().optional(),
  targetTagIds: z.array(z.number().int().positive()).optional(),
  tagIds: z.array(z.number().int().positive()).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();

    // Imagemap broadcasts are stored as a v2 composer envelope (the legacy branch
    // below keeps its own catalog_broadcast shape).
    if (body?.imagemap) {
      const validated = scheduleImagemapSchema.parse(body);
      const scheduled = new Date(validated.scheduledAt);
      if (!Number.isFinite(scheduled.getTime())) {
        return NextResponse.json(
          { success: false, error: 'Invalid scheduledAt' },
          { status: 400 }
        );
      }

      const envelope = buildBroadcastEnvelope({
        content: validated.content,
        flexContent: validated.flexContent,
        imagemap: validated.imagemap,
        targetTagIds: validated.targetTagIds ?? validated.tagIds,
      });

      const broadcast = await prisma.broadcastMessageV2.create({
        data: {
          lineAccountId: user.lineAccountId as number,
          content: JSON.stringify(envelope),
          scheduledAt: scheduled,
          totalRecipients: validated.totalRecipients ?? 0,
          status: 'scheduled',
          createdBy: parseInt(user.id),
        },
      });

      return NextResponse.json({ success: true, data: { id: broadcast.id } });
    }

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
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error scheduling broadcast:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message },
      { status: 500 }
    );
  }
}
