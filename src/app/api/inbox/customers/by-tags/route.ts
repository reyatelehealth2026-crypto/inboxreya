import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';

/**
 * GET /api/inbox/customers/by-tags?tagIds=1,2,3
 * Returns user IDs that have any of the given tags
 */
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req);
    if (authResult instanceof NextResponse) return authResult;
    const { user: sessionUser } = authResult;

    const { searchParams } = new URL(req.url);
    const tagIdsParam = searchParams.get('tagIds');
    if (!tagIdsParam) {
      return NextResponse.json({ error: 'tagIds is required' }, { status: 400 });
    }

    const tagIds = tagIdsParam
      .split(',')
      .map((id) => parseInt(id.trim(), 10))
      .filter((id) => Number.isFinite(id));

    if (tagIds.length === 0) {
      return NextResponse.json({ userIds: [] });
    }

    const assignments = await prisma.userTagAssignment.findMany({
      where: {
        tagId: { in: tagIds },
        user: sessionUser.lineAccountId
          ? { lineAccountId: sessionUser.lineAccountId }
          : undefined,
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = assignments.map((a) => a.userId);
    return NextResponse.json({ userIds });
  } catch (error) {
    console.error('Failed to get users by tags:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch' },
      { status: 500 }
    );
  }
}
