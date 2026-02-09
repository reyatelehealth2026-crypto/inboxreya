import { NextRequest, NextResponse } from 'next/server'
import { withAuth } from '@/lib/auth-middleware'
import prisma from '@/lib/prisma'

/**
 * POST /api/inbox/customers/[id]/points/add
 * Add points to customer and send Flex Message notification
 */
export const POST = withAuth(async (request: NextRequest, { params, user }) => {
  try {
    // In Next.js 15, params might be a Promise
    const resolvedParams = await Promise.resolve(params)
    const userId = Number(resolvedParams.id)
    
    console.log('[Points Add] Starting - userId:', userId, 'adminId:', user.id)
    
    if (!Number.isFinite(userId)) {
      console.error('[Points Add] Invalid user ID:', resolvedParams.id)
      return NextResponse.json({ error: 'Invalid user ID' }, { status: 400 })
    }

    const body = await request.json()
    const { points, reason } = body
    
    console.log('[Points Add] Request body:', { points, reason })

    if (!points || points <= 0) {
      console.error('[Points Add] Invalid points value:', points)
      return NextResponse.json({ error: 'Points must be greater than 0' }, { status: 400 })
    }

    if (points > 10000) {
      console.error('[Points Add] Points value exceeds maximum limit:', points)
      return NextResponse.json({ error: 'Points must not exceed 10,000' }, { status: 400 })
    }

    // Get user info
    console.log('[Points Add] Fetching user from database...')
    const lineUser = await prisma.lineUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        lineUserId: true,
        displayName: true,
        pictureUrl: true,
        points: true,
        lineAccountId: true,
      },
    })

    if (!lineUser) {
      console.error('[Points Add] User not found:', userId)
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }
    
    console.log('[Points Add] User found:', lineUser.displayName, 'Current points:', lineUser.points)

    // Update points
    console.log('[Points Add] Updating user points...')
    const updatedUser = await prisma.lineUser.update({
      where: { id: userId },
      data: {
        points: {
          increment: points,
        },
      },
      select: {
        id: true,
        points: true,
      },
    })
    
    console.log('[Points Add] Points updated. New balance:', updatedUser.points)

    // Create points transaction
    console.log('[Points Add] Creating points transaction...')
    await prisma.points_transactions.create({
      data: {
        user_id: userId,
        points: points,
        type: 'earn',
        balance_after: updatedUser.points,
        reference_type: 'admin_add',
        reference_id: Number(user.id),
        description: reason || 'เพิ่มแต้มโดยแอดมิน',
        line_account_id: lineUser.lineAccountId || 3,
      },
    })
    
    console.log('[Points Add] Transaction created successfully')    
    console.log('[Points Add] Transaction created successfully')

    // Create system message in chat
    console.log('[Points Add] Creating system message in chat...')
    await prisma.message.create({
      data: {
        userId: userId,
        lineAccountId: lineUser.lineAccountId || 3,
        direction: 'outgoing',
        messageType: 'text',
        content: `🎁 เพิ่มแต้ม ${points} แต้มให้ลูกค้า\n${reason ? `เหตุผล: ${reason}` : ''}\nแต้มคงเหลือ: ${updatedUser.points} แต้ม`,
        sentBy: `admin_${user.id}`,
        isRead: true,
      },
    })
    console.log('[Points Add] System message created')

    // Send Flex Message to customer
    console.log('[Points Add] Preparing Flex Message...')
    const flexMessage = {
      type: 'flex',
      altText: `🎁 คุณได้รับแต้ม ${points} แต้ม!`,
      contents: {
        type: 'bubble',
        size: 'kilo',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'box',
                      layout: 'vertical',
                      contents: [
                        {
                          type: 'image',
                          url: lineUser.pictureUrl || 'https://profile.line-scdn.net/0hLhff-3aQE0dbHwxJqYdsEGdaHSosMRUPI3EPJ39PTCBze1BDZC1Zc3ofGiUiLlcUZHgIJS0cTSV-',
                          aspectMode: 'cover',
                          aspectRatio: '1:1',
                          size: 'full',
                        },
                      ],
                      width: '64px',
                      height: '64px',
                      cornerRadius: '32px',
                    },
                    {
                      type: 'box',
                      layout: 'vertical',
                      contents: [
                        {
                          type: 'text',
                          text: lineUser.displayName || 'ลูกค้า',
                          weight: 'bold',
                          size: 'md',
                          color: '#1A1A1A',
                          wrap: true,
                        },
                        {
                          type: 'text',
                          text: `ID: ${lineUser.id}`,
                          size: 'xs',
                          color: '#999999',
                          margin: 'xs',
                        },
                      ],
                      margin: 'md',
                      justifyContent: 'center',
                    },
                  ],
                  paddingAll: '16px',
                  backgroundColor: '#FFFFFF',
                  cornerRadius: '12px',
                  borderWidth: '2px',
                  borderColor: '#0C665D',
                },
              ],
              paddingAll: '0px',
              margin: 'none',
            },
            {
              type: 'text',
              text: 'คุณได้รับแต้มสะสม',
              size: 'sm',
              color: '#666666',
              margin: 'xl',
              align: 'center',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'text',
                  text: `+${points}`,
                  size: '4xl',
                  weight: 'bold',
                  color: '#0C665D',
                  align: 'center',
                },
                {
                  type: 'text',
                  text: 'แต้ม',
                  size: 'md',
                  color: '#0C665D',
                  align: 'center',
                  weight: 'bold',
                  margin: 'xs',
                },
              ],
              margin: 'lg',
              paddingAll: '24px',
              backgroundColor: '#F0F9F8',
              cornerRadius: '16px',
            },
            {
              type: 'box',
              layout: 'vertical',
              contents: [
                {
                  type: 'box',
                  layout: 'horizontal',
                  contents: [
                    {
                      type: 'text',
                      text: 'แต้มคงเหลือ',
                      size: 'sm',
                      color: '#666666',
                      flex: 0,
                    },
                    {
                      type: 'text',
                      text: `${updatedUser.points} แต้ม`,
                      size: 'md',
                      color: '#0C665D',
                      weight: 'bold',
                      align: 'end',
                    },
                  ],
                },
              ],
              margin: 'xl',
              paddingAll: '16px',
              backgroundColor: '#FFFFFF',
              cornerRadius: '12px',
              borderWidth: '1px',
              borderColor: '#E5E5E5',
            },
            {
              type: 'text',
              text: reason || 'ขอบคุณ',
              size: 'sm',
              color: '#999999',
              margin: 'xl',
              wrap: true,
              align: 'center',
            },
          ],
          paddingAll: '20px',
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'button',
              action: {
                type: 'uri',
                label: 'เข้าสู่เมนูแลกพอยท์',
                uri: 'https://liff.line.me/2008876929-yRgjH7fX',
              },
              style: 'primary',
              color: '#0C665D',
              height: 'sm',
            },
          ],
          paddingAll: '20px',
        },
      },
    }

    // Send via PHP bridge
    console.log('[Points Add] Sending Flex Message via PHP bridge...')
    const phpBridgeUrl = process.env.PHP_API_URL 
      ? `${process.env.PHP_API_URL}/api/liff-bridge.php`
      : 'http://localhost/re-ya/api/liff-bridge.php'
    
    console.log('[Points Add] PHP Bridge URL:', phpBridgeUrl)
    
    const response = await fetch(phpBridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify({
        action: 'send_flex_message',
        line_user_id: lineUser.lineUserId,
        lineUserId: lineUser.lineUserId,
        line_account_id: lineUser.lineAccountId || 3,
        lineAccountId: lineUser.lineAccountId || 3,
        data: {
          flexMessage: flexMessage,
        },
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('[Points Add] Failed to send Flex Message:', response.status, errorText)
    } else {
      console.log('[Points Add] Flex Message sent successfully')
    }

    console.log('[Points Add] Success! Returning response')
    return NextResponse.json({
      success: true,
      data: {
        newPoints: updatedUser.points,
        addedPoints: points,
      },
    })
  } catch (error) {
    console.error('[Points Add] Error:', error)
    console.error('[Points Add] Error stack:', error instanceof Error ? error.stack : 'No stack')
    return NextResponse.json(
      { error: 'Failed to add points', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
})
