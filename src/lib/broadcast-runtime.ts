import prisma from '@/lib/prisma'
import { pushLineMessage, broadcastLineMessage } from '@/lib/line-api'

export type BroadcastMessageType = 'text' | 'image' | 'video' | 'flex' | 'multi'

type LinePayloadMessage = Record<string, unknown>

type BroadcastTarget =
  | { mode: 'all' }
  | { mode: 'manual'; customerIds: number[] }
  | { mode: 'segment'; segmentId: number }
  | { mode: 'tags'; tagIds: number[] }

export interface BroadcastEnvelopeV2 {
  version: 2
  kind: 'composer_broadcast'
  summaryText: string
  messageType: BroadcastMessageType
  messages: LinePayloadMessage[]
  target: BroadcastTarget
  template?: {
    id?: number
    sourceTable?: 'quick_reply_templates' | 'flex_templates' | 'templates'
  }
}

function sanitizeFlexActionUris(obj: any, path = ''): any {
  if (!obj || typeof obj !== 'object') return obj

  // Handle arrays
  if (Array.isArray(obj)) {
    return obj.map((item, index) => sanitizeFlexActionUris(item, `${path}[${index}]`))
  }

  // Handle LINE action objects - type: 'uri' has a uri property
  if (obj.type === 'uri' && obj.uri !== undefined) {
    if (typeof obj.uri !== 'string' || !obj.uri.trim()) {
      // Invalid or empty URI, set to null
      console.warn(`[sanitizeFlexActionUris] Empty or non-string URI at ${path}:`, obj.uri)
      return { ...obj, uri: null }
    }
    const uri = obj.uri.trim()
    if (!uri.startsWith('http://') && !uri.startsWith('https://')) {
      // Invalid URI, set to null to prevent LINE API error
      console.warn(`[sanitizeFlexActionUris] Invalid URI at ${path}:`, uri)
      return { ...obj, uri: null }
    }
    console.log(`[sanitizeFlexActionUris] Valid URI at ${path}:`, uri)
  }

  // Handle action objects with label and uri (message/uri actions)
  if (obj.action && typeof obj.action === 'object') {
    const sanitized = sanitizeFlexActionUris(obj.action, `${path}.action`)
    return { ...obj, action: sanitized }
  }

  // Recursively sanitize nested objects
  const result: any = {}
  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      result[key] = sanitizeFlexActionUris(obj[key], `${path}.${key}`)
    }
  }

  return result
}

export function normalizeFlexMessagePayload(input: unknown, fallbackAltText = 'Flex Message') {
  if (!input) return null

  const parsed = typeof input === 'string' ? JSON.parse(input) : input
  if (!parsed || typeof parsed !== 'object') return null

  const flex = parsed as Record<string, any>

  // Sanitize action URIs to prevent "Invalid action URI" errors
  const sanitized = sanitizeFlexActionUris(flex)

  if (sanitized.type === 'flex' && sanitized.contents) {
    return {
      type: 'flex',
      altText: sanitized.altText || fallbackAltText,
      contents: sanitized.contents,
    }
  }

  if (sanitized.type === 'bubble' || sanitized.type === 'carousel') {
    return {
      type: 'flex',
      altText: fallbackAltText,
      contents: sanitized,
    }
  }

  if (sanitized.contents && (sanitized.contents.type === 'bubble' || sanitized.contents.type === 'carousel')) {
    return {
      type: 'flex',
      altText: sanitized.altText || fallbackAltText,
      contents: sanitized.contents,
    }
  }

  return null
}

