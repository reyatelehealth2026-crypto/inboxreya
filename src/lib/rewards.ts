import { Prisma } from '@prisma/client'
import { z } from 'zod'
import prisma from './prisma'
import { sendTextMessage } from './line-api'

/**
 * Reward catalogue + redemption approvals, mirrored from the PHP
 * `/membership` page (membership.php + classes/LoyaltyPoints.php).
 *
 * Both apps write the same MariaDB rows, so "another channel" only means
 * repeating the PHP rules exactly. Deliberately separate from @/lib/loyalty:
 * the manual add/deduct flow in CustomerProfile must not change.
 */

/** PHP LoyaltyPoints scopes every query to "this account, or rows never scoped". */
export const accountScope = (lineAccountId: number) =>
  Prisma.sql`(line_account_id = ${lineAccountId} OR line_account_id IS NULL)`

const DATE = /^\d{4}-\d{2}-\d{2}$/

/**
 * Reward form body. Only the four values the DB ENUM accepts: the PHP form
 * also offers gift/coupon, which MariaDB silently stores as '' — not copied.
 */
export const rewardSchema = z.object({
  name: z.string().trim().min(1, 'กรุณากรอกชื่อรางวัล').max(255),
  description: z.string().trim().max(5000).nullable().optional(),
  points_required: z.coerce.number().int().positive('แต้มที่ใช้แลกต้องมากกว่า 0'),
  reward_type: z.enum(['discount', 'product', 'voucher', 'shipping']).default('product'),
  reward_value: z.coerce.number().nullable().optional(),
  stock: z.coerce.number().int().min(-1).default(-1),
  max_per_user: z.coerce.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  image_url: z.string().trim().max(500).nullable().optional(),
  terms: z.string().trim().max(5000).nullable().optional(),
  start_date: z.string().regex(DATE).nullable().optional(),
  end_date: z.string().regex(DATE).nullable().optional(),
})

export const toDate = (s: string | null | undefined) => (s ? new Date(s) : null)

export type RedemptionAction = 'approve' | 'deliver' | 'cancel'
type RedemptionStatus = 'approved' | 'delivered' | 'cancelled'

const ACTION_STATUS: Record<RedemptionAction, RedemptionStatus> = {
  approve: 'approved',
  deliver: 'delivered',
  cancel: 'cancelled',
}

interface RedemptionRow {
  id: number
  user_id: number
  reward_id: number
  points_used: number
  status: string | null
  redemption_code: string | null
  reward_name: string
  line_user_id: string | null
}

/** Same text the PHP sendRedemptionNotification() pushes — `${title}\n\n${body}`. */
export function redemptionMessage(status: RedemptionStatus, r: Pick<RedemptionRow, 'reward_name' | 'redemption_code'>) {
  const code = r.redemption_code ?? ''
  switch (status) {
    case 'approved':
      return `✅ รางวัลได้รับการอนุมัติ\n\nรางวัล: ${r.reward_name}\nรหัส: ${code}\n\nกรุณาติดต่อรับรางวัลที่ร้าน`
    case 'delivered':
      return `🎁 ส่งมอบรางวัลแล้ว\n\nรางวัล: ${r.reward_name}\nรหัส: ${code}\n\nขอบคุณที่ใช้บริการ`
    case 'cancelled':
      return `❌ ยกเลิกการแลกรางวัล\n\nรางวัล: ${r.reward_name}\n\nแต้มได้ถูกคืนเข้าบัญชีของคุณแล้ว`
  }
}

/**
 * PHP LoyaltyPoints::addPoints() for the cancel refund, verbatim: balance is
 * SUM(points_transactions), users.total_points/available_points move, the row
 * is type `earn` / reference `refund`, and it expires per points_settings.
 */
