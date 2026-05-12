/** Action Suggester: recommends 2-3 next actions for a conversation, cached 30 min per user. */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertFeatureEnabled } from '@/lib/feature-flags'
import { loadActivePrompt } from '@/lib/ai/prompts'
import { checkAndIncrementRateLimit } from '@/lib/ai/rate-limit'
import { buildConversationContext, type AiContext } from '@/lib/ai/context'
import { generateAiText } from '@/lib/ai'
import { cacheQuery, cacheInvalidate } from '@/lib/redis'
import { RateLimitError } from '@/lib/errors'
import { logger } from '@/lib/logger'

const VALID_TYPES = ['reply', 'price_list', 'follow_up', 'order_check', 'escalate'] as const
type ActionType = (typeof VALID_TYPES)[number]

interface SuggestedAction {
  label: string
  reason: string
  type: ActionType
  priority: 1 | 2 | 3
}

interface SuggestResult {
  actions: SuggestedAction[]
  degraded: string[]
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1].trim()
  return trimmed
}

function coerceActions(raw: string): SuggestedAction[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(stripCodeFences(raw))
  } catch {
    return []
  }
  if (!parsed || typeof parsed !== 'object') return []
  const arr = (parsed as { actions?: unknown }).actions
  if (!Array.isArray(arr)) return []

  const valid: SuggestedAction[] = []
  for (const item of arr) {
    if (!item || typeof item !== 'object') continue
    const r = item as Record<string, unknown>
    const label = typeof r.label === 'string' ? r.label.trim() : ''
    const reason = typeof r.reason === 'string' ? r.reason.trim() : ''
    const type = typeof r.type === 'string' ? r.type : ''
    const priorityNum =
      typeof r.priority === 'number' ? Math.trunc(r.priority) : parseInt(String(r.priority), 10)
    if (!label || !reason) continue
    if (!(VALID_TYPES as readonly string[]).includes(type)) continue
    if (![1, 2, 3].includes(priorityNum)) continue
    valid.push({
      label,
      reason,
      type: type as ActionType,
      priority: priorityNum as 1 | 2 | 3,
    })
  }
  return valid
}

function buildUserText(ctx: AiContext): string {
  const lines: string[] = []
  lines.push('Customer:')
  if (ctx.customer?.displayName) {
    lines.push(`- name: ${ctx.customer.displayName}`)
  } else {
    lines.push('- (unknown)')
  }
  lines.push('')
  lines.push('Recent conversation (last 20):')
  if (ctx.messages.length === 0) {
    lines.push('(no recent messages)')
  } else {
    for (const m of ctx.messages) {
      lines.push(`${m.role}: ${m.content}`)
    }
  }
  lines.push('')
  lines.push('Orders:')
  if (!ctx.orders || ctx.orders.length === 0) {
    lines.push('(no orders)')
  } else {
    for (const o of ctx.orders.slice(0, 5)) {
      lines.push(`- ${o.orderNumber} | ${o.status} | ${o.total} | ${o.createdAt}`)
    }
  }
  lines.push('')
  lines.push(
    'Return ONLY valid JSON: { "actions": [{ "label": string, "reason": string, "type": "reply" | "price_list" | "follow_up" | "order_check" | "escalate", "priority": 1 | 2 | 3 }] }. priority 1 = urgent. Labels in Thai, under 8 words. Reasons cite the conversation. Return 2 or 3 actions only.',
  )
  return lines.join('\n')
}

export async function GET(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const url = new URL(request.url)
    const rawUserId = url.searchParams.get('userId')
    const userId = rawUserId != null ? parseInt(rawUserId, 10) : NaN
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid or missing userId' }, { status: 400 })
    }
    const force = url.searchParams.get('force') === 'true'

    const user = await prisma.lineUser.findFirst({
      where: {
        id: userId,
        ...(session.user.role !== 'super_admin' && session.user.lineAccountId
          ? { lineAccountId: session.user.lineAccountId }
          : {}),
      },
      select: { id: true },
    })
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    try {
      await assertFeatureEnabled('ai_action_suggester', {
        id: session.user.id,
        role: session.user.role,
      })
    } catch (err) {
      const e = err as Error & { statusCode?: number }
      if (e.statusCode === 404) {
        return NextResponse.json({ error: 'ตัวแนะนำขั้นต่อไปปิดอยู่' }, { status: 404 })
      }
      throw err
    }

    try {
      await checkAndIncrementRateLimit(session.user.id, 'action_suggester')
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json({ error: err.message }, { status: 429 })
      }
      throw err
    }

    const adminUserIdNum = parseInt(session.user.id, 10)
    const cacheKey = `suggest:${userId}`

    if (force) {
      await cacheInvalidate(cacheKey)
    }

    const result = await cacheQuery<SuggestResult>(
      cacheKey,
      async () => {
        const prompt = await loadActivePrompt('action_suggester')
        const ctx = await buildConversationContext(userId, {
          messageWindow: 20,
          includeOrders: true,
          includeCatalog: false,
        })

        const userText = buildUserText(ctx)
        const startedAt = Date.now()

        const raw = await generateAiText({
          parts: [{ text: userText }],
          systemPrompt: prompt.body,
          model: prompt.model,
          maxTokens: 1500,
          temperature: 0.3,
        })

        const latencyMs = Date.now() - startedAt
        const actions = coerceActions(raw)

        try {
          await prisma.aiUsageLog.create({
            data: {
              adminUserId: adminUserIdNum,
              feature: 'action_suggester',
              model: prompt.model,
              promptTokens: 0,
              outputTokens: 0,
              costUsd: 0,
              latencyMs,
              success: true,
              conversationId: userId,
            },
          })
          logger.info('action_suggester completed', {
            scope: 'api:ai:suggest-action',
            adminUserId: adminUserIdNum,
            userId,
            promptVersion: prompt.version,
            actionCount: actions.length,
            latencyMs,
          })
        } catch (err) {
          logger.warn('action_suggester usage log failed', {
            scope: 'api:ai:suggest-action',
            err: String(err),
          })
        }

        return { actions, degraded: ctx.degraded }
      },
      1800,
    )

    return NextResponse.json(result)
  } catch (error) {
    logger.error(error, { scope: 'api:ai:suggest-action' })
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to suggest actions', message },
      { status: 500 },
    )
  }
}