export function buildBroadcastMessages(input: {
  content?: string
  mediaUrl?: string
  messageType?: BroadcastMessageType | 'video'
  flexContent?: unknown
  flexContents?: unknown[]
}) {
  const content = input.content?.trim() || ''
  const flexContentsArray = Array.isArray(input.flexContents) ? input.flexContents : null
  const hasMultipleFlex = !!flexContentsArray && flexContentsArray.length > 0
  const type = input.messageType || (hasMultipleFlex || input.flexContent ? 'flex' : input.mediaUrl ? 'image' : 'text')

  if (type === 'flex') {
    const sources = hasMultipleFlex ? flexContentsArray! : [input.flexContent]
    const flexMessages = sources.map((src, idx) => {
      const fallback = content || `Flex Message ${idx + 1}`
      const flex = normalizeFlexMessagePayload(src, fallback)
      if (!flex) throw new Error(`Invalid flexContent payload at index ${idx}`)
      return flex
    })
    if (flexMessages.length === 0) throw new Error('Invalid flexContent payload')
    if (flexMessages.length > 5) throw new Error('Cannot send more than 5 flex messages in one broadcast')
    return {
      summaryText: content || flexMessages[0].altText || 'Flex Message',
      messageType: flexMessages.length > 1 ? 'multi' as const : 'flex' as const,
      messages: flexMessages,
    }
  }

  if (type === 'image') {
    if (!input.mediaUrl) throw new Error('Image broadcast requires mediaUrl')
    return {
      summaryText: content || 'Image broadcast',
      messageType: 'image' as const,
      messages: [{
        type: 'image',
        originalContentUrl: input.mediaUrl,
        previewImageUrl: input.mediaUrl,
      }],
    }
  }

  if (type === 'video') {
    if (!input.mediaUrl) throw new Error('Video broadcast requires mediaUrl')
    return {
      summaryText: content || 'Video broadcast',
      messageType: 'video' as const,
      messages: [{
        type: 'video',
        originalContentUrl: input.mediaUrl,
        // NOTE: ideally previewImageUrl should be an image URL; we fall back to mediaUrl until a dedicated thumbnail field exists.
        previewImageUrl: input.mediaUrl,
      }],
    }
  }

  if (!content) throw new Error('Text broadcast requires content')
  return {
    summaryText: content,
    messageType: 'text' as const,
    messages: [{ type: 'text', text: content }],
  }
}

export function buildBroadcastEnvelope(input: {
  content?: string
  mediaUrl?: string
  messageType?: BroadcastMessageType | 'video'
  flexContent?: unknown
  flexContents?: unknown[]
  templateId?: number
  templateSourceTable?: 'quick_reply_templates' | 'flex_templates' | 'templates'
  targetSegmentId?: number
  targetCustomerIds?: number[]
  targetTagIds?: number[]
}): BroadcastEnvelopeV2 {
  const built = buildBroadcastMessages(input)
  const target: BroadcastTarget = input.targetTagIds && input.targetTagIds.length > 0
    ? { mode: 'tags', tagIds: input.targetTagIds }
    : input.targetSegmentId
    ? { mode: 'segment', segmentId: input.targetSegmentId }
    : input.targetCustomerIds && input.targetCustomerIds.length > 0
    ? { mode: 'manual', customerIds: input.targetCustomerIds }
    : { mode: 'all' }

  return {
    version: 2,
    kind: 'composer_broadcast',
    summaryText: built.summaryText,
    messageType: built.messageType,
    messages: built.messages,
    target,
    template: input.templateId || input.templateSourceTable
      ? {
          id: input.templateId,
          sourceTable: input.templateSourceTable,
        }
      : undefined,
  }
}

