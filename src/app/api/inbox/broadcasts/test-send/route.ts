import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-middleware';
import { pushLineMessage } from '@/lib/line-api';
import { buildBroadcastMessages } from '@/lib/broadcast-runtime';
import { imagemapInputSchema } from '@/lib/imagemap-types';
import { z } from 'zod';

const testSendSchema = z
  .object({
    customerId: z.number().int().positive(),
    imagemap: imagemapInputSchema.optional(),
    content: z.string().max(5000).optional(),
    flexContent: z.any().optional(),
    /** Flex-only test (e.g. the promo page flex): up to 5 flex messages, no imagemap. */
    flexContents: z.array(z.any()).min(1).max(5).optional(),
  })
  .refine((body) => body.imagemap || body.flexContents, {
    message: 'imagemap or flexContents is required',
  });

/**
 * POST /api/inbox/broadcasts/test-send
 *
 * Push an imagemap (or flex-only) broadcast to one customer so the composer can be
 * checked on a real phone. Links are NOT personalized: the customer gets the raw destination
 * URLs and nothing is logged as engagement.
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) return authResult;
    const { user } = authResult;

    const body = await request.json();
    const validated = testSendSchema.parse(body);

    const customer = await prisma.lineUser.findFirst({
      where: {
        id: validated.customerId,
        lineAccountId: user.lineAccountId as number,
        lineUserId: { not: '' },
      },
      select: { lineUserId: true, lineAccountId: true },
    });

    if (!customer?.lineUserId) {
      return NextResponse.json(
        { success: false, error: 'ไม่พบลูกค้ารายนี้ในบัญชีของคุณ' },
        { status: 404 }
      );
    }

    const built = buildBroadcastMessages({
      content: validated.content,
      flexContent: validated.flexContent,
      flexContents: validated.imagemap ? undefined : validated.flexContents,
      imagemap: validated.imagemap,
    });

    const result = await pushLineMessage(
      customer.lineUserId,
      built.messages as Parameters<typeof pushLineMessage>[1],
      customer.lineAccountId ?? (user.lineAccountId as number)
    );

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'ส่งข้อความทดสอบไม่สำเร็จ' },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      data: { totalMessages: built.messages.length },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      );
    }
    console.error('Error sending test broadcast:', error);
    return NextResponse.json(
      { success: false, error: (error as Error).message || 'ส่งข้อความทดสอบไม่สำเร็จ' },
      { status: 500 }
    );
  }
}
