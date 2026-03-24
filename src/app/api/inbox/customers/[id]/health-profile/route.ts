import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { cacheQuery, cacheInvalidate, CACHE_TTL } from '@/lib/redis'

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
      select: { id: true, lineUserId: true, lineAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get health profile (cached 60s)
    const data = await cacheQuery(
      `customer:healthprofile:${parsedUserId}`,
      async () => {
        const [healthProfile, customerProfile] = await Promise.all([
          prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM user_health_profiles WHERE line_user_id = ? AND line_account_id = ? LIMIT 1`,
            user.lineUserId,
            user.lineAccountId || 0
          ),
          prisma.$queryRawUnsafe<any[]>(
            `SELECT * FROM customer_health_profiles WHERE user_id = ? LIMIT 1`,
            parsedUserId
          ),
        ])

        const profile = healthProfile[0] || null
        const customer = customerProfile[0] || null

        let medicalConditions: string[] = []
        if (profile?.medical_conditions) {
          try {
            const parsed = JSON.parse(profile.medical_conditions)
            medicalConditions = Array.isArray(parsed) ? parsed : [profile.medical_conditions]
          } catch {
            medicalConditions = [profile.medical_conditions]
          }
        }

        let chronicConditions: string[] = []
        if (customer?.chronic_conditions) {
          try {
            const parsed = JSON.parse(customer.chronic_conditions)
            chronicConditions = Array.isArray(parsed) ? parsed : [customer.chronic_conditions]
          } catch {
            chronicConditions = [customer.chronic_conditions]
          }
        }

        const allConditions = [...new Set([...medicalConditions, ...chronicConditions])]

        return {
          id: profile?.id || null,
          userId: parsedUserId,
          age: profile?.age || null,
          gender: profile?.gender || null,
          weight: profile?.weight ? parseFloat(profile.weight) : null,
          height: profile?.height ? parseFloat(profile.height) : null,
          bloodType: profile?.blood_type || null,
          medicalConditions: allConditions,
          allergies: [],
          currentMedications: [],
          communicationType: customer?.communication_type || null,
          confidence: customer?.confidence ? parseFloat(customer.confidence) : null,
          completeness: calculateCompleteness({
            age: profile?.age,
            gender: profile?.gender,
            weight: profile?.weight,
            height: profile?.height,
            bloodType: profile?.blood_type,
            medicalConditions: allConditions,
          }),
          updatedAt: profile?.updated_at || profile?.created_at || null,
        }
      },
      CACHE_TTL.PRESCRIPTIONS  // 60s
    )

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching health profile:', error)
    return NextResponse.json(
      { error: 'Failed to fetch health profile' },
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

    // Get user to verify access
    const where: { id: number; lineAccountId?: number } = { id: parsedUserId }
    if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
      where.lineAccountId = session.user.lineAccountId
    }

    const user = await prisma.lineUser.findFirst({
      where,
      select: { id: true, lineUserId: true, lineAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      age,
      gender,
      weight,
      height,
      bloodType,
      medicalConditions,
      allergies,
      currentMedications,
    } = body

    // Update or create health profile
    const medicalConditionsJson = medicalConditions
      ? JSON.stringify(medicalConditions)
      : null

    // Check if profile exists
    const existing = await prisma.$queryRawUnsafe<any[]>(
      `SELECT id FROM user_health_profiles WHERE line_user_id = ? AND line_account_id = ? LIMIT 1`,
      user.lineUserId,
      user.lineAccountId || 0
    )

    if (existing.length > 0) {
      // Update existing profile
      const updates: string[] = []
      const values: any[] = []

      if (age !== undefined) {
        updates.push('age = ?')
        values.push(age)
      }
      if (gender !== undefined) {
        updates.push('gender = ?')
        values.push(gender)
      }
      if (weight !== undefined) {
        updates.push('weight = ?')
        values.push(weight)
      }
      if (height !== undefined) {
        updates.push('height = ?')
        values.push(height)
      }
      if (bloodType !== undefined) {
        updates.push('blood_type = ?')
        values.push(bloodType)
      }
      if (medicalConditionsJson !== null) {
        updates.push('medical_conditions = ?')
        values.push(medicalConditionsJson)
      }

      if (updates.length > 0) {
        updates.push('updated_at = NOW()')
        values.push(user.lineUserId, user.lineAccountId || 0)

        await prisma.$queryRawUnsafe(
          `UPDATE user_health_profiles SET ${updates.join(', ')} WHERE line_user_id = ? AND line_account_id = ?`,
          ...values
        )
      }
    } else {
      // Create new profile
      await prisma.$queryRawUnsafe(
        `INSERT INTO user_health_profiles (line_user_id, line_account_id, age, gender, weight, height, blood_type, medical_conditions, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
        user.lineUserId,
        user.lineAccountId || 0,
        age || null,
        gender || null,
        weight || null,
        height || null,
        bloodType || null,
        medicalConditionsJson
      )
    }

    // Invalidate health profile cache
    await cacheInvalidate(`customer:healthprofile:${parsedUserId}`)
    await cacheInvalidate(`customer:profile:${parsedUserId}`)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating health profile:', error)
    return NextResponse.json(
      { error: 'Failed to update health profile' },
      { status: 500 }
    )
  }
}

function calculateCompleteness(profile: {
  age?: number | null
  gender?: string | null
  weight?: number | null
  height?: number | null
  bloodType?: string | null
  medicalConditions?: string[]
}): number {
  const fields = [
    profile.age,
    profile.gender,
    profile.weight,
    profile.height,
    profile.bloodType,
    profile.medicalConditions && profile.medicalConditions.length > 0,
  ]

  const filledFields = fields.filter((field) => field !== null && field !== undefined).length
  return Math.round((filledFields / fields.length) * 100)
}
