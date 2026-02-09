import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const where: { isActive: boolean; lineAccountId?: number } = {
      isActive: true,
    }

    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const admins = await prisma.adminUser.findMany({
      where,
      select: {
        id: true,
        username: true,
        email: true,
        displayName: true,
        avatarUrl: true,
        role: true,
        isActive: true,
      },
      orderBy: [{ displayName: 'asc' }, { username: 'asc' }],
    })

    return NextResponse.json({
      data: admins.map((admin) => ({
        ...admin,
        id: admin.id.toString(),
      })),
    })
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}
