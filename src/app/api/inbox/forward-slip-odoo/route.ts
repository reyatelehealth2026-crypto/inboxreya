import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callPhpApi } from '@/lib/php-bridge'

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
<<<<<<< HEAD
    const { messageId, userId, amount, transferDate, invoiceId, orderId, bdoId,
      slip_verified, slip_verify_ref, slip_verify_amount, slip_verify_data } = body
=======
    const { messageId, imageUrl: providedImageUrl, userId, amount, transferDate, invoiceId, orderId, bdoId } = body
>>>>>>> c15290d388ce453cc4c3269482a1eebac36fdb9b

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
    } | null = null

    // 2. Look up the message to get the image URL when using an inbox image
    if (parsedMessageId > 0) {
      message = await prisma.message.findUnique({
        where: { id: parsedMessageId },
        select: { id: true, userId: true, messageType: true, content: true, mediaUrl: true },
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

    // SlipMate verification data (pass-through to PHP)
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

    return NextResponse.json({
      success: true,
      message: 'บันทึกสลิปเรียบร้อยแล้ว',
      data: uploadData,
    })
  } catch (error) {
    console.error('[forward-slip-odoo] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
