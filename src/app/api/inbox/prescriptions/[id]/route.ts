import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: prescriptionId } = await params
    if (!prescriptionId) {
      return NextResponse.json({ error: 'Missing prescription id' }, { status: 400 })
    }

    const parsedId = Number(prescriptionId)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json(
        { error: 'Prescription id must be a number' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const { status, notes, verifiedBy, dispensedBy } = body

    const updates: string[] = []
    const values: any[] = []

    if (status !== undefined) {
      updates.push('status = ?')
      values.push(status)

      // Set timestamps based on status
      if (status === 'dispensed') {
        updates.push('dispensed_at = NOW()')
        if (dispensedBy) {
          updates.push('dispensed_by = ?')
          values.push(dispensedBy)
        }
      } else if (status === 'verified') {
        updates.push('verified_at = NOW()')
        if (verifiedBy) {
          updates.push('verified_by = ?')
          values.push(verifiedBy)
        }
      }
    }

    if (notes !== undefined) {
      updates.push('notes = ?')
      values.push(notes)
    }

    if (updates.length === 0) {
      return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
    }

    updates.push('updated_at = NOW()')
    values.push(parsedId)

    await prisma.$queryRawUnsafe(
      `UPDATE prescriptions SET ${updates.join(', ')} WHERE id = ?`,
      ...values
    )

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating prescription:', error)
    return NextResponse.json(
      { error: 'Failed to update prescription' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins can delete prescriptions
    if (!['admin', 'owner', 'super_admin', 'pharmacist'].includes(session.user.role || '')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: prescriptionId } = await params
    if (!prescriptionId) {
      return NextResponse.json({ error: 'Missing prescription id' }, { status: 400 })
    }

    const parsedId = Number(prescriptionId)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json(
        { error: 'Prescription id must be a number' },
        { status: 400 }
      )
    }

    await prisma.$queryRawUnsafe(`DELETE FROM prescriptions WHERE id = ?`, parsedId)

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting prescription:', error)
    return NextResponse.json(
      { error: 'Failed to delete prescription' },
      { status: 500 }
    )
  }
}