async function refundPoints(
  tx: Prisma.TransactionClient,
  r: RedemptionRow,
  lineAccountId: number,
) {
  if (r.points_used <= 0) return

  const [sum, settings] = await Promise.all([
    tx.points_transactions.aggregate({ where: { user_id: r.user_id }, _sum: { points: true } }),
    tx.points_settings.findFirst({
      where: { OR: [{ line_account_id: lineAccountId }, { line_account_id: null }] },
      orderBy: { line_account_id: 'desc' },
    }),
  ])
  const balanceAfter = (sum._sum.points ?? 0) + r.points_used
  const expiryDays = settings?.points_expiry_days ?? 365
  const expiresAt = expiryDays > 0 ? new Date(Date.now() + expiryDays * 86_400_000) : null

  await tx.lineUser.update({
    where: { id: r.user_id },
    data: { totalPoints: { increment: r.points_used }, availablePoints: { increment: r.points_used } },
  })
  await tx.points_transactions.create({
    data: {
      user_id: r.user_id,
      line_account_id: lineAccountId,
      type: 'earn',
      points: r.points_used,
      balance_after: balanceAfter,
      reference_type: 'refund',
      reference_id: r.id,
      description: 'คืนแต้มจากการยกเลิก',
      expires_at: expiresAt,
    },
  })
}

export async function applyRedemptionAction(opts: {
  redemptionId: number
  action: RedemptionAction
  notes?: string
  adminId: number
  lineAccountId: number
}): Promise<{ ok: boolean; message: string }> {
  const { redemptionId, action, adminId, lineAccountId } = opts
  const notes = opts.notes?.trim() || undefined

  const rows = await prisma.$queryRaw<RedemptionRow[]>`
    SELECT rr.id, rr.user_id, rr.reward_id, rr.points_used, rr.status, rr.redemption_code,
           r.name AS reward_name, u.line_user_id
    FROM reward_redemptions rr
    JOIN rewards r ON r.id = rr.reward_id
    JOIN users u ON u.id = rr.user_id
    WHERE rr.id = ${redemptionId}`
  const r = rows[0]
  if (!r) return { ok: false, message: 'ไม่พบรายการแลกรางวัล' }
  // MariaDB INT UNSIGNED arrives as BigInt through raw queries
  r.user_id = Number(r.user_id)
  r.reward_id = Number(r.reward_id)
  r.points_used = Number(r.points_used)

  const status = ACTION_STATUS[action]
  let message: string

  if (action === 'cancel') {
    if (r.status === 'delivered') return { ok: false, message: 'ไม่สามารถยกเลิกได้' }
    await prisma.$transaction(async (tx) => {
      await refundPoints(tx, r, lineAccountId)
      await tx.$executeRaw`UPDATE rewards SET stock = stock + 1 WHERE id = ${r.reward_id} AND stock >= 0`
      await tx.reward_redemptions.update({ where: { id: r.id }, data: { status, ...(notes && { notes }) } })
    })
    message = 'ยกเลิกและคืนแต้มสำเร็จ'
  } else if (action === 'approve') {
    await prisma.reward_redemptions.update({
      where: { id: r.id },
      data: { status, approved_by: adminId, approved_at: new Date(), ...(notes && { notes }) },
    })
    message = 'อนุมัติสำเร็จ'
  } else {
    await prisma.reward_redemptions.update({
      where: { id: r.id },
      data: { status, delivered_at: new Date(), ...(notes && { notes }) },
    })
    message = 'บันทึกการส่งมอบสำเร็จ'
  }

  // PHP treats a failed push as a logged non-error; the status change stands.
  if (r.line_user_id) {
    const sent = await sendTextMessage(r.line_user_id, redemptionMessage(status, r), lineAccountId)
    if (!sent.success) console.error('[rewards] LINE notify failed:', redemptionId, sent.error)
  }

  return { ok: true, message }
}

/** PHP `reward_action=delete`: keep the row (disabled) once anyone has redeemed it. */
export async function deleteReward(rewardId: number): Promise<{ message: string }> {
  const redeemed = await prisma.reward_redemptions.count({ where: { reward_id: rewardId } })
  if (redeemed > 0) {
    await prisma.rewards.update({ where: { id: rewardId }, data: { is_active: false } })
    return { message: 'ปิดใช้งานรางวัลแล้ว (มีประวัติการแลก)' }
  }
  await prisma.rewards.delete({ where: { id: rewardId } })
  return { message: 'ลบสำเร็จ' }
}
