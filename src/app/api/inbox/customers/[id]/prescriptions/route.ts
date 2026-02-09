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
      select: { id: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get prescriptions from prescriptions table
    const prescriptions = await prisma.$queryRawUnsafe<any[]>(
      `SELECT * FROM prescriptions WHERE user_id = ? ORDER BY created_at DESC`,
      parsedUserId
    )

    const data = prescriptions.map((p) => {
      // Parse medications if stored as JSON
      let medications: any[] = []
      if (p.medications) {
        try {
          medications = JSON.parse(p.medications)
        } catch {
          medications = []
        }
      }

      // Calculate if prescription is expiring soon (within 7 days)
      const expiresAt = p.expires_at ? new Date(p.expires_at) : null
      const now = new Date()
      const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
      const isExpiringSoon = expiresAt && expiresAt > now && expiresAt < sevenDaysFromNow

      return {
        id: p.id,
        userId: p.user_id,
        prescriptionNumber: p.prescription_number || null,
        imageUrl: p.image_url || p.prescription_image || null,
        status: p.status || 'pending',
        medications,
        notes: p.notes || null,
        prescribedBy: p.prescribed_by || null,
        prescribedDate: p.prescribed_date || p.created_at,
        expiresAt: p.expires_at || null,
        dispensedAt: p.dispensed_at || null,
        dispensedBy: p.dispensed_by || null,
        requiresVerification: p.requires_verification || false,
        verifiedBy: p.verified_by || null,
        verifiedAt: p.verified_at || null,
        isExpiringSoon,
        isExpired: expiresAt && expiresAt < now,
        refillCount: p.refill_count || 0,
        maxRefills: p.max_refills || 0,
        createdAt: p.created_at,
        updatedAt: p.updated_at,
      }
    })

    return NextResponse.json({ data })
  } catch (error) {
    console.error('Error fetching prescriptions:', error)
    return NextResponse.json(
      { error: 'Failed to fetch prescriptions' },
      { status: 500 }
    )
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
      select: { id: true, lineAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const body = await request.json()
    const {
      imageUrl,
      medications,
      notes,
      prescribedBy,
      prescribedDate,
      expiresAt,
      requiresVerification = true,
    } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'Prescription image is required' },
        { status: 400 }
      )
    }

    // Generate prescription number
    const prescriptionNumber = `RX${Date.now()}`

    // Insert prescription
    const medicationsJson = medications ? JSON.stringify(medications) : null

    await prisma.$queryRawUnsafe(
      `INSERT INTO prescriptions 
       (user_id, line_account_id, prescription_number, image_url, medications, notes, prescribed_by, prescribed_date, expires_at, requires_verification, status, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW())`,
      parsedUserId,
      user.lineAccountId || 0,
      prescriptionNumber,
      imageUrl,
      medicationsJson,
      notes || null,
      prescribedBy || null,
      prescribedDate || null,
      expiresAt || null,
      requiresVerification
    )

    return NextResponse.json({
      success: true,
      data: { prescriptionNumber },
    })
  } catch (error) {
    console.error('Error creating prescription:', error)
    return NextResponse.json(
      { error: 'Failed to create prescription' },
      { status: 500 }
    )
  }
}
