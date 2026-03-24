import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

export async function PUT(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const session = await auth()
        if (!session?.user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const { id: userId } = await params
        const { orderDays } = await request.json()

        // Validate orderDays array
        const validDays = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun']
        if (!Array.isArray(orderDays) || !orderDays.every(d => validDays.includes(d))) {
            return NextResponse.json({ error: 'Invalid order days' }, { status: 400 })
        }

        const parsedUserId = Number(userId)
        if (!Number.isFinite(parsedUserId)) {
            return NextResponse.json({ error: 'User id must be a number' }, { status: 400 })
        }

        // Ensure order_days column exists
        try {
            await prisma.$executeRaw`
                ALTER TABLE users ADD COLUMN IF NOT EXISTS order_days JSON DEFAULT NULL
            `
        } catch (alterError) {
            // Column might already exist or DB doesn't support IF NOT EXISTS
            console.log('Column may already exist:', alterError)
        }

        // Update user's order days
        const orderDaysJson = JSON.stringify(orderDays)
        await prisma.$executeRaw`
            UPDATE users 
            SET order_days = ${orderDaysJson}
            WHERE id = ${parsedUserId}
        `

        console.log(`Order days saved for user ${parsedUserId}:`, orderDays)

        // Invalidate order-days cache
        await cacheInvalidate(`customer:orderdays:${parsedUserId}`)
        await cacheInvalidate(`customer:profile:${parsedUserId}`)

        return NextResponse.json({ success: true, orderDays })
    } catch (error) {
        console.error('Error updating order days:', error)
        return NextResponse.json(
            { error: 'Failed to update order days', details: String(error) },
            { status: 500 }
        )
    }
}

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
        const parsedUserId = Number(userId)

        if (!Number.isFinite(parsedUserId)) {
            return NextResponse.json({ error: 'User id must be a number' }, { status: 400 })
        }

        const orderDays = await cacheQuery(
          `customer:orderdays:${parsedUserId}`,
          async () => {
            const result = await prisma.$queryRaw<{ order_days: string | null }[]>`
              SELECT order_days FROM users WHERE id = ${parsedUserId}
            `
            return result[0]?.order_days ? JSON.parse(result[0].order_days) : []
          },
          CACHE_TTL.CUSTOMER_PROFILE  // 120s
        )

        return NextResponse.json({ orderDays })
    } catch (error) {
        console.error('Error fetching order days:', error)
        return NextResponse.json(
            { error: 'Failed to fetch order days' },
            { status: 500 }
        )
    }
}
