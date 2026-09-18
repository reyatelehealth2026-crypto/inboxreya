import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { adjustPoints } from '@/lib/loyalty'

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

        // The transaction itself lives in @/lib/loyalty so the slip flow can
        // credit points directly instead of calling this endpoint over HTTP.
        const result = await adjustPoints({ userId, points, reason })

        return NextResponse.json({ success: true, newBalance: result })

    } catch (error) {
        console.error('Failed to adjust points:', error)
        return NextResponse.json(
            { error: 'Failed to adjust points' },
            { status: 500 }
        )
    }
}
