import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { cacheInvalidate } from '@/lib/redis'
import { countBroadcastRecipients } from '@/lib/broadcast-recipient-estimate'
import { assertDraftReadyForApproval } from '@/lib/ai-agent/promo-drafts'

const approveSchema = z.object({
  scheduledAt: z.string().datetime(),
  targetTagIds: z.array(z.number().int().positive()).max(100).optional(),
  targetCustomerIds: z.array(z.number().int().positive()).max(1000).optional(),
})

export async function POST(
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

    const body = approveSchema.parse(await request.json())
    const scheduledAt = new Date(body.scheduledAt)

    const draft = await prisma.aiPromoDraft.findFirst({
      where: { id: draftId, lineAccountId: user.lineAccountId as number },
    })
    if (!draft) {
      return NextResponse.json({ success: false, error: 'Draft not found' }, { status: 404 })
    }
    if (draft.status === 'scheduled_broadcast_created' || draft.createdBroadcastId) {
      return NextResponse.json({ success: false, error: 'Draft already approved' }, { status: 409 })
    }
    if (draft.status === 'needs_review' && draft.errorMessage) {
      return NextResponse.json({ success: false, error: draft.errorMessage }, { status: 409 })
    }

    const envelope = assertDraftReadyForApproval({
      flexJson: draft.flexJson,
      scheduledAt,
      targetTagIds: body.targetTagIds,
      targetCustomerIds: body.targetCustomerIds,
    })

    const totalRecipients = await countBroadcastRecipients({
      lineAccountId: user.lineAccountId as number,
      targetTagIds: body.targetTagIds,
      targetCustomerIds: body.targetCustomerIds,
    })
    if (totalRecipients <= 0) {
      return NextResponse.json({ success: false, error: 'Selected audience has no recipients' }, { status: 400 })
    }

    const result = await prisma.$transaction(async (tx) => {
      const broadcast = await tx.broadcastMessageV2.create({
        data: {
          lineAccountId: user.lineAccountId as number,
          content: JSON.stringify({ ...envelope, summaryText: draft.generatedCopy || envelope.summaryText }),
          mediaUrl: null,
          scheduledAt,
          totalRecipients,
          status: 'scheduled',
          createdBy: parseInt(String(user.id), 10),
        },
      })

      if (body.targetCustomerIds?.length) {
        const values = body.targetCustomerIds
          .map((userId) => `(${broadcast.id}, ${Number(userId)})`)
          .join(', ')
        await tx.$executeRawUnsafe(`INSERT INTO broadcast_recipients (broadcast_id, user_id) VALUES ${values}`)
      }

      const updatedDraft = await tx.aiPromoDraft.update({
        where: { id: draft.id },
        data: {
          status: 'scheduled_broadcast_created',
          approvedBy: parseInt(String(user.id), 10),
          approvedAt: new Date(),
          proposedScheduledAt: scheduledAt,
          createdBroadcastId: broadcast.id,
        },
      })

      return { broadcast, draft: updatedDraft }
    })

    await cacheInvalidate('broadcasts:*')

    return NextResponse.json({ success: true, data: result })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ success: false, error: 'Validation failed', details: error.issues }, { status: 400 })
    }
    const message = error instanceof Error ? error.message : 'Failed to approve draft'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

