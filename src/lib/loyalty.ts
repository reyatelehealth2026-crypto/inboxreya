import prisma from './prisma'

/**
 * Award or deduct loyalty points.
 *
 * Extracted from `/api/customers/[id]/points/adjust` so the slip flow can credit
 * a customer without going back out over HTTP. That round trip needed the rep's
 * session cookie to be forwarded correctly, and points are money — they should
 * not depend on an auth hop that can silently 401.
 *
 * Four tables track the same balance (a legacy pair plus the current one), so
 * they move together inside one transaction.
 */
export async function adjustPoints({
  userId,
  points,
  reason,
}: {
  userId: number
  /** Positive to earn, negative to redeem. */
  points: number
  reason?: string
}): Promise<number> {
  return prisma.$transaction(async (tx) => {
    let userPoints = await tx.loyalty_points.findUnique({ where: { user_id: userId } })

    if (!userPoints) {
      userPoints = await tx.loyalty_points.create({
        data: { user_id: userId, points: 0, lifetime_points: 0, tier: 'bronze' },
      })
    }

    const newBalance = (userPoints.points || 0) + points
    const newLifetime =
      points > 0 ? (userPoints.lifetime_points || 0) + points : userPoints.lifetime_points || 0

    await tx.loyalty_points.update({
      where: { user_id: userId },
      data: { points: newBalance, lifetime_points: newLifetime },
    })

    await tx.loyalty_points_history.create({
      data: {
        user_id: userId.toString(),
        points: Math.abs(points),
        type: points > 0 ? 'earn' : 'redeem',
        description: reason || 'Manual adjustment',
        created_at: new Date(),
      },
    })

    const user = await tx.lineUser.findUnique({
      where: { id: userId },
      select: { availablePoints: true, totalPoints: true },
    })

    if (user) {
      const newAvailable = (user.availablePoints || 0) + points
      const newTotal = points > 0 ? (user.totalPoints || 0) + points : user.totalPoints || 0

      await tx.lineUser.update({
        where: { id: userId },
        data: { points: newAvailable, availablePoints: newAvailable, totalPoints: newTotal },
      })

      await tx.$queryRawUnsafe(
        `INSERT INTO points_transactions (user_id, type, points, balance_after, description, created_at)
         VALUES (?, ?, ?, ?, ?, NOW())`,
        userId,
        points > 0 ? 'earn' : 'redeem',
        points,
        newAvailable,
        reason || 'Manual adjustment'
      )
    }

    return newBalance
  })
}
