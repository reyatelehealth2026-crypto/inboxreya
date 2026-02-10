import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        // Await params in Next.js 15
        const { id } = await params
        const userId = parseInt(id)

        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
        }

        // Calculate points from transactions (Mirroring PHP LoyaltyPoints::getUserPoints)
        const pointsSummary = await prisma.$queryRawUnsafe<any[]>(
            `SELECT
                COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as total_points,
                COALESCE(SUM(points), 0) as available_points,
                COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) as used_points
            FROM points_transactions
            WHERE user_id = ?`,
            userId
        )

        const summary = pointsSummary[0]

        // Fetch user for fallback and other data
        const user = await prisma.lineUser.findUnique({
            where: { id: userId },
            select: {
                points: true,
                totalPoints: true,
                availablePoints: true,
                usedPoints: true,
                loyaltyPoints: true,
                tier: true,
                membershipLevel: true,
            }
        })

        if (!user) {
            return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        // Fetch points history from points_transactions
        const transactions = await prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM points_transactions WHERE user_id = ? ORDER BY created_at DESC LIMIT 20`,
            userId
        )

        let currentBalance = 0
        let totalPoints = 0
        let usedPoints = 0

        // Only use transaction data if we have transactions or non-zero balance
        if (summary && (Number(summary.available_points) !== 0 || transactions.length > 0)) {
            currentBalance = Number(summary.available_points)
            totalPoints = Number(summary.total_points)
            usedPoints = Number(summary.used_points)
            currentBalance = Math.max(0, currentBalance)
        } else {
            // Fallback to users table
            currentBalance = user.availablePoints || user.points || 0
            totalPoints = user.totalPoints || 0
            usedPoints = user.usedPoints || 0
        }

        const responseData = {
            balance: {
                current: currentBalance,
                total: totalPoints,
                used: usedPoints,
                loyalty: user.loyaltyPoints || 0,
                expiringSoon: 0
            },
            tier: {
                current: user.tier || user.membershipLevel || 'bronze',
                name: (user.tier || user.membershipLevel || 'bronze').charAt(0).toUpperCase() + (user.tier || user.membershipLevel || 'bronze').slice(1),
                nextTier: 'Silver',
                pointsToNextTier: 100,
                progress: 0,
                benefits: []
            },
            stats: {
                totalSpent: 0,
                orderCount: 0
            },
            history: transactions.map(h => ({
                id: h.id.toString(),
                description: h.description || h.notes || 'Points transaction',
                createdAt: h.created_at,
                points: h.points,
                type: h.type || h.transaction_type
            }))
        }

        return NextResponse.json(responseData)
    } catch (error) {
        console.error('Failed to fetch points:', error)
        return NextResponse.json(
            { error: 'Failed to fetch points' },
            { status: 500 }
        )
    }
}
