import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import prisma from '@/lib/prisma';
import { pushLineMessage } from '@/lib/line-api';
import { buildPromoMessages } from '@/lib/flex-builder';
import type { ExportPreviewProduct, ExportGlobalConfig } from '@/lib/flex-builder';

/**
 * POST /api/inbox/catalog/send
 *
 * Build promo grid messages (cover + 6-product grid bubbles, giga size,
 * up to 3 carousels + optional closing text) and send them to all LINE users
 * that are assigned to the given tag IDs.
 *
 * All message objects are sent in a **single** pushLineMessage API call per
 * user (up to the LINE limit of 5 payloads per call).
 *
 * Request body:
 * {
 *   products: ExportPreviewProduct[],
 *   config: ExportGlobalConfig,
 *   productsPerBubble?: number,   // 1–6; default 6
 *   closingText?: string,         // optional text payload appended at end
 *   tagIds: number[],
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
      productsPerBubble = 6,
      closingText,
      tagIds,
    } = body as {
      products: ExportPreviewProduct[];
      config: ExportGlobalConfig;
      productsPerBubble?: number;
      closingText?: string;
      tagIds: number[];
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

    // Build all message objects once (reused for every recipient)
    const messages = buildPromoMessages(products, config, {
      productsPerBubble: Math.min(Math.max(1, productsPerBubble), 6),
      closingText: closingText?.trim() || undefined,
      maxCarousels: 3,
    });

    if (messages.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่สามารถสร้าง Flex Message ได้' },
        { status: 400 }
      );
    }

    // Fetch LINE users that have any of the requested tags
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
      .filter(
        (u): u is { lineUserId: string; lineAccountId: number | null } =>
          Boolean(u?.lineUserId)
      );

    if (targetUsers.length === 0) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบผู้ใช้ที่มี Tag ที่เลือก' },
        { status: 400 }
      );
    }

    // Send all message objects in a single API call per user
    let successCount = 0;
    let failCount = 0;
    const errors: string[] = [];

    for (const targetUser of targetUsers) {
      const result = await pushLineMessage(
        targetUser.lineUserId,
        messages as Parameters<typeof pushLineMessage>[1],
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

    return NextResponse.json({
      success: true,
      data: {
        totalUsers: targetUsers.length,
        totalMessages: messages.length,
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
 * Return all tags with user counts for the current LINE account (used by
 * the SendCatalogDialog tag-selection step).
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;

    const { user } = authResult;

    const tags = await prisma.userTag.findMany({
      where: user.lineAccountId ? { lineAccountId: user.lineAccountId } : {},
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { assignments: true } } },
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