export function parseStoredBroadcast(content: string, mediaUrl?: string | null) {
  try {
    const parsed = JSON.parse(content)

    if (
      parsed &&
      typeof parsed === 'object' &&
      parsed.version === 2 &&
      parsed.kind === 'composer_broadcast' &&
      Array.isArray(parsed.messages)
    ) {
      const envelope = parsed as BroadcastEnvelopeV2
      return {
        kind: 'v2' as const,
        summaryText: envelope.summaryText,
        messageType: envelope.messageType,
        messages: envelope.messages,
        target: envelope.target,
        raw: envelope,
      }
    }

    if (parsed && typeof parsed === 'object' && Array.isArray(parsed.messages) && Array.isArray(parsed.tagIds)) {
      const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : 'โปรโมชั่น'
      const messages = parsed.messages as LinePayloadMessage[]
      const firstType = typeof messages[0]?.type === 'string' ? messages[0].type : 'multi'
      const messageType = firstType === 'flex' ? 'flex' : firstType === 'image' ? 'image' : firstType === 'video' ? 'video' : messages.length > 1 ? 'multi' : 'text'
      return {
        kind: 'legacy-tags' as const,
        summaryText: title,
        messageType,
        messages,
        target: { mode: 'tags', tagIds: parsed.tagIds as number[] } as BroadcastTarget,
        raw: parsed,
      }
    }
  } catch {
    // fall through to legacy plain-text/media path
  }

  const built = buildBroadcastMessages({
    content,
    mediaUrl: mediaUrl || undefined,
    messageType: mediaUrl ? (content.includes('[video') ? 'video' : 'image') : 'text',
  })

  return {
    kind: 'legacy-plain' as const,
    summaryText: built.summaryText,
    messageType: built.messageType,
    messages: built.messages,
    target: { mode: 'all' } as BroadcastTarget,
    raw: null,
  }
}

async function resolveManualTargetUsers(lineAccountId: number, customerIds: number[]) {
  if (customerIds.length === 0) return []
  const users = await prisma.lineUser.findMany({
    where: {
      lineAccountId,
      id: { in: customerIds },
      lineUserId: { not: '' },
    },
    select: { id: true, lineUserId: true, lineAccountId: true },
  })
  return users.filter((u) => !!u.lineUserId)
}

async function resolveManualTargetUsersFromJoinTable(lineAccountId: number, broadcastId: number) {
  const rows = await prisma.$queryRaw<Array<{ user_id: number }>>`
    SELECT user_id FROM broadcast_recipients WHERE broadcast_id = ${broadcastId}
  `
  const customerIds = rows.map((row) => Number(row.user_id)).filter(Boolean)
  return resolveManualTargetUsers(lineAccountId, customerIds)
}

async function resolveTagTargetUsers(lineAccountId: number, tagIds: number[]) {
  if (tagIds.length === 0) return []
  const assignments = await prisma.userTagAssignment.findMany({
    where: {
      tagId: { in: tagIds },
      user: { lineAccountId },
    },
    select: {
      userId: true,
      user: { select: { lineUserId: true, lineAccountId: true } },
    },
    distinct: ['userId'],
  })

  return assignments
    .map((assignment) => assignment.user)
    .filter((user): user is { lineUserId: string; lineAccountId: number | null } => Boolean(user?.lineUserId))
}

async function resolveAllTargetUsers(lineAccountId: number) {
  const users = await prisma.lineUser.findMany({
    where: {
      lineAccountId,
      lineUserId: { not: '' },
      isBlocked: false,
    },
    select: { lineUserId: true, lineAccountId: true },
  })
  return users.filter((u) => !!u.lineUserId)
}

export async function resolveBroadcastTargetUsers(params: {
  broadcastId: number
  lineAccountId: number
  target: BroadcastTarget
}) {
  const { broadcastId, lineAccountId, target } = params

  if (target.mode === 'manual') {
    const direct = await resolveManualTargetUsers(lineAccountId, target.customerIds)
    if (direct.length > 0) return direct
    return resolveManualTargetUsersFromJoinTable(lineAccountId, broadcastId)
  }

  if (target.mode === 'tags') {
    return resolveTagTargetUsers(lineAccountId, target.tagIds)
  }

  if (target.mode === 'segment') {
    throw new Error('Segment broadcast sending is not implemented yet')
  }

  return resolveAllTargetUsers(lineAccountId)
}

