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
 *   messageId   – DB message ID (required)
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
    const { messageId, userId, amount, transferDate, invoiceId, orderId } = body

    if (!messageId || !userId) {
      return NextResponse.json(
        { error: 'messageId and userId are required' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(userId)
    const parsedMessageId = Number(messageId)
    if (!Number.isFinite(parsedUserId) || !Number.isFinite(parsedMessageId)) {
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

    // 2. Look up the message to get the image URL
    const message = await prisma.message.findUnique({
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

    // Resolve the image URL (content stores the saved URL, mediaUrl stores LINE message ID)
    let imageUrl = message.content
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

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'ไม่พบ URL ของรูปภาพ' },
        { status: 400 }
      )
    }

    // 3. Call PHP API to forward slip to Odoo
    const phpPayload: Record<string, any> = {
      line_user_id: user.lineUserId,
      image_url: imageUrl,
      line_account_id: user.lineAccountId,
      skip_line_notify: true, // Admin flow — no need to push LINE message
    }

    if (amount !== undefined && amount !== null) phpPayload.amount = Number(amount)
    if (transferDate) phpPayload.transfer_date = transferDate
    if (invoiceId) phpPayload.invoice_id = Number(invoiceId)
    if (orderId) phpPayload.order_id = Number(orderId)

    const phpResult = await callPhpApi('/api/odoo-slip-upload.php', {
      method: 'POST',
      body: JSON.stringify(phpPayload),
    })

    if (!phpResult.success) {
      return NextResponse.json(
        {
          error: phpResult.error || 'Failed to forward slip to Odoo',
          details: phpResult,
        },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งสลิปไป Odoo เรียบร้อยแล้ว',
      data: phpResult.data ?? phpResult,
    })
  } catch (error) {
    console.error('[forward-slip-odoo] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
