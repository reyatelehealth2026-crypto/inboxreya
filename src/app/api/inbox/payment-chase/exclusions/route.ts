import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import prisma from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

/**
 * POST   /api/inbox/payment-chase/exclusions            — never chase this customer again
 * DELETE /api/inbox/payment-chase/exclusions?userId=..  — put them back in scope
 *
 * Excluding also clears the customer's pending drafts, so the 🚫 button removes
 * the rows from the queue in the same click.
 */

const bodySchema = z.object({
  userId: z.number().int().positive(),
  reason: z.string().max(255).optional(),
})

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult
  const { user } = authResult

  let body: z.infer<typeof bodySchema>
  try {
    body = bodySchema.parse(await request.json())
  } catch {
    return NextResponse.json({ success: false, error: 'Invalid request body' }, { status: 400 })
  }

  const createdBy = user.id ? String(user.id) : null

  await prisma.$executeRaw`
    INSERT INTO payment_chase_exclusions (user_id, reason, created_by)
    VALUES (${body.userId}, ${body.reason ?? null}, ${createdBy})
    ON DUPLICATE KEY UPDATE reason = VALUES(reason), created_by = VALUES(created_by)
  `

  const clearedDrafts = await prisma.$executeRaw`
    UPDATE payment_chase_queue SET status = 'skipped'
    WHERE user_id = ${body.userId} AND status = 'draft'
  `

  return NextResponse.json({ success: true, clearedDrafts })
}

export async function DELETE(request: NextRequest) {
  const authResult = await requireAuth(request)
  if (authResult instanceof NextResponse) return authResult

  const userId = Number(new URL(request.url).searchParams.get('userId'))
  if (!Number.isFinite(userId)) {
    return NextResponse.json({ success: false, error: 'Invalid userId' }, { status: 400 })
  }

  await prisma.$executeRaw`DELETE FROM payment_chase_exclusions WHERE user_id = ${userId}`
  return NextResponse.json({ success: true })
}
