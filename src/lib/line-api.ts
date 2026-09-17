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

/* ────────────────────────────────────────────────────────────
 * OA insight (read-only) — ข้อมูลบัญชี OA สำหรับหน้า /oa-status
 * ใช้ GET ล้วน ไม่แตะ quota ส่งข้อความ
 * ──────────────────────────────────────────────────────────── */

const LINE_API_BASE = 'https://api.line.me/v2/bot'

async function lineGet<T>(path: string, lineAccountId?: number | null): Promise<T> {
  const token = await getChannelAccessToken(lineAccountId)
  if (!token) throw new Error('ไม่พบ LINE Channel Access Token')

  const response = await fetch(`${LINE_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: 'no-store',
  })

  if (!response.ok) {
    const detail = await response.text().catch(() => '')
    throw new Error(`LINE GET ${path} → ${response.status} ${detail.slice(0, 200)}`)
  }

  return (await response.json()) as T
}

export interface OaBotInfo {
  userId: string
  basicId: string
  premiumId?: string
  displayName: string
  pictureUrl?: string
  chatMode: 'chat' | 'bot'
  markAsReadMode: 'auto' | 'manual'
}

export interface OaFollowerInsight {
  status: 'ready' | 'unready' | 'out_of_service'
  followers?: number
  targetedReaches?: number
  blocks?: number
}

export interface OaDemographicInsight {
  available: boolean
  genders?: Array<{ gender: string; percentage: number }>
  ages?: Array<{ age: string; percentage: number }>
  areas?: Array<{ area: string; percentage: number }>
  appTypes?: Array<{ appType: string; percentage: number }>
  subscriptionPeriods?: Array<{ subscriptionPeriod: string; percentage: number }>
}

export interface OaSnapshot {
  account: { id: number | null; name: string | null }
  bot: OaBotInfo | null
  quota: { type: 'none' | 'limited'; limit: number | null; used: number | null; remaining: number | null }
  followers: (OaFollowerInsight & { date: string }) | null
  demographic: OaDemographicInsight | null
  webhook: { endpoint: string | null; active: boolean | null }
  fetchedAt: string
  errors: string[]
}

/** วันที่รูปแบบ yyyyMMdd ตามเวลาไทย ย้อนหลัง n วัน */
function bangkokDateStamp(daysAgo: number): string {
  const target = new Date(Date.now() - daysAgo * 86_400_000)
  return target.toLocaleDateString('en-CA', { timeZone: 'Asia/Bangkok' }).replace(/-/g, '')
}

/**
 * LINE ยังไม่สรุป insight ของวันปัจจุบัน — เริ่มถามจากเมื่อวาน
 * ถ้ายัง unready ถอยอีกวัน (ข้อมูลจริงดีเลย์ไม่แน่นอน ปรับจำนวนวันได้ที่นี่)
 */
async function fetchFollowerInsight(
  lineAccountId?: number | null
): Promise<(OaFollowerInsight & { date: string }) | null> {
  let last: (OaFollowerInsight & { date: string }) | null = null

  for (const daysAgo of [1, 2]) {
    const date = bangkokDateStamp(daysAgo)
    const insight = await lineGet<OaFollowerInsight>(`/insight/followers?date=${date}`, lineAccountId)
    last = { ...insight, date }
    if (insight.status === 'ready') break
  }

  return last
}

/**
 * รวมข้อมูล OA ทั้งหมดในครั้งเดียว
 * ใช้ allSettled — endpoint ไหนพัง (เช่น OA ใหม่ยังไม่มี insight) ที่เหลือยังแสดงได้
 */
export async function getOaSnapshot(lineAccountId?: number | null): Promise<OaSnapshot> {
  const account = await prisma.lineAccount.findFirst({
    where: lineAccountId ? { id: lineAccountId } : { isActive: true },
    orderBy: lineAccountId ? undefined : [{ isDefault: 'desc' }, { id: 'asc' }],
    select: { id: true, name: true },
  })

  const errors: string[] = []
  const settle = <T,>(label: string, result: PromiseSettledResult<T>): T | null => {
    if (result.status === 'fulfilled') return result.value
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
    errors.push(`${label}: ${reason}`)
    return null
  }

  const [botRes, quotaRes, usageRes, followerRes, demoRes, webhookRes] = await Promise.allSettled([
    lineGet<OaBotInfo>('/info', lineAccountId),
    lineGet<{ type: 'none' | 'limited'; value?: number }>('/message/quota', lineAccountId),
    lineGet<{ totalUsage: number }>('/message/quota/consumption', lineAccountId),
    fetchFollowerInsight(lineAccountId),
    lineGet<OaDemographicInsight>('/insight/demographic', lineAccountId),
    lineGet<{ endpoint: string; active: boolean }>('/channel/webhook/endpoint', lineAccountId),
  ])

  const quotaRaw = settle('quota', quotaRes)
  const usageRaw = settle('quota/consumption', usageRes)
  const webhookRaw = settle('webhook', webhookRes)

  const limit = quotaRaw?.type === 'limited' ? quotaRaw.value ?? null : null
  const used = usageRaw?.totalUsage ?? null

  return {
    account: { id: account?.id ?? null, name: account?.name ?? null },
    bot: settle('info', botRes),
    quota: {
      type: quotaRaw?.type ?? 'none',
      limit,
      used,
      remaining: limit === null || used === null ? null : Math.max(0, limit - used),
    },
    followers: settle('insight/followers', followerRes),
    demographic: settle('insight/demographic', demoRes),
    webhook: { endpoint: webhookRaw?.endpoint ?? null, active: webhookRaw?.active ?? null },
    fetchedAt: new Date().toISOString(),
    errors,
  }
}

/* ────────────────────────────────────────────────────────────
 * Insight เชิงลึก + Audience — สำหรับแท็บ Insight / Audience
 * แยกจาก getOaSnapshot เพราะยิงหลายครั้ง (แนวโน้ม 7 วัน) ไม่ควรถ่วงหน้าแรก
 * ──────────────────────────────────────────────────────────── */

export interface OaDeliveryInsight {
  status: 'ready' | 'unready' | 'out_of_service'
  broadcast?: number
  targeting?: number
  autoResponse?: number
  welcomeResponse?: number
  chat?: number
  apiBroadcast?: number
  apiPush?: number
  apiMulticast?: number
  apiNarrowcast?: number
  apiReply?: number
}

export interface OaFollowerPoint {
  date: string
  followers: number | null
  targetedReaches: number | null
  blocks: number | null
}

export interface OaAudienceGroup {
  audienceGroupId: number
  type: string
  description: string
  status: string
  failedType?: string | null
  audienceCount: number
  /** epoch วินาที (ไม่ใช่มิลลิวินาที) */
  created: number
  permission?: string
  isIfaAudience?: boolean
  expireTimestamp?: number | null
}

export interface OaDetail {
  trend: OaFollowerPoint[]
  delivery: (OaDeliveryInsight & { date: string }) | null
  audiences: OaAudienceGroup[]
  audienceTotal: number | null
  audienceAuthority: string | null
  fetchedAt: string
  errors: string[]
}

/** จำนวนวันย้อนหลังของกราฟแนวโน้ม — เพิ่มได้ แต่ยิง LINE 1 ครั้งต่อวัน */
const TREND_DAYS = 7

/** จำนวน audience สูงสุดที่ดึงมาแสดง (LINE จำกัด size สูงสุด 40 ต่อหน้า) */
const AUDIENCE_PAGE_SIZE = 40

export async function getOaDetail(lineAccountId?: number | null): Promise<OaDetail> {
  const errors: string[] = []
  const settle = <T,>(label: string, result: PromiseSettledResult<T>): T | null => {
    if (result.status === 'fulfilled') return result.value
    const reason = result.reason instanceof Error ? result.reason.message : String(result.reason)
    errors.push(`${label}: ${reason}`)
    return null
  }

  // เรียงจากเก่าไปใหม่ เพื่อให้กราฟอ่านจากซ้ายไปขวา
  const trendDates = Array.from({ length: TREND_DAYS }, (_, i) => bangkokDateStamp(i + 1)).reverse()

  const [trendRes, deliveryRes, audienceRes, authorityRes] = await Promise.allSettled([
    Promise.all(
      trendDates.map(async (date): Promise<OaFollowerPoint> => {
        const insight = await lineGet<OaFollowerInsight>(
          `/insight/followers?date=${date}`,
          lineAccountId
        )
        const ready = insight.status === 'ready'
        return {
          date,
          followers: ready ? insight.followers ?? null : null,
          targetedReaches: ready ? insight.targetedReaches ?? null : null,
          blocks: ready ? insight.blocks ?? null : null,
        }
      })
    ),
    (async (): Promise<(OaDeliveryInsight & { date: string }) | null> => {
      // เหมือน followers — LINE ยังไม่สรุปของวันนี้ ถอยไปอีกวันถ้ายัง unready
      let last: (OaDeliveryInsight & { date: string }) | null = null
      for (const daysAgo of [1, 2]) {
        const date = bangkokDateStamp(daysAgo)
        const insight = await lineGet<OaDeliveryInsight>(
          `/insight/message/delivery?date=${date}`,
          lineAccountId
        )
        last = { ...insight, date }
        if (insight.status === 'ready') break
      }
      return last
    })(),
    lineGet<{ audienceGroups?: OaAudienceGroup[]; totalCount?: number }>(
      `/audienceGroup/list?page=1&size=${AUDIENCE_PAGE_SIZE}`,
      lineAccountId
    ),
    lineGet<{ authorityLevel: string }>('/audienceGroup/authorityLevel', lineAccountId),
  ])

  const audienceRaw = settle('audienceGroup/list', audienceRes)

  return {
    trend: settle('insight/followers (แนวโน้ม)', trendRes) ?? [],
    delivery: settle('insight/message/delivery', deliveryRes),
    audiences: audienceRaw?.audienceGroups ?? [],
    audienceTotal: audienceRaw?.totalCount ?? null,
    audienceAuthority: settle('audienceGroup/authorityLevel', authorityRes)?.authorityLevel ?? null,
    fetchedAt: new Date().toISOString(),
    errors,
  }
}
