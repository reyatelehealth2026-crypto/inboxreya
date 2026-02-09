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

        // Fetch user's loyalty points
        const loyaltyPoints = await prisma.loyalty_points.findUnique({
            where: { user_id: userId }
        })

        // Fetch points history
        // Note: loyalty_points_history.user_id is String in schema but likely stores int ID?
        // Checking schema: user_id String @db.VarChar(100)
        // We should cast or check how it's stored. safe to try string conversion of ID.
        const history = await prisma.loyalty_points_history.findMany({
            where: {
                OR: [
                    { user_id: userId.toString() },
                    // If sometimes stored as int in other systems, though schema says string
                ]
            },
            orderBy: { created_at: 'desc' },
            take: 20
        })

        // Construct response matching PointsData interface
        const responseData = {
            balance: {
                current: loyaltyPoints?.points || 0,
                total: loyaltyPoints?.lifetime_points || 0,
                used: (loyaltyPoints?.lifetime_points || 0) - (loyaltyPoints?.points || 0),
                expiringSoon: 0 // Not tracked in current schema
            },
            tier: {
                current: loyaltyPoints?.tier || 'bronze',
                name: (loyaltyPoints?.tier || 'bronze').charAt(0).toUpperCase() + (loyaltyPoints?.tier || 'bronze').slice(1),
                nextTier: 'Silver', // Simplified logic for now
                pointsToNextTier: 100, // Simplified logic
                progress: 0,
                benefits: []
            },
            stats: {
                totalSpent: 0, // Would need orders table aggregation
                orderCount: 0
            },
            history: history.map(h => ({
                id: h.id.toString(),
                description: h.description || 'Points transaction',
                createdAt: h.created_at,
                points: h.points * (h.type === 'redeem' ? -1 : 1)
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
