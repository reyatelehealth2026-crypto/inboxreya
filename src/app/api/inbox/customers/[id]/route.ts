import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { updateCustomerInfoField } from '@/lib/php-bridge'
import { Prisma, users_gender } from '@prisma/client'

// Helper function to get order days for a user
async function getOrderDays(userId: number): Promise<string[]> {
  try {
    const result = await prisma.$queryRaw<{ order_days: string | null }[]>`
      SELECT order_days FROM users WHERE id = ${userId}
    `
    if (result[0]?.order_days) {
      return JSON.parse(result[0].order_days)
    }
    return []
  } catch (error) {
    // Column might not exist yet
    console.warn('Could not fetch order_days:', error)
    return []
  }
}

// Helper function to get additional fields that may not be in Prisma schema
async function getAdditionalFields(userId: number): Promise<{
  realName: string | null
  birthday: string | null
  note: string | null
}> {
  try {
    const result = await prisma.$queryRaw<{
      real_name: string | null
      birthday: string | null
      note: string | null
    }[]>`
      SELECT real_name, birthday, note FROM users WHERE id = ${userId}
    `
    if (result[0]) {
      return {
        realName: result[0].real_name,
        birthday: result[0].birthday,
        note: result[0].note,
      }
    }
    return { realName: null, birthday: null, note: null }
  } catch (error) {
    // Columns might not exist yet
    console.warn('Could not fetch additional fields:', error)
    return { realName: null, birthday: null, note: null }
  }
}

