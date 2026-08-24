import prisma from './prisma'
import { callPhpApi } from './php-bridge'
import { mergeSlipMetadata } from './slip-mark'
import { adjustPoints } from './loyalty'

/**
 * Filing a payment slip: store it in Odoo, optionally match it to a BDO, mark the
 * chat image, credit the points and tell the customer.
 *
 * Extracted from `/api/inbox/forward-slip-odoo` so the pre-scan cron can do the
 * same work unattended. The route still owns the HTTP concerns — auth and status
 * codes — and hands the actual filing here.
 */

/** 1,000 ฿ = 1 point. Same rate the slip modal shows the rep. */
export const POINTS_RATE = 1000

export interface AttachSlipInput {
  userId: number
  /** Inbox message the customer sent the image in. */
  messageId?: number
  /** Explicit URL, for manually uploaded files that have no message. */
  imageUrl?: string
  amount?: number | null
  transferDate?: string | null
  invoiceId?: number | null
  orderId?: number | null
  bdoId?: number | null
  bdoName?: string | null
  customerName?: string | null
  /** Send the customer the LINE flex with the result and their points. */
  notifyCustomer?: boolean
  slipVerified?: boolean
  slipVerifyRef?: string | null
  slipVerifyAmount?: number | null
  slipVerifyData?: Record<string, unknown> | null
  /** Shown in Odoo as who filed the slip. */
  uploadedBy: string
}

export interface AttachSlipResult {
  success: boolean
  /** HTTP status the route should answer with. */
  status: number
  error?: string
  data?: any
  details?: unknown
  points: number
}

/**
 * Never throws for an expected failure — a missing user or a PHP error comes back
 * as a result, so the cron can count it and move on.
 */
