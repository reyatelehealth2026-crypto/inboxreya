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

    // Fetch activity logs for this user from activity_logs table
    // This uses raw query because the activity_logs table may not be in Prisma schema
    const activities = await prisma.$queryRaw<{
      id: number
      log_type: string
      action: string
      description: string | null
      user_id: number | null
      user_name: string | null
      admin_id: number | null
      admin_name: string | null
      entity_type: string | null
      entity_id: number | null
      old_value: string | null
      new_value: string | null
      ip_address: string | null
      created_at: Date
    }[]>`
      SELECT
        id,
        log_type,
        action,
        description,
        user_id,
        user_name,
        admin_id,
        admin_name,
        entity_type,
        entity_id,
        old_value,
        new_value,
        ip_address,
        created_at
      FROM activity_logs
      WHERE user_id = ${parsedUserId}
         OR (entity_type = 'user' AND entity_id = ${parsedUserId})
         OR (entity_type = 'tag' AND user_id = ${parsedUserId})
      ORDER BY created_at DESC
      LIMIT 30
    `

    // Transform the data
    const formattedActivities = activities.map((activity) => ({
      id: activity.id.toString(),
      logType: activity.log_type,
      action: activity.action,
      description: activity.description,
      userId: activity.user_id,
      userName: activity.user_name,
      adminId: activity.admin_id,
      adminName: activity.admin_name,
      entityType: activity.entity_type,
      entityId: activity.entity_id,
      oldValue: activity.old_value ? JSON.parse(activity.old_value) : null,
      newValue: activity.new_value ? JSON.parse(activity.new_value) : null,
      ipAddress: activity.ip_address,
      createdAt: activity.created_at.toISOString(),
    }))

    return NextResponse.json({
      data: formattedActivities,
    })
  } catch (error) {
    console.error('Error fetching activity logs:', error)
    // Return empty array if table doesn't exist or query fails
    return NextResponse.json({
      data: [],
    })
  }
}
