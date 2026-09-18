import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

const updateSchema = z.object({
  generatedCopy: z.string().max(5000).optional(),
  flexJson: z.any().optional(),
  proposedScheduledAt: z.string().datetime().nullable().optional(),
  reviewNotes: z.string().max(5000).nullable().optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const { id } = await params
    const draftId = parseInt(id, 10)
    if (!Number.isFinite(draftId)) {
      return NextResponse.json({ success: false, error: 'Invalid draft id' }, { status: 400 })
    }

    const existing = await prisma.aiPromoDraft.findFirst({
      where: { id: draftId, lineAccountId: user.lineAccountId as number },
    })
    if (!existing) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
    }
    if (existing.status === 'scheduled_broadcast_created' || existing.status === 'approved') {
      return NextResponse.json({ success: false, error: 'Approved drafts cannot be edited' }, { status: 409 })
    }

    const body = updateSchema.parse(await request.json())
    const updated = await prisma.aiPromoDraft.update({
      where: { id: draftId },
      data: {
        ...(body.generatedCopy !== undefined ? { generatedCopy: body.generatedCopy } : {}),
        ...(body.flexJson !== undefined ? { flexJson: body.flexJson } : {}),
        ...(body.proposedScheduledAt !== undefined
          ? { proposedScheduledAt: body.proposedScheduledAt ? new Date(body.proposedScheduledAt) : null }
          : {}),
        ...(body.reviewNotes !== undefined ? { reviewNotes: body.reviewNotes } : {}),
        status: 'edited',
        editedBy: parseInt(String(user.id), 10),
      },
    })

    return NextResponse.json({ success: true, data: updated })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to update draft'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

