/**
 * LINE Messaging API - ส่งข้อความไปยัง LINE โดยตรง
 */

import prisma from './prisma'

interface LineMessage {
  type: string
  text?: string
  originalContentUrl?: string
  previewImageUrl?: string
  [key: string]: any
}

interface SendMessageResult {
  success: boolean
  error?: string
}

/**
 * ดึง LINE Channel Access Token จากฐานข้อมูล
 */
async function getChannelAccessToken(lineAccountId?: number | null): Promise<string | null> {
  try {
    // ถ้ามี lineAccountId ให้ดึงจาก account นั้น
    if (lineAccountId) {
      const account = await prisma.lineAccount.findUnique({
        where: { id: lineAccountId },
        select: { channelAccessToken: true },
      })
      if (account?.channelAccessToken) {
        return account.channelAccessToken
      }
    }

    // Fallback: ดึงจาก default account หรือ account แรก
    const defaultAccount = await prisma.lineAccount.findFirst({
      where: { isActive: true },
      orderBy: [{ isDefault: 'desc' }, { id: 'asc' }],
      select: { channelAccessToken: true },
    })

    return defaultAccount?.channelAccessToken || null
  } catch (error) {
    console.error('Failed to get LINE channel access token:', error)
    return null
  }
}

/**
 * ส่งข้อความไปยัง LINE ผ่าน Push Message API
 * @param lineUserId - LINE User ID ของผู้รับ
 * @param messages - array ของ LINE messages
 * @param lineAccountId - LINE Account ID (optional)
 * @param quoteToken - Quote Token สำหรับ quote reply (optional)
 */
export async function pushLineMessage(
  lineUserId: string,
  messages: LineMessage[],
  lineAccountId?: number | null,
  quoteToken?: string | null
): Promise<SendMessageResult> {
  try {
    const accessToken = await getChannelAccessToken(lineAccountId)
    
    if (!accessToken) {
      return {
        success: false,
        error: 'LINE Channel Access Token not found',
      }
    }

    // Prepare request body
    const requestBody: any = {
      to: lineUserId,
      messages: messages.slice(0, 5), // LINE allows max 5 messages per request
    }

    // Add quoteToken for quote reply if provided
    if (quoteToken && messages.length > 0) {
      // quoteToken applies to the first message only
      requestBody.messages[0] = {
        ...requestBody.messages[0],
        quoteToken,
      }
    }

    const response = await fetch('https://api.line.me/v2/bot/message/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${accessToken}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      console.error('LINE Push Message error:', response.status, errorData)
      return {
        success: false,
        error: `LINE API error: ${response.status} - ${errorData.message || response.statusText}`,
      }
    }

    return { success: true }
  } catch (error) {
    console.error('LINE Push Message error:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}

/**
 * ส่ง text message ไปยัง LINE
 * @param lineUserId - LINE User ID
 * @param text - ข้อความที่จะส่ง
 * @param lineAccountId - LINE Account ID (optional)
 * @param quoteToken - Quote Token สำหรับ quote reply (optional)
 */
export async function sendTextMessage(
  lineUserId: string,
  text: string,
  lineAccountId?: number | null,
  quoteToken?: string | null
): Promise<SendMessageResult> {
  return pushLineMessage(lineUserId, [{ type: 'text', text }], lineAccountId, quoteToken)
}

/**
 * ส่ง image message ไปยัง LINE
 */
export async function sendImageMessage(
  lineUserId: string,
  imageUrl: string,
  lineAccountId?: number | null
): Promise<SendMessageResult> {
  return pushLineMessage(
    lineUserId,
    [{
      type: 'image',
      originalContentUrl: imageUrl,
      previewImageUrl: imageUrl,
    }],
    lineAccountId
  )
}

/**
 * ส่ง file message ไปยัง LINE
 */
export async function sendFileMessage(
  lineUserId: string,
  fileUrl: string,
  fileName: string,
  lineAccountId?: number | null
): Promise<SendMessageResult> {
  // LINE API requires HTTPS URL for files
  if (!fileUrl.startsWith('https://')) {
    return {
      success: false,
      error: 'File URL must be HTTPS. LINE API requires secure URLs for file messages.',
    }
  }

  return pushLineMessage(
    lineUserId,
    [{
      type: 'file',
      fileName: fileName,
      fileUrl: fileUrl,
    }],
    lineAccountId
  )
}

/**
 * ส่ง Flex message ไปยัง LINE
 */
export async function sendFlexMessage(
  lineUserId: string,
  altText: string,
  contents: any,
  lineAccountId?: number | null
): Promise<SendMessageResult> {
  return pushLineMessage(
    lineUserId,
    [{
      type: 'flex',
      altText,
      contents,
    }],
    lineAccountId
  )
}

/**
 * ส่งข้อความตาม type (compatible กับ PHP bridge interface)
 * @param params.userId - LINE User ID
 * @param params.message - ข้อความหรือ JSON content
 * @param params.type - ประเภทข้อความ (text, image, flex)
 * @param params.lineAccountId - LINE Account ID (optional)
 * @param params.quoteToken - Quote Token สำหรับ quote reply (optional)
 */
export async function sendLineMessage(params: {
  userId: string // LINE User ID
  message: string
  type?: string
  lineAccountId?: number | null
  quoteToken?: string | null
}): Promise<SendMessageResult> {
  const { userId, message, type = 'text', lineAccountId, quoteToken } = params

  // ถ้า message เป็น JSON (เช่น flex message)
  if (type === 'image') {
    try {
      const parsed = JSON.parse(message)
      if (parsed.type === 'image' && parsed.originalContentUrl) {
        return sendImageMessage(userId, parsed.originalContentUrl, lineAccountId)
      }
    } catch {
      // ไม่ใช่ JSON - ใช้ message เป็น URL โดยตรง
      return sendImageMessage(userId, message, lineAccountId)
    }
  }

  if (type === 'flex') {
    try {
      const parsed = JSON.parse(message)
      if (parsed.type === 'flex' && parsed.contents) {
        return sendFlexMessage(userId, parsed.altText || 'Message', parsed.contents, lineAccountId)
      }
    } catch {
      // ไม่สามารถ parse ได้ - ส่งเป็น text
    }
  }

  // Default: ส่งเป็น text message (with optional quoteToken for quote reply)
  return sendTextMessage(userId, message, lineAccountId, quoteToken)
}