export async function attachSlip(input: AttachSlipInput): Promise<AttachSlipResult> {
  const {
    userId,
    messageId,
    imageUrl: providedImageUrl,
    amount,
    transferDate,
    invoiceId,
    orderId,
    bdoId,
    bdoName,
    customerName,
    notifyCustomer = true,
    slipVerified,
    slipVerifyRef,
    slipVerifyAmount,
    slipVerifyData,
    uploadedBy,
  } = input

  const parsedMessageId = messageId ? Number(messageId) : 0

  const user = await prisma.lineUser.findUnique({
    where: { id: userId },
    select: { id: true, lineUserId: true, lineAccountId: true },
  })

  if (!user) return { success: false, status: 404, error: 'User not found', points: 0 }
  if (!user.lineUserId) {
    return { success: false, status: 400, error: 'ลูกค้านี้ไม่มี LINE User ID', points: 0 }
  }

  let message: {
    id: number
    userId: number | null
    messageType: string | null
    content: string | null
    mediaUrl: string | null
    metadata: string | null
  } | null = null

  if (parsedMessageId > 0) {
    message = await prisma.message.findUnique({
      where: { id: parsedMessageId },
      select: { id: true, userId: true, messageType: true, content: true, mediaUrl: true, metadata: true },
    })

    if (!message) return { success: false, status: 404, error: 'Message not found', points: 0 }
    if (message.messageType !== 'image') {
      return { success: false, status: 400, error: 'ข้อความนี้ไม่ใช่รูปภาพ', points: 0 }
    }
  }

  // Resolve the image URL (content stores the saved URL, mediaUrl stores LINE message ID)
  let imageUrl = typeof providedImageUrl === 'string' ? providedImageUrl.trim() : ''
  if (!imageUrl && message) {
    imageUrl = message.content || ''
    if (!imageUrl || (!imageUrl.startsWith('http://') && !imageUrl.startsWith('https://'))) {
      const phpBase =
        process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || process.env.NEXT_PUBLIC_BASE_URL
      if (phpBase && message.mediaUrl) {
        imageUrl = `${phpBase.replace(/\/$/, '')}/api/line_content.php?id=${message.mediaUrl}`
      }
    }
  }

  if (!imageUrl) return { success: false, status: 400, error: 'ไม่พบ URL ของรูปภาพ', points: 0 }

  const phpPayload: Record<string, any> = {
    line_user_id: user.lineUserId,
    image_url: imageUrl,
    line_account_id: user.lineAccountId,
    skip_line_notify: true,
    uploaded_by: uploadedBy,
    ...(parsedMessageId > 0 && { message_id_ref: parsedMessageId }),
  }

  // mediaUrl stores LINE message ID in our schema; include it for backend fallback download
  if (message?.mediaUrl) phpPayload.message_id = message.mediaUrl

  if (amount !== undefined && amount !== null) phpPayload.amount = Number(amount)
  if (transferDate) phpPayload.transfer_date = transferDate
  if (invoiceId) phpPayload.invoice_id = Number(invoiceId)
  if (orderId) phpPayload.order_id = Number(orderId)
  if (bdoId) phpPayload.bdo_id = Number(bdoId)

  if (slipVerified !== undefined) phpPayload.slip_verified = slipVerified
  if (slipVerifyRef) phpPayload.slip_verify_ref = slipVerifyRef
  if (slipVerifyAmount !== undefined && slipVerifyAmount !== null) {
    phpPayload.slip_verify_amount = slipVerifyAmount
  }
  if (slipVerifyData) phpPayload.slip_verify_data = slipVerifyData

  const phpResult = await callPhpApi('/api/odoo-slip-upload.php', {
    method: 'POST',
    body: JSON.stringify(phpPayload),
  })

  if (!phpResult.success) {
    return {
      success: false,
      status: 502,
      error: phpResult.error || 'บันทึกสลิปไม่สำเร็จ',
      details: phpResult,
      points: 0,
    }
  }

  const uploadData = phpResult.data ?? phpResult
  const localSlipId = Number(uploadData?.id || 0)

  if (bdoId && localSlipId > 0) {
    const matchResult = await callPhpApi('/api/odoo-dashboard-api.php', {
      method: 'POST',
      body: JSON.stringify({
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
      }),
    })

    if (!matchResult.success) {
      return {
        success: false,
        status: 502,
        error: matchResult.error || 'บันทึกสลิปแล้ว แต่จับคู่ BDO ไม่สำเร็จ',
        data: uploadData,
        details: matchResult,
        points: 0,
      }
    }
  } else if (invoiceId && localSlipId > 0) {
    // A different endpoint on purpose: `odoo_slip_match_api` above resolves only
    // `bdo_id` and throws "No valid BDO matches" on anything else, while this one
    // takes typed targets. Customers who pay before delivery are matched against
    // the invoice, because their BDO does not exist yet when the slip arrives.
    const matchResult = await callPhpApi('/api/slip-match-orders.php', {
      method: 'POST',
      body: JSON.stringify({
        action: 'match',
        slip_id: localSlipId,
        line_account_id: user.lineAccountId,
        targets: [{ type: 'invoice', id: Number(invoiceId) }],
        note: 'Attach slip from InboxReya',
      }),
    })

    if (!matchResult.success) {
      return {
        success: false,
        status: 502,
        error: matchResult.error || 'บันทึกสลิปแล้ว แต่จับคู่ใบแจ้งหนี้ไม่สำเร็จ',
        data: uploadData,
        details: matchResult,
        points: 0,
      }
    }
  }

  const verifiedAmount = Number(slipVerifyAmount ?? amount)
  const earnedPoints =
    slipVerified && Number.isFinite(verifiedAmount) && verifiedAmount > 0
      ? Math.floor(verifiedAmount / POINTS_RATE)
      : 0

  // Record the outcome on the customer's own message so chat can show a badge.
  if (message && slipVerified) {
    await prisma.message
      .update({
        where: { id: message.id },
        data: {
          metadata: mergeSlipMetadata(message.metadata, {
            verified: true,
            bdoId: bdoId ? Number(bdoId) : null,
            bdoName: typeof bdoName === 'string' && bdoName ? bdoName : null,
            amount: Number.isFinite(verifiedAmount) ? verifiedAmount : null,
            ref: slipVerifyRef || null,
            points: earnedPoints,
            at: new Date().toISOString(),
          }),
        },
      })
      .catch((error) => {
        // The slip is already saved in Odoo; a failed badge must not undo that.
        console.error('[slip-attach] could not mark message', message?.id, error)
      })
  }

  // Points go straight to the database, not back out through the points endpoint.
  // Money must not depend on a session cookie surviving a loopback hop.
  if (earnedPoints > 0) {
    void adjustPoints({
      userId,
      points: earnedPoints,
      reason: `แต้มจากสลิป ${bdoName || (bdoId ? `BDO-${bdoId}` : 'สลิป')} (฿${verifiedAmount.toLocaleString()})`,
    }).catch((error) => console.error('[slip-attach] points failed', error))
  }

  if (notifyCustomer && slipVerified && slipVerifyData) {
    // Loopback, not NEXTAUTH_URL: the public hostname goes out through the CDN
    // and back, which is slower and can be cached or rate-limited on the way.
    void fetch(`http://127.0.0.1:${process.env.PORT || 3000}/api/inbox/slip-verify-notify`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // There is no rep session here — the notify route accepts this shared
        // secret for internal callers for exactly this reason.
        ...(process.env.CRON_SECRET ? { Authorization: `Bearer ${process.env.CRON_SECRET}` } : {}),
      },
      body: JSON.stringify({
        userId,
        verifyData: slipVerifyData,
        points: earnedPoints,
        bdoName: bdoName || (bdoId ? `BDO-${bdoId}` : ''),
        customerName: customerName || null,
      }),
    }).catch((error) => console.error('[slip-attach] notify failed', error))
  }

  return { success: true, status: 200, data: uploadData, points: earnedPoints }
}