export async function sendBroadcastRecord(broadcast: {
  id: number
  lineAccountId: number | null
  content: string
  mediaUrl?: string | null
}, onProgress?: (sent: number, success: number, failed: number, total: number) => void) {
  if (!broadcast.lineAccountId) {
    throw new Error('Broadcast is missing lineAccountId')
  }

  const parsed = parseStoredBroadcast(broadcast.content, broadcast.mediaUrl)
  if (!parsed.messages || parsed.messages.length === 0) {
    throw new Error('Broadcast has no LINE messages to send')
  }

  // Target = ALL followers → use LINE's native broadcast endpoint (one API call to
  // every friend of the OA). Sending to the whole audience via per-user push loops
  // would blow past the serverless function timeout and leave the record stuck
  // mid-send (status never advances past 'draft'/'sending').
  if (parsed.target.mode === 'all') {
    // LINE broadcast does not report per-recipient delivery; use our follower count
    // (mirrors resolveAllTargetUsers eligibility) for the record.
    const total = await prisma.lineUser.count({
      where: {
        lineAccountId: broadcast.lineAccountId,
        lineUserId: { not: '' },
        isBlocked: false,
      },
    })
    // Fail fast on a misconfigured/unsynced account instead of firing a broadcast
    // that would be recorded as "sent to 0 recipients" (parity with the push path).
    if (total === 0) {
      throw new Error('No target users found for this broadcast')
    }
    const result = await broadcastLineMessage(
      parsed.messages as Parameters<typeof broadcastLineMessage>[0],
      broadcast.lineAccountId
    )
    onProgress?.(total, result.success ? total : 0, result.success ? 0 : total, total)
    return {
      summaryText: parsed.summaryText,
      messageType: parsed.messageType,
      totalRecipients: total,
      successCount: result.success ? total : 0,
      failCount: result.success ? 0 : total,
      errors: result.success ? [] : [result.error ?? 'LINE broadcast failed'],
      finalStatus: (result.success ? 'sent' : 'failed') as 'sent' | 'failed',
    }
  }

  const targetUsers = await resolveBroadcastTargetUsers({
    broadcastId: broadcast.id,
    lineAccountId: broadcast.lineAccountId,
    target: parsed.target,
  })

  if (targetUsers.length === 0) {
    throw new Error('No target users found for this broadcast')
  }

  let successCount = 0
  let failCount = 0
  const uniqueErrors = new Set<string>()

  // Send in parallel batches to avoid sequential bottleneck with large tag groups
  const BATCH_SIZE = 20
  for (let i = 0; i < targetUsers.length; i += BATCH_SIZE) {
    const batch = targetUsers.slice(i, i + BATCH_SIZE)
    const results = await Promise.all(
      batch.map((targetUser) =>
        pushLineMessage(
          targetUser.lineUserId,
          parsed.messages as Parameters<typeof pushLineMessage>[1],
          targetUser.lineAccountId ?? broadcast.lineAccountId
        )
      )
    )
    for (const result of results) {
      if (result.success) {
        successCount += 1
      } else {
        failCount += 1
        if (result.error) uniqueErrors.add(result.error)
      }
    }
    onProgress?.(successCount + failCount, successCount, failCount, targetUsers.length)
  }

  const finalStatus: 'failed' | 'sent' =
    failCount === targetUsers.length ? 'failed' : 'sent'

  return {
    summaryText: parsed.summaryText,
    messageType: parsed.messageType,
    totalRecipients: targetUsers.length,
    successCount,
    failCount,
    errors: Array.from(uniqueErrors),
    finalStatus,
  }
}

export function summarizeBroadcastForList(broadcast: {
  content: string
  mediaUrl?: string | null
}) {
  const parsed = parseStoredBroadcast(broadcast.content, broadcast.mediaUrl)
  const primaryMediaMessage = parsed.messages.find((message) => message?.type === 'image' || message?.type === 'video') as { originalContentUrl?: string } | undefined
  const primaryMediaUrl = primaryMediaMessage?.originalContentUrl || broadcast.mediaUrl || null

  return {
    summaryText: parsed.summaryText,
    messageType: parsed.messageType,
    mediaUrl: primaryMediaUrl,
  }
}