async function getOdooLinkData(lineUserId: string): Promise<{
  partnerId: number | null
  partnerName: string | null
  customerCode: string | null
}> {
  try {
    const result = await prisma.$queryRaw<{
      odoo_partner_id: number | null
      odoo_partner_name: string | null
      odoo_customer_code: string | null
    }[]>`
      SELECT odoo_partner_id, odoo_partner_name, odoo_customer_code
      FROM odoo_line_users
      WHERE line_user_id = ${lineUserId}
      ORDER BY id DESC
      LIMIT 1
    `

    if (result[0]) {
      return {
        partnerId: result[0].odoo_partner_id,
        partnerName: result[0].odoo_partner_name,
        customerCode: result[0].odoo_customer_code,
      }
    }

    return { partnerId: null, partnerName: null, customerCode: null }
  } catch (error) {
    console.warn('Could not fetch Odoo link data:', error)
    return { partnerId: null, partnerName: null, customerCode: null }
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
    if (!userId) {
      return NextResponse.json({ error: 'Missing user id' }, { status: 400 })
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'User id must be a number' }, { status: 400 })
    }

    const where: { id: number; lineAccountId?: number } = { id: parsedUserId }
    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const user = await prisma.lineUser.findFirst({
      where,
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        statusMessage: true,
        firstName: true,
        lastName: true,
        phone: true,
        email: true,
        gender: true,
        weight: true,
        height: true,
        address: true,
        district: true,
        province: true,
        postalCode: true,
        memberId: true,
        membershipLevel: true,
        tier: true,
        points: true,
        totalPoints: true,
        availablePoints: true,
        usedPoints: true,
        loyaltyPoints: true,
        totalSpent: true,
        orderCount: true,
        lastInteraction: true,
        chatStatus: true,
        isBlocked: true,
        isRegistered: true,
        createdAt: true,
        updatedAt: true,
        tagAssignments: {
          select: {
            tag: {
              select: {
                id: true,
                name: true,
                color: true,
                description: true,
                tagType: true,
                priority: true,
              },
            },
          },
        },
        conversationAssignees: {
          where: { status: 'active' },
          select: {
            adminId: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const tags = user.tagAssignments.map((ta) => ({
      id: ta.tag.id.toString(),
      name: ta.tag.name,
      color: ta.tag.color ?? '#3B82F6',
      description: ta.tag.description,
      isAuto: ta.tag.tagType !== 'manual',
      sortOrder: ta.tag.priority ?? 0,
    }))

    const assigneeAdminIds = Array.from(
      new Set(
        user.conversationAssignees
          .map((assignment) => assignment.adminId)
          .filter((adminId): adminId is number => Number.isFinite(adminId))
      )
    )

    const assigneeAdmins = assigneeAdminIds.length > 0
      ? await prisma.adminUser.findMany({
          where: {
            id: { in: assigneeAdminIds },
          },
          select: {
            id: true,
            username: true,
            email: true,
            displayName: true,
            avatarUrl: true,
            role: true,
            isActive: true,
          },
        })
      : []

    const assigneeAdminMap = new Map(assigneeAdmins.map((admin) => [admin.id, admin]))

    const assignees = assigneeAdminIds
      .map((adminId) => assigneeAdminMap.get(adminId))
      .filter((admin): admin is NonNullable<typeof admin> => admin !== undefined)
      .map((admin) => ({
        id: admin.id.toString(),
        username: admin.username,
        email: admin.email,
        displayName: admin.displayName,
        avatarUrl: admin.avatarUrl,
        role: admin.role,
        isActive: admin.isActive ?? true,
      }))

    // Fetch additional fields from raw query
    const additionalFields = await getAdditionalFields(parsedUserId)
    const odooLinkData = await getOdooLinkData(user.lineUserId)

    // Calculate points from transactions (Mirroring PHP LoyaltyPoints::getUserPoints)
    let pointsSummary: any[] = []
    try {
      pointsSummary = await prisma.$queryRawUnsafe<any[]>(
        `SELECT
          COALESCE(SUM(CASE WHEN points > 0 THEN points ELSE 0 END), 0) as total_points,
          COALESCE(SUM(points), 0) as available_points,
          COALESCE(SUM(CASE WHEN points < 0 THEN ABS(points) ELSE 0 END), 0) as used_points
         FROM points_transactions
         WHERE user_id = ?`,
        parsedUserId
      )
    } catch (error) {
      console.warn('Could not fetch points summary:', error)
    }

    const summary = pointsSummary[0]
    let currentBalance = 0
    let totalPoints = 0
    let usedPoints = 0
    const preferredDisplayName = odooLinkData.partnerName || user.displayName

    // Only use transaction data if we have transactions (non-zero balance check logic)
    // Matches PHP logic for source of truth
    if (summary && (Number(summary.total_points) > 0 || Number(summary.used_points) > 0)) {
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

    return NextResponse.json({
      data: {
        user: {
          id: user.id.toString(),
          lineUserId: user.lineUserId,
          displayName: preferredDisplayName,
          pictureUrl: user.pictureUrl,
          statusMessage: user.statusMessage,
          firstName: user.firstName,
          lastName: user.lastName,
          realName: additionalFields.realName,
          phone: user.phone,
          email: user.email,
          birthDate: additionalFields.birthday,
          birthday: additionalFields.birthday,
          gender: user.gender,
          weight: user.weight,
          height: user.height,
          address: user.address,
          district: user.district,
          province: user.province,
          postalCode: user.postalCode,
          memberId: user.memberId || odooLinkData.customerCode,
          note: additionalFields.note,
          membershipLevel: user.membershipLevel,
          tier: user.tier,
          points: currentBalance,
          totalPoints: totalPoints,
          availablePoints: currentBalance,
          usedPoints: usedPoints,
          loyaltyPoints: user.loyaltyPoints,
          totalSpent: user.totalSpent,
          orderCount: user.orderCount,
          lastInteraction: user.lastInteraction?.toISOString() || null,
          chatStatus: user.chatStatus,
          isBlocked: user.isBlocked,
          isRegistered: user.isRegistered,
          createdAt: user.createdAt.toISOString(),
          updatedAt: user.updatedAt.toISOString(),
          orderDays: await getOrderDays(parsedUserId),
          odooPartnerId: odooLinkData.partnerId,
          odooPartnerName: odooLinkData.partnerName,
          odooCustomerCode: odooLinkData.customerCode,
        },
        tags,
        assignees,
        points: {
          total: totalPoints,
          available: currentBalance,
          used: usedPoints,
          loyalty: user.loyaltyPoints,
        },
      },
    })
  } catch (error) {
    console.error('Error fetching customer profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer profile' },
      { status: 500 }
    )
  }
}

export async function PATCH(
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

    const where: { id: number; lineAccountId?: number } = { id: parsedUserId }
    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const user = await prisma.lineUser.findFirst({
      where,
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      displayName,
      realName,
      memberId,
      phone,
      email,
      birthday,
      gender,
      address,
      district,
      province,
      postalCode,
      note,
    } = body

    const updates: Array<{ field: string; value: string | null }> = []
    const updateData: {
      displayName?: string | null
      realName?: string | null
      memberId?: string | null
      phone?: string | null
      email?: string | null
      birthday?: string | null
      gender?: users_gender | null
      address?: string | null
      district?: string | null
      province?: string | null
      postalCode?: string | null
      note?: string | null
    } = {}

    const parseGender = (value: unknown): users_gender | null | undefined => {
      if (value === null) return null
      if (typeof value !== 'string') return undefined

      const trimmed = value.trim()
      if (!trimmed) return null

      const lower = trimmed.toLowerCase()
      if (lower === 'male') return users_gender.male
      if (lower === 'female') return users_gender.female
      if (lower === 'other') return users_gender.other

      if (trimmed === 'ชาย') return users_gender.male
      if (trimmed === 'หญิง') return users_gender.female
      if (trimmed === 'อื่น' || trimmed === 'อื่นๆ' || trimmed === 'อื่น ๆ') return users_gender.other

      return undefined
    }

    if (displayName !== undefined) {
      updates.push({ field: 'display_name', value: displayName })
      updateData.displayName = displayName
    }
    if (realName !== undefined) {
      updates.push({ field: 'real_name', value: realName })
      updateData.realName = realName
    }
    if (memberId !== undefined) {
      updates.push({ field: 'member_id', value: memberId })
      updateData.memberId = memberId
    }
    if (phone !== undefined) {
      updates.push({ field: 'phone', value: phone })
      updateData.phone = phone
    }
    if (email !== undefined) {
      updates.push({ field: 'email', value: email })
      updateData.email = email
    }
    if (birthday !== undefined) {
      updates.push({ field: 'birthday', value: birthday })
      updateData.birthday = birthday
    }
    if (gender !== undefined) {
      const parsedGender = parseGender(gender)
      if (parsedGender === undefined) {
        return NextResponse.json(
          { error: 'Invalid gender. Expected male, female, other, or null.' },
          { status: 400 }
        )
      }
      updates.push({ field: 'gender', value: parsedGender })
      updateData.gender = parsedGender
    }
    if (address !== undefined) {
      updates.push({ field: 'address', value: address })
      updateData.address = address
    }
    if (district !== undefined) {
      updates.push({ field: 'district', value: district })
      updateData.district = district
    }
    if (province !== undefined) {
      updates.push({ field: 'province', value: province })
      updateData.province = province
    }
    if (postalCode !== undefined) {
      updates.push({ field: 'postal_code', value: postalCode })
      updateData.postalCode = postalCode
    }
    if (note !== undefined) {
      updates.push({ field: 'note', value: note })
      updateData.note = note
    }

    if (updates.length === 0) {
      return NextResponse.json(
        { error: 'No valid fields to update' },
        { status: 400 }
      )
    }

    const shouldCallPhp = Boolean(process.env.PHP_API_URL)
    let phpFailed = false

    if (shouldCallPhp) {
      for (const update of updates) {
        const result = await updateCustomerInfoField({
          userId,
          field: update.field,
          value: update.value ?? null,
          adminId: session.user.id,
        })
        if (!result.success) {
          phpFailed = true
          console.warn('PHP customer update failed, falling back to Prisma:', result.error)
          break
        }
      }
    }

    if (!shouldCallPhp || phpFailed) {
      try {
        await prisma.lineUser.update({
          where: { id: parsedUserId },
          data: updateData,
          select: { id: true },
        })
      } catch (updateError) {
        try {
          const columns = await prisma.$queryRaw<{ COLUMN_NAME: string }[]>(
            Prisma.sql`
              SELECT COLUMN_NAME
              FROM INFORMATION_SCHEMA.COLUMNS
              WHERE TABLE_SCHEMA = DATABASE()
                AND TABLE_NAME = 'users'
            `
          )
          const columnSet = new Set(columns.map((column) => column.COLUMN_NAME))
          const columnMap: Record<string, string> = {}
          if (columnSet.has('display_name')) columnMap.displayName = 'display_name'
          if (columnSet.has('displayName')) columnMap.displayName = 'displayName'
          if (columnSet.has('real_name')) columnMap.realName = 'real_name'
          if (columnSet.has('realName')) columnMap.realName = 'realName'
          if (columnSet.has('member_id')) columnMap.memberId = 'member_id'
          if (columnSet.has('memberId')) columnMap.memberId = 'memberId'
          if (columnSet.has('phone')) columnMap.phone = 'phone'
          if (columnSet.has('email')) columnMap.email = 'email'
          if (columnSet.has('birthday')) columnMap.birthday = 'birthday'
          if (columnSet.has('gender')) columnMap.gender = 'gender'
          if (columnSet.has('address')) columnMap.address = 'address'
          if (columnSet.has('district')) columnMap.district = 'district'
          if (columnSet.has('province')) columnMap.province = 'province'
          if (columnSet.has('postal_code')) columnMap.postalCode = 'postal_code'
          if (columnSet.has('postalCode')) columnMap.postalCode = 'postalCode'
          if (columnSet.has('note')) columnMap.note = 'note'

          const assignments: string[] = []
          const values: Array<string | null | number> = []
          if (updateData.displayName !== undefined && columnMap.displayName) {
            assignments.push(`\`${columnMap.displayName}\` = ?`)
            values.push(updateData.displayName)
          }
          if (updateData.realName !== undefined && columnMap.realName) {
            assignments.push(`\`${columnMap.realName}\` = ?`)
            values.push(updateData.realName)
          }
          if (updateData.memberId !== undefined && columnMap.memberId) {
            assignments.push(`\`${columnMap.memberId}\` = ?`)
            values.push(updateData.memberId)
          }
          if (updateData.phone !== undefined && columnMap.phone) {
            assignments.push(`\`${columnMap.phone}\` = ?`)
            values.push(updateData.phone)
          }
          if (updateData.email !== undefined && columnMap.email) {
            assignments.push(`\`${columnMap.email}\` = ?`)
            values.push(updateData.email)
          }
          if (updateData.birthday !== undefined && columnMap.birthday) {
            assignments.push(`\`${columnMap.birthday}\` = ?`)
            values.push(updateData.birthday)
          }
          if (updateData.gender !== undefined && columnMap.gender) {
            assignments.push(`\`${columnMap.gender}\` = ?`)
            values.push(updateData.gender)
          }
          if (updateData.address !== undefined && columnMap.address) {
            assignments.push(`\`${columnMap.address}\` = ?`)
            values.push(updateData.address)
          }
          if (updateData.district !== undefined && columnMap.district) {
            assignments.push(`\`${columnMap.district}\` = ?`)
            values.push(updateData.district)
          }
          if (updateData.province !== undefined && columnMap.province) {
            assignments.push(`\`${columnMap.province}\` = ?`)
            values.push(updateData.province)
          }
          if (updateData.postalCode !== undefined && columnMap.postalCode) {
            assignments.push(`\`${columnMap.postalCode}\` = ?`)
            values.push(updateData.postalCode)
          }
          if (updateData.note !== undefined && columnMap.note) {
            assignments.push(`\`${columnMap.note}\` = ?`)
            values.push(updateData.note)
          }

          if (assignments.length === 0) {
            throw updateError
          }

          const rawSql = `UPDATE users SET ${assignments.join(', ')} WHERE id = ?`
          values.push(parsedUserId)
          await prisma.$queryRawUnsafe(rawSql, ...values)
        } catch (rawError) {
          console.error('Error updating customer profile with raw query:', rawError)
          throw updateError
        }
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating customer profile:', error)
    return NextResponse.json(
      { error: 'Failed to update customer profile' },
      { status: 500 }
    )
  }
}
