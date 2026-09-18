import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { attachSlip } from '@/lib/slip-attach'

/**
 * POST /api/inbox/forward-slip-odoo
 *
 * Admin confirms an incoming image message as a payment slip and forwards it to
 * Odoo. The filing itself lives in `@/lib/slip-attach` because the pre-scan cron
 * does exactly the same work with no rep session.
 *
 * Body (JSON):
 *   messageId?      – DB message ID (required when imageUrl is not provided)
 *   imageUrl?       – Uploaded image URL for manual file uploads
 *   userId          – DB user ID (required, internal)
 *   amount?         – float, override amount
 *   transferDate?   – YYYY-MM-DD
 *   invoiceId?      – Odoo invoice ID
 *   orderId?        – Odoo sale order ID
 *   bdoId?          – BDO to attach the slip to
 *   bdoName?, customerName?, notifyCustomer? – used for points, the LINE flex and the chat badge
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      messageId,
      imageUrl,
      userId,
      amount,
      transferDate,
      invoiceId,
      orderId,
      bdoId,
      bdoName,
      customerName,
      notifyCustomer = true,
      slip_verified,
      slip_verify_ref,
      slip_verify_amount,
      slip_verify_data,
    } = body

    if (!userId || (!messageId && !imageUrl)) {
      return NextResponse.json(
        { error: 'userId and either messageId or imageUrl are required' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(userId)
    const parsedMessageId = messageId ? Number(messageId) : 0
    if (!Number.isFinite(parsedUserId) || (messageId && !Number.isFinite(parsedMessageId))) {
      return NextResponse.json({ error: 'Invalid userId or messageId' }, { status: 400 })
    }

    const result = await attachSlip({
      userId: parsedUserId,
      messageId: parsedMessageId > 0 ? parsedMessageId : undefined,
      imageUrl: typeof imageUrl === 'string' ? imageUrl : undefined,
      amount,
      transferDate,
      invoiceId,
      orderId,
      bdoId,
      bdoName,
      customerName,
      notifyCustomer,
      slipVerified: slip_verified,
      slipVerifyRef: slip_verify_ref,
      slipVerifyAmount: slip_verify_amount,
      slipVerifyData: slip_verify_data,
      uploadedBy: session.user.name || session.user.email || 'admin',
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error, ...(result.data ? { upload: result.data } : {}), details: result.details },
        { status: result.status }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกสลิปเรียบร้อยแล้ว',
      data: result.data,
      points: result.points,
    })
  } catch (error) {
    console.error('[forward-slip-odoo] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
