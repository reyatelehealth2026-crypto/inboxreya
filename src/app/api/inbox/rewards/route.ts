import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { accountScope, rewardSchema, toDate } from '@/lib/rewards'

/**
 * GET  /api/inbox/rewards — every reward for this account (active or not),
 *                           cheapest first, as the PHP catalogue tab lists them
 * POST /api/inbox/rewards — create one (PHP `reward_action=create`)
 */

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const lineAccountId = authResult.user.lineAccountId as number

  const rewards = await prisma.$queryRaw<Record<string, unknown>[]>`
    SELECT r.id, r.line_account_id, r.name, r.description, r.image_url, r.points_required,
           r.reward_type, r.reward_value, r.stock, r.max_per_user, r.is_active,
           r.start_date, r.end_date, r.terms, r.created_at,
           (SELECT COUNT(*) FROM reward_redemptions rr WHERE rr.reward_id = r.id) AS redeemed
    FROM rewards r
    WHERE ${accountScope(lineAccountId)}
    ORDER BY r.points_required ASC, r.id DESC`

  return NextResponse.json({
    success: true,
    rewards: rewards.map((r) => ({
      ...r,
      id: Number(r.id),
      stock: r.stock === null ? -1 : Number(r.stock),
      max_per_user: Number(r.max_per_user ?? 0),
      is_active: Boolean(r.is_active),
      redeemed: Number(r.redeemed),
    })),
  })
}

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const lineAccountId = authResult.user.lineAccountId as number

  const parsed = rewardSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'กรุณากรอกข้อมูลให้ครบ' },
      { status: 400 },
    )
  }
  const d = parsed.data

  const reward = await prisma.rewards.create({
    data: {
      line_account_id: lineAccountId,
      name: d.name,
      description: d.description ?? null,
      image_url: d.image_url || null,
      points_required: d.points_required,
      reward_type: d.reward_type,
      reward_value: d.reward_value ?? null,
      stock: d.stock,
      max_per_user: d.max_per_user,
      is_active: d.is_active,
      terms: d.terms ?? null,
      start_date: toDate(d.start_date),
      end_date: toDate(d.end_date),
    },
  })

  return NextResponse.json({ success: true, id: reward.id, message: 'เพิ่มรางวัลสำเร็จ' })
}
