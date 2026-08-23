/**
 * LINE Messaging API - ส่งข้อความไปยัง LINE โดยตรง
 */

import { randomUUID } from 'node:crypto'
import prisma from './prisma'
import { logger } from './logger'

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
 * LINE Flex carousel allows max 12 bubbles per carousel.
 * Defensively cap any carousel contents so user-built or DB-stored flex
 * payloads (templates, broadcasts) never breach the LINE API limit.
 * Returns a new object; does not mutate input.
 */
const LINE_CAROUSEL_BUBBLE_LIMIT = 12

function capFlexCarouselBubbles<T>(node: T): T {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) {
    return node.map((item) => capFlexCarouselBubbles(item)) as unknown as T
  }
  const obj = node as Record<string, any>
  if (
    obj.type === 'carousel' &&
    Array.isArray(obj.contents) &&
    obj.contents.length > LINE_CAROUSEL_BUBBLE_LIMIT
  ) {
    logger.warn('Flex carousel exceeded bubble limit; truncating', {
      scope: 'line-api',
      original: obj.contents.length,
      limit: LINE_CAROUSEL_BUBBLE_LIMIT,
    })
    return {
      ...obj,
      contents: obj.contents
        .slice(0, LINE_CAROUSEL_BUBBLE_LIMIT)
        .map((c: any) => capFlexCarouselBubbles(c)),
    } as unknown as T
  }
  const result: Record<string, any> = {}
  for (const key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      result[key] = capFlexCarouselBubbles(obj[key])
    }
  }
  return result as unknown as T
}

function sanitizeLineMessagePayload<T>(node: T): T {
  const capped = capFlexCarouselBubbles(node)
  return stripUnsupportedFlexFields(capped)
}

function stripUnsupportedFlexFields<T>(node: T): T {
  if (!node || typeof node !== 'object') return node
  if (Array.isArray(node)) {
    return node.map((item) => stripUnsupportedFlexFields(item)) as unknown as T
  }

  const obj = node as Record<string, any>
  const result: Record<string, any> = {}
  for (const key in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, key)) continue
    if (key === 'opacity' || key === 'cornerRadius') {
      logger.warn('Flex payload contained unsupported style field; removing before LINE push', {
        scope: 'line-api',
        field: key,
      })
      continue
    }
    result[key] = stripUnsupportedFlexFields(obj[key])
  }
  return result as unknown as T
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
    logger.error(error, { scope: 'line-api:getChannelAccessToken', lineAccountId })
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
    // - LINE allows max 5 message objects per request
    // - Each Flex carousel allows max 12 bubbles — defensively cap to avoid
    //   "must not be more than 12 items" errors on user/DB-built flex payloads
    const requestBody: any = {
      to: lineUserId,
      messages: messages.slice(0, 5).map((m) => sanitizeLineMessagePayload(m)),
    }

    // Add quoteToken for quote reply if provided
    if (quoteToken && messages.length > 0) {
      // quoteToken applies to the first message only
      requestBody.messages[0] = {
        ...requestBody.messages[0],
        quoteToken,
      }
    }

    const LINE_PUSH_URL = 'https://api.line.me/v2/bot/message/push'
    const LINE_TIMEOUT_MS = 30000

    let response: Response | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await fetch(LINE_PUSH_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(LINE_TIMEOUT_MS),
        })
        break
      } catch (fetchErr: any) {
        const isTimeout =
          fetchErr?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          fetchErr?.name === 'TimeoutError' ||
          String(fetchErr?.message).includes('timeout')
        if (isTimeout && attempt < 2) {
          logger.warn('LINE push timeout — retrying', { scope: 'line-api', attempt })
          continue
        }
        throw fetchErr
      }
    }

    if (!response || !response.ok) {
      const errorData = response ? await response.json().catch(() => ({})) : {}
      logger.error('LINE Push Message error', {
        scope: 'line-api',
        status: response?.status,
        body: errorData,
      })
      return {
        success: false,
        error: response
          ? `LINE API error: ${response.status} - ${(errorData as any).message || response.statusText}`
          : 'LINE API: no response received',
      }
    }

    return { success: true }
  } catch (error) {
    logger.error(error, { scope: 'line-api:pushLineMessage' })
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

/**
 * ส่ง Broadcast ไปยังผู้ติดตามทั้งหมดของ OA ผ่าน LINE Broadcast API
 * (POST /v2/bot/message/broadcast) — ยิงครั้งเดียวถึงเพื่อนทุกคนในแชนแนล
 * จึงไม่ต้องวน push ทีละคน และไม่ชน serverless timeout เมื่อมีผู้รับจำนวนมาก
 *
 * NB: endpoint นี้ไม่คืนค่ารายผู้รับ (LINE ส่งให้เพื่อนทั้งหมดเอง) — ตัวเลข
 * จำนวนผู้รับสำหรับบันทึกลง DB ให้ผู้เรียกนับเองจากฝั่งเรา
 *
 * @param messages - array ของ LINE messages (สูงสุด 5)
 * @param lineAccountId - LINE Account ID
 */
export async function broadcastLineMessage(
  messages: LineMessage[],
  lineAccountId?: number | null
): Promise<SendMessageResult> {
  try {
    const accessToken = await getChannelAccessToken(lineAccountId)

    if (!accessToken) {
      return { success: false, error: 'LINE Channel Access Token not found' }
    }

    const requestBody = {
      messages: messages.slice(0, 5).map((m) => sanitizeLineMessagePayload(m)),
    }

    const LINE_BROADCAST_URL = 'https://api.line.me/v2/bot/message/broadcast'
    const LINE_TIMEOUT_MS = 30000
    // Shared retry key so a timeout-retry is deduped by LINE (avoids double broadcast)
    const retryKey = randomUUID()

    let response: Response | null = null
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        response = await fetch(LINE_BROADCAST_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
            'X-Line-Retry-Key': retryKey,
          },
          body: JSON.stringify(requestBody),
          signal: AbortSignal.timeout(LINE_TIMEOUT_MS),
        })
        break
      } catch (fetchErr: any) {
        const isTimeout =
          fetchErr?.cause?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
          fetchErr?.name === 'TimeoutError' ||
          String(fetchErr?.message).includes('timeout')
        if (isTimeout && attempt < 2) {
          logger.warn('LINE broadcast timeout — retrying', { scope: 'line-api', attempt })
          continue
        }
        throw fetchErr
      }
    }

    if (!response || !response.ok) {
      const errorData = response ? await response.json().catch(() => ({})) : {}
      logger.error('LINE Broadcast Message error', {
        scope: 'line-api',
        status: response?.status,
        body: errorData,
      })
      return {
        success: false,
        error: response
          ? `LINE API error: ${response.status} - ${(errorData as any).message || response.statusText}`
          : 'LINE API: no response received',
      }
    }

    return { success: true }
  } catch (error) {
    logger.error(error, { scope: 'line-api:broadcastLineMessage' })
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
}
