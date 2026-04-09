import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { requireAuth } from '@/lib/auth-middleware'
import { countBroadcastRecipients } from '@/lib/broadcast-recipient-estimate'

const estimateBroadcastRecipientsSchema = z.object({
  targetSegmentId: z.number().int().positive().optional(),
  targetCustomerIds: z.array(z.number().int().positive()).optional(),
  targetTagIds: z.array(z.number().int().positive()).optional(),
})

export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await req.json().catch(() => ({}))
    const validated = estimateBroadcastRecipientsSchema.parse(body)

    const totalRecipients = await countBroadcastRecipients({
      lineAccountId: authResult.user.lineAccountId as number,
      targetSegmentId: validated.targetSegmentId,
      targetCustomerIds: validated.targetCustomerIds,
      targetTagIds: validated.targetTagIds,
    })

    return NextResponse.json({
      success: true,
      data: { totalRecipients },
    })
  } catch (error: any) {
    console.error('Error estimating broadcast recipients:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: (error as any).errors || (error as any).issues },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to estimate broadcast recipients' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
