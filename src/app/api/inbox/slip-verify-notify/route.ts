import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { sendFlexMessage } from '@/lib/line-api'

/**
 * POST /api/inbox/slip-verify-notify
 *
 * Build a Flex message with slip verification result + points info
 * and send it to the customer's LINE.
 *
 * Body (JSON):
 *   userId       – DB user ID (internal)
 *   verifyData   – SlipMate verification result data
 *   points       – earned points (number)
 *   bdoName      – BDO reference name
 *   customerName – customer display name (optional)
 */

// Bank code → Thai name + brand color
const BANK_MAP: Record<string, { name: string; color: string }> = {
  '014': { name: 'ธนาคารไทยพาณิชย์', color: '#4E2A82' },
  '004': { name: 'ธนาคารกสิกรไทย', color: '#138F2D' },
  '002': { name: 'ธนาคารกรุงเทพ', color: '#1E4598' },
  '006': { name: 'ธนาคารกรุงไทย', color: '#1BA5E0' },
  '025': { name: 'ธนาคารกรุงศรีอยุธยา', color: '#FEC43B' },
  '011': { name: 'ธนาคารทหารไทยธนชาต', color: '#1279BE' },
  '030': { name: 'ธนาคารออมสิน', color: '#EB198D' },
  '034': { name: 'ธนาคารเพื่อการเกษตร', color: '#4B9B1D' },
}

function getBankName(code: string | undefined, fallbackName: string | undefined): string {
  if (code && BANK_MAP[code]) return BANK_MAP[code].name
  return fallbackName || 'ธนาคาร'
}

function buildSlipVerifyFlex(params: {
  verifyData: any
  points: number
  bdoName: string
  customerName: string | null
}) {
  const { verifyData: d, points, bdoName, customerName } = params

  const senderBankName = getBankName(d.sendingBank, d.sendingBankName)
  const receiverBankName = getBankName(d.receivingBank, d.receivingBankName)
  const senderName = d.sender?.displayName || d.sender?.name || '-'
  const senderAccount = d.sender?.account?.value || ''
  const receiverName = d.receiver?.displayName || d.receiver?.name || '-'
  const receiverAccount = d.receiver?.account?.value || ''
  const amount = d.amount || 0
  const amountStr = `฿${amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`

  // Format date
  let dateTimeStr = ''
  if (d.transDate) {
    try {
      const parsed = new Date(d.transDate)
      if (!isNaN(parsed.getTime())) {
        dateTimeStr = parsed.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })
      } else {
        dateTimeStr = d.transDate
      }
    } catch {
      dateTimeStr = d.transDate
    }
    if (d.transTime) dateTimeStr += `, ${d.transTime}`
  }

  // Build body contents
  const bodyContents: any[] = [
    // Amount
    {
      type: 'text',
      text: amountStr,
      size: '3xl',
      weight: 'bold',
      align: 'center',
      color: '#111827',
    },
    // Date-time
    {
      type: 'box',
      layout: 'horizontal',
      margin: 'md',
      contents: [
        { type: 'text', text: 'วันที่-เวลา', size: 'xs', color: '#6B7280', flex: 0 },
        { type: 'text', text: dateTimeStr || '-', size: 'xs', color: '#374151', align: 'end', weight: 'bold' },
      ],
    },
    { type: 'separator', margin: 'lg', color: '#E5E7EB' },
    // Sender info
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
    // Receiver info
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
    },
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

  // Points section (if earned)
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
            text: '🎉 ได้รับแต้มสะสม',
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
            text: `(อัตรา 1,000 ฿ = 1 point)`,
            size: 'xxs',
            color: '#6B7280',
            align: 'center',
            margin: 'sm',
          },
        ],
      }
    )
  }

  const bubble = {
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
          text: '✅ สลิปถูกต้อง',
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

  return bubble
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

    // Look up user to get lineUserId
    const user = await prisma.lineUser.findUnique({
      where: { id: parsedUserId },
      select: { lineUserId: true, lineAccountId: true },
    })

    if (!user?.lineUserId) {
      return NextResponse.json(
        { error: 'ลูกค้านี้ไม่มี LINE User ID' },
        { status: 400 }
      )
    }

    // Build Flex message
    const flexContents = buildSlipVerifyFlex({
      verifyData,
      points: points || 0,
      bdoName: bdoName || 'Slip',
      customerName: customerName || null,
    })

    const altText = `✅ สลิปถูกต้อง ฿${(verifyData.amount || 0).toLocaleString()}${points > 0 ? ` (+${points} แต้ม)` : ''}`

    // Send via LINE
    const result = await sendFlexMessage(
      user.lineUserId,
      altText,
      flexContents,
      user.lineAccountId
    )

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error || 'Failed to send LINE message' },
        { status: 502 }
      )
    }

    return NextResponse.json({
      success: true,
      message: 'ส่งแจ้งเตือนผลตรวจสลิปให้ลูกค้าแล้ว',
    })
  } catch (error) {
    console.error('[slip-verify-notify] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
