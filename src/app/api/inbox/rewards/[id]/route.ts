import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { deleteReward, rewardSchema, toDate } from '@/lib/rewards'

/**
 * PATCH  /api/inbox/rewards/[id] — update any subset of fields; `{ is_active }`
 *                                 alone is the PHP `toggle`
 * DELETE /api/inbox/rewards/[id] — PHP `delete`: disable if ever redeemed, else remove
 */

async function ownedReward(request: NextRequest, params: Promise<{ id: string }>) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const id = Number((await params).id)
  if (!Number.isInteger(id)) return NextResponse.json({ success: false, error: 'Invalid id' }, { status: 400 })

  const lineAccountId = authResult.user.lineAccountId as number
  const reward = await prisma.rewards.findFirst({
    where: { id, OR: [{ line_account_id: lineAccountId }, { line_account_id: null }] },
    select: { id: true },
  })
  if (!reward) return NextResponse.json({ success: false, error: 'ไม่พบรางวัล' }, { status: 404 })
  return { id }
}

export async function PATCH(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const owned = await ownedReward(request, ctx.params)
  if (owned instanceof NextResponse) return owned

  const parsed = rewardSchema.partial().safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? 'ข้อมูลไม่ถูกต้อง' },
      { status: 400 },
    )
  }
  const d = parsed.data

  await prisma.rewards.update({
    where: { id: owned.id },
    data: {
      ...(d.name !== undefined && { name: d.name }),
      ...(d.description !== undefined && { description: d.description }),
      ...(d.image_url !== undefined && { image_url: d.image_url || null }),
      ...(d.points_required !== undefined && { points_required: d.points_required }),
      ...(d.reward_type !== undefined && { reward_type: d.reward_type }),
      ...(d.reward_value !== undefined && { reward_value: d.reward_value }),
      ...(d.stock !== undefined && { stock: d.stock }),
      ...(d.max_per_user !== undefined && { max_per_user: d.max_per_user }),
      ...(d.is_active !== undefined && { is_active: d.is_active }),
      ...(d.terms !== undefined && { terms: d.terms }),
      ...(d.start_date !== undefined && { start_date: toDate(d.start_date) }),
      ...(d.end_date !== undefined && { end_date: toDate(d.end_date) }),
    },
  })

  return NextResponse.json({ success: true, message: 'อัปเดตสำเร็จ' })
}

export async function DELETE(request: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const owned = await ownedReward(request, ctx.params)
  if (owned instanceof NextResponse) return owned

  const { message } = await deleteReward(owned.id)
  return NextResponse.json({ success: true, message })
}
