import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { applyRedemptionAction } from '@/lib/rewards'

/**
 * POST /api/inbox/redemptions/[id] — { action: approve | deliver | cancel, notes? }
 * PHP `approve_redemption` / `deliver_redemption` / `cancel_redemption`.
 */

const bodySchema = z.object({
  action: z.enum(['approve', 'deliver', 'cancel']),
  notes: z.string().trim().max(1000).optional(),
})

export async function POST(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const redemptionId = Number((await ctx.params).id)
  if (!Number.isInteger(redemptionId)) {
    return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: 'action ต้องเป็น approve, deliver หรือ cancel' }, { status: 400 })
  }

  try {
    const result = await applyRedemptionAction({
      redemptionId,
      action: parsed.data.action,
      notes: parsed.data.notes,
      adminId: Number(authResult.user.id),
      lineAccountId: authResult.user.lineAccountId as number,
    })
    return NextResponse.json(
      { success: result.ok, message: result.message, error: result.ok ? undefined : result.message },
      { status: result.ok ? 200 : 409 },
    )
  } catch (error) {
    console.error('[redemptions] action failed:', redemptionId, error)
    return NextResponse.json({ success: false, error: 'ดำเนินการไม่สำเร็จ' }, { status: 500 })
  }
}
