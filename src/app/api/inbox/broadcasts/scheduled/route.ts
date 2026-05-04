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

    // Resolve tag display info for V2 envelopes (which only store tagIds in `target`).
    const tagIdsToFetch = new Set<number>();
    const parsedRows = broadcasts.map((b) => {
      let parsed: Record<string, unknown> = {};
      try {
        parsed = JSON.parse(b.content);
      } catch {
        // leave parsed as empty object
      }

      const isV2Envelope = parsed.version === 2 && parsed.kind === 'composer_broadcast';
      const target = (parsed.target as { mode?: string; tagIds?: number[] } | undefined) || undefined;
      const v2TagIds = isV2Envelope && target?.mode === 'tags' && Array.isArray(target.tagIds) ? target.tagIds : [];
      const legacyTagIds = (parsed.tagIds as number[]) || [];
      const tagIds = v2TagIds.length > 0 ? v2TagIds : legacyTagIds;
      for (const id of tagIds) tagIdsToFetch.add(id);

      return { broadcast: b, parsed, isV2Envelope, tagIds };
    });

    const tagsRecord = tagIdsToFetch.size > 0
      ? await prisma.userTag.findMany({
          where: { id: { in: Array.from(tagIdsToFetch) } },
          select: { id: true, name: true, color: true },
        })
      : [];
    const tagsById = new Map(tagsRecord.map((t) => [t.id, t]));

    const data = parsedRows.map(({ broadcast: b, parsed, isV2Envelope, tagIds }) => {
      const messages = (parsed.messages as unknown[]) || [];
      const tags = isV2Envelope
        ? tagIds.map((id) => tagsById.get(id)).filter((t): t is { id: number; name: string; color: string } => !!t)
        : (parsed.tags as { id: number; name: string; color: string }[]) || tagIds.map((id) => tagsById.get(id)).filter((t): t is { id: number; name: string; color: string } => !!t);
      const title = isV2Envelope
        ? ((parsed.summaryText as string) || 'โปรโมชั่น')
        : ((parsed.title as string) || 'โปรโมชั่น');
      return {
        id: b.id,
        title,
        messages,
        tags,
        tagIds,
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
