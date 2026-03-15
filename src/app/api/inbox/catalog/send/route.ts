import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { sendFlexMessage } from '@/lib/line-api';
import { buildFlexPayload } from '@/lib/flex-builder';
import type { ExportPreviewProduct, ExportGlobalConfig } from '@/lib/flex-builder';

/**
 * POST /api/inbox/catalog/send
 *
 * Send flex messages (split into multiple carousels) to all LINE users
 * that are assigned to the given tag IDs.
 *
 * Request body:
 * {
 *   products: ExportPreviewProduct[],
 *   config: ExportGlobalConfig,
 *   productsPerCarousel: number,   // max products per carousel bubble
 *   tagIds: number[],              // send to users with these tags
 *   altText?: string,
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;

    const body = await request.json();
    const {
      products,
      config,
      productsPerCarousel = 6,
      tagIds,
      altText = 'สินค้าแนะนำ',
    } = body as {
      products: ExportPreviewProduct[];
      config: ExportGlobalConfig;
      productsPerCarousel: number;
      tagIds: number[];
      altText?: string;
    };

    if (!products || !Array.isArray(products) || products.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาระบุสินค้าอย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    if (!tagIds || !Array.isArray(tagIds) || tagIds.length === 0) {
      return NextResponse.json(
        { success: false, error: 'กรุณาเลือก Tag อย่างน้อย 1 รายการ' },
        { status: 400 }
      );
    }

    const perCarousel = Math.min(Math.max(1, productsPerCarousel), 12);

    // Fetch LINE users that have any of the given tags
    const assignments = await prisma.userTagAssignment.findMany({
      where: {
        tagId: { in: tagIds },
        user: { lineAccountId: user.lineAccountId },
      },
      select: {
        userId: true,
        user: { select: { lineUserId: true, lineAccountId: true } },
      },
      distinct: ['userId'],
    });

    const targetUsers = assignments
      .map((a) => a.user)
      .filter((u): u is { lineUserId: string; lineAccountId: number | null } =>
        Boolean(u?.lineUserId)
      );

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ใช้ที่มี Tag ที่เลือก' },
        { status: 400 }
      );
    }

    // Split products into chunks
    const chunks: ExportPreviewProduct[][] = [];
    for (let i = 0; i < products.length; i += perCarousel) {
      chunks.push(products.slice(i, i + perCarousel));
    }

    // Build carousel payloads (one per chunk)
    // Only the first chunk gets the intro bubble (if configured)
    const carousels = chunks.map((chunk, idx) => {
      const chunkConfig: ExportGlobalConfig = {
        ...config,
        includeIntroBubble: idx === 0 && config.includeIntroBubble !== false,
      };
      return buildFlexPayload(chunk, chunkConfig);
    });

    // Send to every target user
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const targetUser of targetUsers) {
      for (const carousel of carousels) {
        const result = await sendFlexMessage(
          targetUser.lineUserId,
          altText,
          carousel,
          targetUser.lineAccountId ?? user.lineAccountId
        );
        if (result.success) {
          successCount++;
        } else {
          failCount++;
          if (result.error && !errors.includes(result.error)) {
            errors.push(result.error);
          }
        }
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: targetUsers.length,
        totalCarousels: carousels.length,
        successCount,
        failCount,
        errors: errors.length > 0 ? errors : undefined,
      },
    });
  } catch (error) {
    console.error('Error sending catalog flex:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'เกิดข้อผิดพลาดในการส่งข้อความ',
        details: (error as Error).message,
      },
      { status: 500 }
    );
  }
}

/**
 * GET /api/inbox/catalog/send
 *
 * Return all tags with their user counts for the current LINE account.
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;

    const tags = await prisma.userTag.findMany({
      where: user.lineAccountId ? { lineAccountId: user.lineAccountId } : {},
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: {
        _count: { select: { assignments: true } },
      },
    });

    return NextResponse.json({
      success: true,
      data: tags.map((t) => ({
        id: t.id,
        name: t.name,
        color: t.color ?? '#3B82F6',
        userCount: t._count.assignments,
      })),
    });
  } catch (error) {
    console.error('Error fetching tags for send:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch tags' },
      { status: 500 }
    );
  }
}
