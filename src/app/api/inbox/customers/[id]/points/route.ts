import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'User id must be a number' }, { status: 400 })
    }

    // Get user to verify access
    const where: { id: number; lineAccountId?: number } = { id: parsedUserId }
    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const user = await prisma.lineUser.findFirst({
      where,
      select: {
        id: true,
        points: true,
        totalPoints: true,
        availablePoints: true,
        usedPoints: true,
        loyaltyPoints: true,
        tier: true,
        membershipLevel: true,
        totalSpent: true,
        orderCount: true,
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get points history from points_transactions table
    const transactions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 50`,
      parsedUserId
    )

    // Get tier information
    const tierInfo = getTierInfo(user.tier || user.membershipLevel)

    // Calculate points expiring soon (if expiration tracking exists)
    const expiringPoints = await prisma.$queryRawUnsafe<any[]>(
      `SELECT SUM(points) as total FROM points_transactions 
       WHERE user_id = ? AND expires_at IS NOT NULL AND expires_at > NOW() AND expires_at < DATE_ADD(NOW(), INTERVAL 30 DAY)`,
      parsedUserId
    )

    // Calculate points from transactions (Mirroring PHP LoyaltyPoints::getUserPoints)
    const pointsSummary = await prisma.$queryRawUnsafe<any[]>(
      `SELECT
        COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as total_points,
        COALESCE(SUM(points), 0) as available_points,
        COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) as used_points
       FROM points_transactions
       WHERE user_id = ?`,
      parsedUserId
    )

    const summary = pointsSummary[0]
    let currentBalance = 0
    let totalPoints = 0
    let usedPoints = 0

    // Only use transaction data if we have transactions or non-zero balance
    // This matches PHP logic: if (!$result || (int) $result['available_points'] === 0) -> check users table
    if (summary && (Number(summary.available_points) !== 0 || transactions.length > 0)) {
      currentBalance = Number(summary.available_points)
      totalPoints = Number(summary.total_points)
      usedPoints = Number(summary.used_points)

      // Ensure available_points is not negative
      currentBalance = Math.max(0, currentBalance)
    } else {
      // Fallback to users table
      currentBalance = user.availablePoints || user.points || 0
      totalPoints = user.totalPoints || 0
      usedPoints = user.usedPoints || 0
    }

    const data = {
      balance: {
        current: currentBalance,
        total: totalPoints,
        used: usedPoints,
        loyalty: user.loyaltyPoints || 0,
        expiringSoon: expiringPoints[0]?.total || 0,
      },
      tier: {
        current: user.tier || user.membershipLevel || 'bronze',
        name: tierInfo.name,
        benefits: tierInfo.benefits,
        nextTier: tierInfo.nextTier,
        pointsToNextTier: tierInfo.pointsToNextTier,
        progress: tierInfo.progress,
      },
      stats: {
        totalSpent: user.totalSpent ? parseFloat(user.totalSpent.toString()) : 0,
        orderCount: user.orderCount || 0,
        averageOrderValue:
          user.orderCount && user.totalSpent
            ? parseFloat(user.totalSpent.toString()) / user.orderCount
            : 0,
      },
      history: transactions.map((t) => ({
        id: t.id,
        type: t.transaction_type || t.type,
        points: t.points,
        description: t.description || t.notes,
        orderId: t.order_id || null,
        expiresAt: t.expires_at || null,
        createdAt: t.created_at,
      })),
    }

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching points:', error)
    return NextResponse.json({ error: 'Failed to fetch points' }, { status: 500 })
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can manually adjust points
    if (!['admin', 'owner', 'super_admin'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: userId } = await params
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'User id must be a number' }, { status: 400 })
    }

    // Get user to verify access
    const where: { id: number; lineAccountId?: number } = { id: parsedUserId }
    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const user = await prisma.lineUser.findFirst({
      where,
      select: { id: true, availablePoints: true, totalPoints: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const { points, reason, type = 'manual_adjustment' } = body

    if (!points || !Number.isFinite(points)) {
      return NextResponse.json({ error: 'Invalid points value' }, { status: 400 })
    }

    // Create transaction record
    await prisma.$queryRawUnsafe(
      `INSERT INTO points_transactions (user_id, transaction_type, points, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, NOW())`,
      parsedUserId,
      type,
      points,
      reason || 'Manual adjustment by admin',
      session.user.id
    )

    // Update user points
    const newAvailable = (user.availablePoints || 0) + points
    const newTotal = points > 0 ? (user.totalPoints || 0) + points : user.totalPoints

    await prisma.lineUser.update({
      where: { id: parsedUserId },
      data: {
        availablePoints: newAvailable,
        totalPoints: newTotal,
        points: newAvailable, // Keep legacy field in sync
      },
    })

    return NextResponse.json({
      success: true,
      data: {
        newBalance: newAvailable,
        totalPoints: newTotal,
      },
    })
  } catch (error) {
    console.error('Error adjusting points:', error)
    return NextResponse.json({ error: 'Failed to adjust points' }, { status: 500 })
  }
}

function getTierInfo(tier: string | null) {
  const tiers = {
    bronze: {
      name: 'Bronze',
      minPoints: 0,
      benefits: ['1% cashback', 'Birthday discount'],
      nextTier: 'silver',
      nextTierPoints: 1000,
    },
    silver: {
      name: 'Silver',
      minPoints: 1000,
      benefits: ['2% cashback', 'Free shipping', 'Birthday discount'],
      nextTier: 'gold',
      nextTierPoints: 5000,
    },
    gold: {
      name: 'Gold',
      minPoints: 5000,
      benefits: ['3% cashback', 'Free shipping', 'Priority support', 'Birthday discount'],
      nextTier: 'platinum',
      nextTierPoints: 10000,
    },
    platinum: {
      name: 'Platinum',
      minPoints: 10000,
      benefits: [
        '5% cashback',
        'Free shipping',
        'Priority support',
        'Exclusive offers',
        'Birthday discount',
      ],
      nextTier: null,
      nextTierPoints: null,
    },
  }

  const currentTier = tier?.toLowerCase() || 'bronze'
  const tierData = tiers[currentTier as keyof typeof tiers] || tiers.bronze

  return {
    name: tierData.name,
    benefits: tierData.benefits,
    nextTier: tierData.nextTier,
    pointsToNextTier: tierData.nextTierPoints
      ? tierData.nextTierPoints - tierData.minPoints
      : null,
    progress: tierData.nextTierPoints
      ? Math.min(100, ((tierData.minPoints / tierData.nextTierPoints) * 100))
      : 100,
  }
}
