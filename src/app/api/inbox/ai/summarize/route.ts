/**
 * Thread Summarizer: non-streaming AI route. Pulls recent conversation
 * context, feeds it through the `summarizer` prompt, and caches the result
 * for 10 minutes per (user, window) pair.
 */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertFeatureEnabled } from '@/lib/feature-flags'
import { loadActivePrompt } from '@/lib/ai/prompts'
import { checkAndIncrementRateLimit } from '@/lib/ai/rate-limit'
import { buildConversationContext, type AiContext } from '@/lib/ai/context'
import { generateAiText } from '@/lib/ai'
import { cacheQuery } from '@/lib/redis'
import { RateLimitError } from '@/lib/errors'
import { logger } from '@/lib/logger'

const ALLOWED_WINDOWS = [50, 100, 200, 500] as const
type MessageCount = (typeof ALLOWED_WINDOWS)[number]

interface SummarizeResult {
  summary: string
  degraded: string[]
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
  lines.push('Conversation:')
  if (ctx.messages.length === 0) {
    lines.push('(no recent messages)')
  } else {
    for (const m of ctx.messages) {
      lines.push(`${m.role}: ${m.content}`)
    }
  }
  return lines.join('\n')
}

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json().catch(() => ({}))
    const rawUserId = (body as { userId?: number | string }).userId
    const userId = rawUserId != null ? parseInt(String(rawUserId), 10) : NaN
    if (!Number.isFinite(userId) || userId <= 0) {
      return NextResponse.json({ error: 'Invalid or missing userId' }, { status: 400 })
    }

    const rawCount = (body as { messageCount?: number }).messageCount
    let messageCount: MessageCount = 100
    if (rawCount != null) {
      const n = Number(rawCount)
      if (!ALLOWED_WINDOWS.includes(n as MessageCount)) {
        return NextResponse.json(
          { error: 'Invalid messageCount (must be 50, 100, 200, or 500)' },
          { status: 400 },
        )
      }
      messageCount = n as MessageCount
    }

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
      await assertFeatureEnabled('ai_summarizer', {
        id: session.user.id,
        role: session.user.role,
      })
    } catch (err) {
      const e = err as Error & { statusCode?: number }
      if (e.statusCode === 404) {
        return NextResponse.json({ error: 'สรุปแชทปิดอยู่' }, { status: 404 })
      }
      throw err
    }

    try {
      await checkAndIncrementRateLimit(session.user.id, 'summarizer')
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json({ error: err.message }, { status: 429 })
      }
      throw err
    }

    const adminUserIdNum = parseInt(session.user.id, 10)
    const cacheKey = `summary:${userId}:${messageCount}`

    const result = await cacheQuery<SummarizeResult>(
      cacheKey,
      async () => {
        const prompt = await loadActivePrompt('summarizer')
        const ctx = await buildConversationContext(userId, {
          messageWindow: messageCount,
          includeOrders: false,
          includeCatalog: false,
        })

        const userText = buildUserText(ctx)
        const startedAt = Date.now()

        const text = await generateAiText({
          parts: [{ text: userText }],
          systemPrompt: prompt.body,
          model: prompt.model,
          maxTokens: 1200,
        })

        const latencyMs = Date.now() - startedAt

        try {
          await prisma.aiUsageLog.create({
            data: {
              adminUserId: adminUserIdNum,
              feature: 'summarizer',
              model: prompt.model,
              promptTokens: 0,
              outputTokens: 0,
              costUsd: 0,
              latencyMs,
              success: true,
              conversationId: userId,
            },
          })
          logger.info('summarizer completed', {
            scope: 'api:ai:summarize',
            adminUserId: adminUserIdNum,
            userId,
            promptVersion: prompt.version,
            messageCount,
            chars: text.length,
            latencyMs,
          })
        } catch (err) {
          logger.warn('summarizer usage log failed', {
            scope: 'api:ai:summarize',
            err: String(err),
          })
        }

        return { summary: text, degraded: ctx.degraded }
      },
      600,
    )

    return NextResponse.json(result)
  } catch (error) {
    logger.error(error, { scope: 'api:ai:summarize' })
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: 'Failed to summarize thread', message },
      { status: 500 },
    )
  }
}
