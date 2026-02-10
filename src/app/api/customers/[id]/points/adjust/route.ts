import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id } = await params
        const userId = parseInt(id)
        const body = await request.json()
        const { points, reason, type } = body

        if (isNaN(userId)) {
            return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
        }

        if (!points || isNaN(points)) {
            return NextResponse.json({ error: 'Invalid points amount' }, { status: 400 })
        }

        // Transaction to update balance and add history
        const result = await prisma.$transaction(async (tx) => {
            // 1. Get current balance or create if not exists
            let userPoints = await tx.loyalty_points.findUnique({
                where: { user_id: userId }
            })

            if (!userPoints) {
                userPoints = await tx.loyalty_points.create({
                    data: {
                        user_id: userId,
                        points: 0,
                        lifetime_points: 0,
                        tier: 'bronze'
                    }
                })
            }

            // 2. Update loyalty_points balance
            const newBalance = (userPoints.points || 0) + points
            const newLifetime = points > 0 ? (userPoints.lifetime_points || 0) + points : (userPoints.lifetime_points || 0)

            await tx.loyalty_points.update({
                where: { user_id: userId },
                data: {
                    points: newBalance,
                    lifetime_points: newLifetime
                }
            })

            // 3. Create legacy history record
            await tx.loyalty_points_history.create({
                data: {
                    user_id: userId.toString(),
                    points: Math.abs(points),
                    type: points > 0 ? 'earn' : 'redeem',
                    description: reason || 'Manual adjustment',
                    created_at: new Date()
                }
            })

            // 4. Update lineUser (main points tracking)
            const user = await tx.lineUser.findUnique({
                where: { id: userId },
                select: { availablePoints: true, totalPoints: true }
            })

            if (user) {
                const newAvailable = (user.availablePoints || 0) + points
                const newTotal = points > 0 ? (user.totalPoints || 0) + points : (user.totalPoints || 0)

                await tx.lineUser.update({
                    where: { id: userId },
                    data: {
                        points: newAvailable,
                        availablePoints: newAvailable,
                        totalPoints: newTotal
                    }
                })

                // 5. Create main points_transactions record
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

        return NextResponse.json({ success: true, newBalance: result })

    } catch (error) {
        console.error('Failed to adjust points:', error)
        return NextResponse.json(
            { error: 'Failed to adjust points' },
            { status: 500 }
        )
    }
}
