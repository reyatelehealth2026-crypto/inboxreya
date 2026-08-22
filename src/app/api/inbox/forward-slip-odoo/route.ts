import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callPhpApi } from '@/lib/php-bridge'
import { mergeSlipMetadata } from '@/lib/slip-mark'

/** 1,000 ฿ = 1 point. Same rate the slip modal shows the rep. */
const POINTS_RATE = 1000

/**
 * POST /api/inbox/forward-slip-odoo
 *
 * Admin confirms an incoming image message as a payment slip
 * and forwards it to Odoo via the PHP bridge.
 *
 * Body (JSON):
 *   messageId?  – DB message ID (required when imageUrl is not provided)
 *   imageUrl?   – Uploaded image URL for manual file uploads
 *   userId      – DB user ID (required, internal)
 *   amount?     – float, override amount
 *   transferDate? – YYYY-MM-DD
 *   invoiceId?  – Odoo invoice ID
 *   orderId?    – Odoo sale order ID
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { messageId, imageUrl: providedImageUrl, userId, amount, transferDate, invoiceId, orderId, bdoId,
      slip_verified, slip_verify_ref, slip_verify_amount, slip_verify_data,
      // Used for the points reason line, the LINE flex message and the chat badge.
      // All optional: callers that omit them still save the slip exactly as before.
      bdoName, customerName, notifyCustomer = true } = body

    if (!userId || (!messageId && !providedImageUrl)) {
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

    // 1. Look up the user to get lineUserId
    const user = await prisma.lineUser.findUnique({
      where: { id: parsedUserId },
      select: { id: true, lineUserId: true, lineAccountId: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    if (!user.lineUserId) {
      return NextResponse.json(
        { error: 'ลูกค้านี้ไม่มี LINE User ID' },
        { status: 400 }
      )
    }

    let message: {
      id: number
      userId: number | null
      messageType: string | null
      content: string | null
      mediaUrl: string | null
      metadata: string | null
    } | null = null

    // 2. Look up the message to get the image URL when using an inbox image
    if (parsedMessageId > 0) {
      message = await prisma.message.findUnique({
        where: { id: parsedMessageId },
        select: { id: true, userId: true, messageType: true, content: true, mediaUrl: true, metadata: true },
      })

      if (!message) {
        return NextResponse.json({ error: 'Message not found' }, { status: 404 })
      }
      if (message.messageType !== 'image') {
        return NextResponse.json(
          { error: 'ข้อความนี้ไม่ใช่รูปภาพ' },
          { status: 400 }
        )
      }
    }

    // Resolve the image URL (content stores the saved URL, mediaUrl stores LINE message ID)
    let imageUrl = typeof providedImageUrl === 'string' ? providedImageUrl.trim() : ''
    if (!imageUrl && message) {
      imageUrl = message.content || ''
      if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
        // If content is not a URL, try to construct one from mediaUrl (LINE message ID)
        const phpBase =
          process.env.PHP_API_URL ||
          process.env.NEXT_PUBLIC_PHP_API_URL ||
          process.env.NEXT_PUBLIC_BASE_URL
        if (phpBase && message.mediaUrl) {
          imageUrl = `${phpBase.replace(/\/$/, '')}/api/line_content.php?id=${message.mediaUrl}`
        }
      }
    }

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'ไม่พบ URL ของรูปภาพ' },
        { status: 400 }
      )
    }

    // 3. Call PHP API to save slip locally
    const phpPayload: Record<string, any> = {
      line_user_id: user.lineUserId,
      image_url: imageUrl,
      line_account_id: user.lineAccountId,
      skip_line_notify: true,
      uploaded_by: session.user.name || session.user.email || 'admin',
      ...(parsedMessageId > 0 && { message_id_ref: parsedMessageId }),
    }

    // mediaUrl stores LINE message ID in our schema; include it for backend fallback download
    if (message?.mediaUrl) {
      phpPayload.message_id = message.mediaUrl
    }

    if (amount !== undefined && amount !== null) phpPayload.amount = Number(amount)
    if (transferDate) phpPayload.transfer_date = transferDate
    if (invoiceId) phpPayload.invoice_id = Number(invoiceId)
    if (orderId) phpPayload.order_id = Number(orderId)
    if (bdoId) phpPayload.bdo_id = Number(bdoId)

    // Slip verification data (pass-through to PHP)
    if (slip_verified !== undefined) phpPayload.slip_verified = slip_verified
    if (slip_verify_ref) phpPayload.slip_verify_ref = slip_verify_ref
    if (slip_verify_amount !== undefined) phpPayload.slip_verify_amount = slip_verify_amount
    if (slip_verify_data) phpPayload.slip_verify_data = slip_verify_data

    const phpResult = await callPhpApi('/api/odoo-slip-upload.php', {
      method: 'POST',
      body: JSON.stringify(phpPayload),
    })

    if (!phpResult.success) {
      return NextResponse.json(
        {
          error: phpResult.error || 'บันทึกสลิปไม่สำเร็จ',
          details: phpResult,
        },
        { status: 502 }
      )
    }

    const uploadData = phpResult.data ?? phpResult
    const localSlipId = Number(uploadData?.id || 0)

    if (bdoId && localSlipId > 0) {
      const matchPayload: Record<string, unknown> = {
        action: 'odoo_slip_match_api',
        local_slip_id: localSlipId,
        line_user_id: user.lineUserId,
        matches: [
          {
            bdo_id: Number(bdoId),
            ...(amount !== undefined && amount !== null ? { amount: Number(amount) } : {}),
          },
        ],
        note: 'Attach slip from InboxReya',
      }

      const matchResult = await callPhpApi('/api/odoo-dashboard-api.php', {
        method: 'POST',
        body: JSON.stringify(matchPayload),
      })

      if (!matchResult.success) {
        return NextResponse.json(
          {
            error: matchResult.error || 'บันทึกสลิปแล้ว แต่จับคู่ BDO ไม่สำเร็จ',
            upload: uploadData,
            match: matchResult,
          },
          { status: 502 }
        )
      }
    }

    // 4. Record the outcome on the customer's own message and reward the points.
    //
    // Both used to happen in the browser after this call returned. The rep could
    // close the modal or move to another chat before those requests finished, and
    // the customer silently lost their points. Doing it here means the work
    // starts the moment the slip is saved, whatever the rep does next.
    const verifiedAmount = Number(slip_verify_amount ?? amount)
    const earnedPoints =
      slip_verified && Number.isFinite(verifiedAmount) && verifiedAmount > 0
        ? Math.floor(verifiedAmount / POINTS_RATE)
        : 0

    if (message && slip_verified) {
      await prisma.message
        .update({
          where: { id: message.id },
          data: {
            metadata: mergeSlipMetadata(message.metadata, {
              verified: true,
              bdoId: bdoId ? Number(bdoId) : null,
              bdoName: typeof bdoName === 'string' && bdoName ? bdoName : null,
              amount: Number.isFinite(verifiedAmount) ? verifiedAmount : null,
              ref: slip_verify_ref || null,
              points: earnedPoints,
              at: new Date().toISOString(),
            }),
          },
        })
        .catch((error) => {
          // The slip is already saved in Odoo; a failed badge must not undo that.
          console.error('[forward-slip-odoo] could not mark message', message?.id, error)
        })
    }

    // Deliberately not awaited: the rep gets their response now, and this
    // container is a long-lived node server, so the work still completes.
    // Loopback, not NEXTAUTH_URL: the public hostname goes out through the CDN
    // and back, which is slower and can be cached or rate-limited on the way.
    // The session cookie is forwarded so both routes see the same signed-in rep.
    const cookie = request.headers.get('cookie') || ''
    const selfBase = `http://127.0.0.1:${process.env.PORT || 3000}`

    if (earnedPoints > 0) {
      void fetch(`${selfBase}/api/customers/${parsedUserId}/points/adjust`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          points: earnedPoints,
          reason: `แต้มจากสลิป ${bdoName || (bdoId ? `BDO-${bdoId}` : 'สลิป')} (฿${verifiedAmount.toLocaleString()})`,
          type: 'earn',
        }),
      }).catch((error) => console.error('[forward-slip-odoo] points failed', error))
    }

    if (notifyCustomer && slip_verified && slip_verify_data) {
      void fetch(`${selfBase}/api/inbox/slip-verify-notify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', cookie },
        body: JSON.stringify({
          userId: parsedUserId,
          verifyData: slip_verify_data,
          points: earnedPoints,
          bdoName: bdoName || (bdoId ? `BDO-${bdoId}` : ''),
          customerName: customerName || null,
        }),
      }).catch((error) => console.error('[forward-slip-odoo] notify failed', error))
    }

    return NextResponse.json({
      success: true,
      message: 'บันทึกสลิปเรียบร้อยแล้ว',
      data: uploadData,
      points: earnedPoints,
    })
  } catch (error) {
    console.error('[forward-slip-odoo] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
