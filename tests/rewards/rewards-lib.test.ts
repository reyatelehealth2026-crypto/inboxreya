import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * The money paths of the reward admin, checked against the PHP rules they
 * mirror (membership.php cancel_redemption / delete, LoyaltyPoints::addPoints).
 */

const { db, sendTextMessage } = vi.hoisted(() => ({
  db: {
  $queryRaw: vi.fn(),
  $executeRaw: vi.fn(),
  $transaction: vi.fn(async (fn: (tx: typeof db) => Promise<unknown>) => fn(db)),
  points_transactions: { aggregate: vi.fn(), create: vi.fn() },
  points_settings: { findFirst: vi.fn() },
  lineUser: { update: vi.fn() },
  reward_redemptions: { update: vi.fn(), count: vi.fn() },
  rewards: { update: vi.fn(), delete: vi.fn() },
  },
  sendTextMessage: vi.fn(),
}))
vi.mock('@/lib/prisma', () => ({ default: db, prisma: db }))
vi.mock('@/lib/line-api', () => ({ sendTextMessage }))

import { applyRedemptionAction, deleteReward, redemptionMessage } from '@/lib/rewards'

const redemption = {
  id: 7,
  user_id: 42,
  reward_id: 3,
  points_used: 50,
  status: 'pending',
  redemption_code: 'RDM-TEST',
  reward_name: 'ตัวอย่าง',
  line_user_id: 'Utest',
}

beforeEach(() => {
  vi.clearAllMocks()
  sendTextMessage.mockResolvedValue({ success: true })
  db.$queryRaw.mockResolvedValue([{ ...redemption }])
  db.points_transactions.aggregate.mockResolvedValue({ _sum: { points: 120 } })
  db.points_settings.findFirst.mockResolvedValue({ points_expiry_days: 365 })
})

describe('cancel', () => {
  it('refunds points_used the way PHP addPoints does, restores stock, notifies', async () => {
    const result = await applyRedemptionAction({ redemptionId: 7, action: 'cancel', adminId: 1, lineAccountId: 3 })

    expect(result).toEqual({ ok: true, message: 'ยกเลิกและคืนแต้มสำเร็จ' })
    expect(db.lineUser.update).toHaveBeenCalledWith({
      where: { id: 42 },
      data: { totalPoints: { increment: 50 }, availablePoints: { increment: 50 } },
    })
    const tx = db.points_transactions.create.mock.calls[0][0].data
    expect(tx).toMatchObject({
      user_id: 42,
      line_account_id: 3,
      type: 'earn',
      points: 50,
      balance_after: 170, // SUM(points_transactions) + refund
      reference_type: 'refund',
      reference_id: 7,
      description: 'คืนแต้มจากการยกเลิก',
    })
    expect(tx.expires_at).toBeInstanceOf(Date)
    expect(db.$executeRaw).toHaveBeenCalledTimes(1) // stock + 1 WHERE stock >= 0
    expect(db.reward_redemptions.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { status: 'cancelled' } })
    expect(sendTextMessage).toHaveBeenCalledWith('Utest', redemptionMessage('cancelled', redemption), 3)
  })

  it('refuses once delivered and writes nothing', async () => {
    db.$queryRaw.mockResolvedValue([{ ...redemption, status: 'delivered' }])

    const result = await applyRedemptionAction({ redemptionId: 7, action: 'cancel', adminId: 1, lineAccountId: 3 })

    expect(result).toEqual({ ok: false, message: 'ไม่สามารถยกเลิกได้' })
    expect(db.$transaction).not.toHaveBeenCalled()
    expect(sendTextMessage).not.toHaveBeenCalled()
  })

  it('skips the expiry when settings say points never expire', async () => {
    db.points_settings.findFirst.mockResolvedValue({ points_expiry_days: 0 })
    await applyRedemptionAction({ redemptionId: 7, action: 'cancel', adminId: 1, lineAccountId: 3 })
    expect(db.points_transactions.create.mock.calls[0][0].data.expires_at).toBeNull()
  })
})

describe('approve / deliver', () => {
  it('approve stamps the admin and pushes the PHP text', async () => {
    const result = await applyRedemptionAction({ redemptionId: 7, action: 'approve', notes: ' รับที่ร้าน ', adminId: 9, lineAccountId: 3 })

    expect(result.ok).toBe(true)
    const data = db.reward_redemptions.update.mock.calls[0][0].data
    expect(data).toMatchObject({ status: 'approved', approved_by: 9, notes: 'รับที่ร้าน' })
    expect(data.approved_at).toBeInstanceOf(Date)
    expect(sendTextMessage.mock.calls[0][1]).toBe(
      '✅ รางวัลได้รับการอนุมัติ\n\nรางวัล: ตัวอย่าง\nรหัส: RDM-TEST\n\nกรุณาติดต่อรับรางวัลที่ร้าน',
    )
  })

  it('deliver stamps delivered_at and never touches points', async () => {
    await applyRedemptionAction({ redemptionId: 7, action: 'deliver', adminId: 9, lineAccountId: 3 })

    const data = db.reward_redemptions.update.mock.calls[0][0].data
    expect(data.status).toBe('delivered')
    expect(data.delivered_at).toBeInstanceOf(Date)
    expect(db.points_transactions.create).not.toHaveBeenCalled()
  })

  it('a failed LINE push does not undo the status change', async () => {
    sendTextMessage.mockResolvedValueOnce({ success: false, error: 'boom' })
    const result = await applyRedemptionAction({ redemptionId: 7, action: 'approve', adminId: 9, lineAccountId: 3 })
    expect(result.ok).toBe(true)
  })
})

describe('deleteReward', () => {
  it('only disables a reward that has redemptions', async () => {
    db.reward_redemptions.count.mockResolvedValue(2)
    const result = await deleteReward(3)
    expect(result.message).toBe('ปิดใช้งานรางวัลแล้ว (มีประวัติการแลก)')
    expect(db.rewards.update).toHaveBeenCalledWith({ where: { id: 3 }, data: { is_active: false } })
    expect(db.rewards.delete).not.toHaveBeenCalled()
  })

  it('hard-deletes an untouched reward', async () => {
    db.reward_redemptions.count.mockResolvedValue(0)
    const result = await deleteReward(3)
    expect(result.message).toBe('ลบสำเร็จ')
    expect(db.rewards.delete).toHaveBeenCalledWith({ where: { id: 3 } })
  })
})
