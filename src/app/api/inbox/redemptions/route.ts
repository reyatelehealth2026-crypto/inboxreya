import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { accountScope } from '@/lib/rewards'

/**
 * GET /api/inbox/redemptions?status=pending — redemption requests, newest first,
 * plus the four counters the PHP tab shows (LoyaltyPoints::getPointsSummary).
 */

const STATUSES = ['pending', 'approved', 'delivered', 'cancelled', 'expired'] as const

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const lineAccountId = authResult.user.lineAccountId as number
  const scope = accountScope(lineAccountId)

  const status = new URL(request.url).searchParams.get('status')
  const statusFilter = STATUSES.includes(status as (typeof STATUSES)[number])
    ? Prisma.sql`AND rr.status = ${status}`
    : Prisma.empty

  const [rows, issued, redeemed, activeRewards, pending] = await Promise.all([
    prisma.$queryRaw<Record<string, unknown>[]>`
      SELECT rr.id, rr.user_id, rr.reward_id, rr.points_used, rr.status, rr.redemption_code,
             rr.notes, rr.created_at, rr.approved_at, rr.delivered_at, rr.expires_at,
             r.name AS reward_name, r.image_url AS reward_image,
             u.display_name, u.picture_url
      FROM reward_redemptions rr
      JOIN rewards r ON r.id = rr.reward_id
      JOIN users u ON u.id = rr.user_id
      WHERE (rr.line_account_id = ${lineAccountId} OR rr.line_account_id IS NULL) ${statusFilter}
      ORDER BY rr.created_at DESC
      LIMIT 100`,
    prisma.$queryRaw<[{ n: bigint | number }]>`
      SELECT COALESCE(SUM(points), 0) AS n FROM points_transactions WHERE type = 'earn' AND ${scope}`,
    prisma.$queryRaw<[{ n: bigint | number }]>`
      SELECT COALESCE(SUM(ABS(points)), 0) AS n FROM points_transactions WHERE type = 'redeem' AND ${scope}`,
    prisma.$queryRaw<[{ n: bigint | number }]>`
      SELECT COUNT(*) AS n FROM rewards WHERE is_active = 1 AND ${scope}`,
    prisma.$queryRaw<[{ n: bigint | number }]>`
      SELECT COUNT(*) AS n FROM reward_redemptions WHERE status = 'pending' AND ${scope}`,
  ])

  return NextResponse.json({
    success: true,
    summary: {
      total_issued: Number(issued[0].n),
      total_redeemed: Number(redeemed[0].n),
      active_rewards: Number(activeRewards[0].n),
      pending_redemptions: Number(pending[0].n),
    },
    redemptions: rows.map((r) => ({
      ...r,
      id: Number(r.id),
      user_id: Number(r.user_id),
      reward_id: Number(r.reward_id),
      points_used: Number(r.points_used),
    })),
  })
}
