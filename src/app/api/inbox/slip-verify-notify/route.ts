import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendFlexMessage } from '@/lib/line-api'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { broadcastNewMessage } from '@/lib/pusher'
import { cacheInvalidate } from '@/lib/redis'
import { toUtcIsoString } from '@/lib/datetime-api'

const BANK_MAP: Record<string, string> = {
  '014': 'ธนาคารไทยพาณิชย์',
  '004': 'ธนาคารกสิกรไทย',
  '002': 'ธนาคารกรุงเทพ',
  '006': 'ธนาคารกรุงไทย',
  '025': 'ธนาคารกรุงศรีอยุธยา',
  '011': 'ธนาคารทหารไทยธนชาต',
  '030': 'ธนาคารออมสิน',
  '034': 'ธนาคารเพื่อการเกษตร',
}

function getBankName(code: string | undefined, fallbackName: string | undefined): string {
  if (code && BANK_MAP[code]) return BANK_MAP[code]
  return fallbackName || 'ธนาคาร'
}

function buildSlipVerifyFlex(params: {
  verifyData: any
  points: number
  bdoName: string
  customerName: string | null
}) {
  const { verifyData: d, points, bdoName } = params

  const senderBankName = getBankName(d.sendingBank, d.sendingBankName)
  const receiverBankName = getBankName(d.receivingBank, d.receivingBankName)
  const senderName = d.sender?.displayName || d.sender?.name || '-'
  const senderAccount = d.sender?.account?.value || ''
  const receiverName = d.receiver?.displayName || d.receiver?.name || '-'
  const receiverAccount = d.receiver?.account?.value || ''
  const amount = Number(d.amount || 0)
  const amountStr = `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`

  let dateTimeStr = ''
  if (d.transDate) {
    try {
      const parsed = new Date(d.transDate)
      dateTimeStr = Number.isNaN(parsed.getTime())
        ? d.transDate
        : parsed.toLocaleDateString('th-TH', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
          })
    } catch {
      dateTimeStr = d.transDate
    }
    if (d.transTime) dateTimeStr += `, ${d.transTime}`
  }

  const bodyContents: any[] = [
    {
      type: 'text',
      text: amountStr,
      size: '3xl',
      weight: 'bold',
      align: 'center',
      color: '#111827',
    },
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: 'วันที่-เวลา', size: 'xs', color: '#6B7280', flex: 0 },
        {
          type: 'text',
          text: dateTimeStr || '-',
          size: 'xs',
          color: '#374151',
          align: 'end',
          weight: 'bold',
        },
      ],
    },
    { type: 'separator', margin: 'lg', color: '#E5E7EB' },
    {
      type: 'text',
      text: 'ผู้โอน',
      size: 'xxs',
      color: '#9CA3AF',
      margin: 'lg',
    },
    {
      type: 'text',
      text: senderBankName,
      size: 'sm',
      weight: 'bold',
      color: '#1F2937',
      margin: 'sm',
    },
    {
      type: 'text',
      text: senderName,
      size: 'xs',
      color: '#4B5563',
      margin: 'xs',
    },
  ]

  if (senderAccount) {
    bodyContents.push({
      type: 'text',
      text: senderAccount,
      size: 'xxs',
      color: '#9CA3AF',
      margin: 'xs',
    })
  }

  bodyContents.push(
    { type: 'separator', margin: 'lg', color: '#E5E7EB' },
    {
      type: 'text',
      text: 'ผู้รับ',
      size: 'xxs',
      color: '#9CA3AF',
      margin: 'lg',
    },
    {
      type: 'text',
      text: receiverBankName,
      size: 'sm',
      weight: 'bold',
      color: '#1F2937',
      margin: 'sm',
    },
    {
      type: 'text',
      text: receiverName,
      size: 'xs',
      color: '#4B5563',
      margin: 'xs',
    }
  )

  if (receiverAccount) {
    bodyContents.push({
      type: 'text',
      text: receiverAccount,
      size: 'xxs',
      color: '#9CA3AF',
      margin: 'xs',
    })
  }

  if (points > 0) {
    bodyContents.push(
      { type: 'separator', margin: 'lg', color: '#E5E7EB' },
      {
        type: 'box',
        layout: 'vertical',
        margin: 'lg',
        backgroundColor: '#F0FDF4',
        cornerRadius: 'lg',
        paddingAll: 'lg',
        contents: [
          {
            type: 'text',
            text: 'ได้รับแต้มสะสม',
            size: 'xs',
            color: '#059669',
            align: 'center',
          },
          {
            type: 'text',
            text: `+${points} point`,
            size: 'xl',
            weight: 'bold',
            color: '#059669',
            align: 'center',
            margin: 'sm',
          },
          {
            type: 'text',
            text: '(อัตรา 1,000 ฿ = 1 point)',
            size: 'xxs',
            color: '#6B7280',
            align: 'center',
            margin: 'sm',
          },
        ],
      }
    )
  }

  return {
    type: 'bubble',
    size: 'kilo',
    header: {
      type: 'box',
      layout: 'horizontal',
      backgroundColor: '#22C55E',
      paddingAll: 'lg',
      contents: [
        {
          type: 'text',
          text: 'สลิปถูกต้อง',
          size: 'md',
          weight: 'bold',
          color: '#FFFFFF',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'lg',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: 'md',
      contents: [
        {
          type: 'text',
          text: `Ref: ${bdoName}`,
          size: 'xxs',
          color: '#9CA3AF',
          align: 'center',
        },
      ],
    },
    styles: {
      header: { backgroundColor: '#22C55E' },
      footer: { backgroundColor: '#F9FAFB' },
    },
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, verifyData, points, bdoName, customerName } = body

    if (!userId || !verifyData) {
      return NextResponse.json(
        { error: 'userId and verifyData are required' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(userId)
    if (!Number.isFinite(parsedUserId)) {
      return NextResponse.json({ error: 'Invalid userId' }, { status: 400 })
    }

    const user = await prisma.lineUser.findUnique({
      where: { id: parsedUserId },
      select: { id: true, lineUserId: true, lineAccountId: true },
    })

    if (!user?.lineUserId) {
      return NextResponse.json(
        { error: 'ลูกค้านี้ไม่มี LINE User ID' },
        { status: 400 }
      )
    }

    const flexContents = buildSlipVerifyFlex({
      verifyData,
      points: Number(points || 0),
      bdoName: bdoName || 'Slip',
      customerName: customerName || null,
    })

    const safePoints = Number(points || 0)
    const safeAmount = Number(verifyData.amount || 0)
    const altText = `สลิปถูกต้อง ฿${safeAmount.toLocaleString()}${safePoints > 0 ? ` (+${safePoints} แต้ม)` : ''}`

    const sendResult = await sendFlexMessage(
      user.lineUserId,
      altText,
      flexContents,
      user.lineAccountId
    )

    if (!sendResult.success) {
      return NextResponse.json(
        { success: false, error: sendResult.error || 'Failed to send LINE message' },
        { status: 502 }
      )
    }

    const now = new Date()
    const metadata = {
      flexContent: {
        type: 'flex',
        altText,
        contents: flexContents,
      },
      source: 'slip-verify-notify',
      slipVerifyRef: verifyData.transRef || null,
      slipVerifyAmount: safeAmount,
      points: safePoints,
      bdoName: bdoName || 'Slip',
    }

    const message = await prisma.message.create({
      data: {
        userId: parsedUserId,
        lineAccountId: user.lineAccountId,
        direction: 'outgoing',
        messageType: 'flex',
        content: altText,
        metadata: JSON.stringify(metadata),
        sentBy: session.user.id ?? null,
        isRead: true,
        platform: 'line',
        createdAt: now,
        updatedAt: now,
      },
    })

    await prisma.lineUser.update({
      where: { id: parsedUserId },
      data: { lastInteraction: now },
      select: { id: true },
    })

    const responseMessage = {
      id: message.id.toString(),
      userId: parsedUserId.toString(),
      direction: 'outgoing' as const,
      messageType: 'flex',
      content: altText,
      mediaUrl: null,
      metadata,
      replyToId: null,
      replyTo: null,
      createdAt: toUtcIsoString(message.createdAt) || now.toISOString(),
      sentBy: message.sentBy,
      platform: 'line' as const,
    }

    broadcastRealtimeEvent({
      type: 'new_message',
      data: {
        conversationId: parsedUserId.toString(),
        message: responseMessage,
      },
      timestamp: Date.now(),
    })

    await broadcastNewMessage({
      conversationId: parsedUserId.toString(),
      message: responseMessage,
    })

    if (user.lineAccountId) {
      Promise.all([
        cacheInvalidate(`conv:account:${user.lineAccountId}:*`),
        cacheInvalidate(`msg:user:${parsedUserId}:*`),
        cacheInvalidate(`conv:detail:${parsedUserId}`),
      ]).catch(() => null)
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งแจ้งผลตรวจสลิปให้ลูกค้าแล้ว',
      data: {
        inboxMessageId: message.id,
      },
    })
  } catch (error) {
    console.error('[slip-verify-notify] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
