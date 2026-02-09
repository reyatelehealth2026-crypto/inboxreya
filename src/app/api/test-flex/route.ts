import { NextRequest, NextResponse } from 'next/server'

/**
 * Test endpoint to debug Flex Message sending
 * GET /api/test-flex?userId=15
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams
    const userId = searchParams.get('userId')
    
    if (!userId) {
      return NextResponse.json({ error: 'userId required' }, { status: 400 })
    }

    const phpBridgeUrl = process.env.PHP_API_URL 
      ? `${process.env.PHP_API_URL}/api/liff-bridge.php`
      : 'http://localhost/re-ya/api/liff-bridge.php'
    
    console.log('Testing Flex Message send to userId:', userId)
    console.log('PHP Bridge URL:', phpBridgeUrl)
    
    // Simple test Flex Message
    const flexMessage = {
      type: 'flex',
      altText: 'ทดสอบ Flex Message',
      contents: {
        type: 'bubble',
        body: {
          type: 'box',
          layout: 'vertical',
          contents: [
            {
              type: 'text',
              text: 'ทดสอบส่ง Flex Message',
              weight: 'bold',
              size: 'lg',
            },
            {
              type: 'text',
              text: 'ถ้าเห็นข้อความนี้แสดงว่าระบบทำงานปกติ',
              size: 'sm',
              wrap: true,
              margin: 'md',
            },
          ],
        },
      },
    }

    const requestBody = {
      action: 'send_flex_message',
      line_user_id: 'Ub0e0e0e0e0e0e0e0e0e0e0e0e0e0e0e0', // Placeholder - will be replaced
      line_account_id: 3,
      data: {
        flexMessage: flexMessage,
      },
    }
    
    console.log('Request body:', JSON.stringify(requestBody, null, 2))
    
    const response = await fetch(phpBridgeUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': process.env.INTERNAL_API_SECRET || '',
      },
      body: JSON.stringify(requestBody),
    })

    const responseText = await response.text()
    console.log('PHP Response status:', response.status)
    console.log('PHP Response body:', responseText)

    let responseData
    try {
      responseData = JSON.parse(responseText)
    } catch (e) {
      responseData = { raw: responseText }
    }

    return NextResponse.json({
      success: response.ok,
      phpStatus: response.status,
      phpResponse: responseData,
      requestSent: requestBody,
    })
  } catch (error) {
    console.error('Test error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
