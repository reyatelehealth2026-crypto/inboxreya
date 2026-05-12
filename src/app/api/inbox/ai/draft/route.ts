/** Streaming GhostDraft endpoint: feature-flagged, rate-limited, prompt-loaded, with structured context + usage logging. */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertFeatureEnabled } from '@/lib/feature-flags'
import { loadActivePrompt } from '@/lib/ai/prompts'
import { checkAndIncrementRateLimit } from '@/lib/ai/rate-limit'
import { buildConversationContext, type AiContext } from '@/lib/ai/context'
import { streamAiText, type GeminiStreamUsage } from '@/lib/ai'
import { RateLimitError } from '@/lib/errors'
import { logger } from '@/lib/logger'

type Tone = 'friendly' | 'professional' | 'empathetic'

function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '')
  if (digits.length < 4) return phone
  const head = digits.slice(0, 3)
  const tail = digits.slice(-2)
  const middle = '*'.repeat(Math.max(1, digits.length - head.length - tail.length))
  return `${head}${middle}${tail}`
}

function estimateCostUsd(_model: string, usage: GeminiStreamUsage): number {
  const cost = (usage.promptTokens * 0.075 + usage.outputTokens * 0.3) / 1_000_000
  return Math.round(cost * 1_000_000) / 1_000_000
}

function buildUserText(ctx: AiContext, tone: Tone, instruction: string | undefined): string {
  const lines: string[] = []
  lines.push(`Tone: ${tone}`)
  lines.push(`Instruction: ${instruction || '(none)'}`)
  lines.push('')

  lines.push('Customer:')
  if (ctx.customer) {
    if (ctx.customer.displayName) lines.push(`- name: ${ctx.customer.displayName}`)
    if (ctx.customer.phone) lines.push(`- phone: ${maskPhone(ctx.customer.phone)}`)
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
  lines.push('')

  if (ctx.orders) {
    lines.push('Orders:')
    const slice = ctx.orders.slice(0, 8)
    if (slice.length === 0) {
      lines.push('(none)')
    } else {
      for (const o of slice) {
        lines.push(`${o.orderNumber} | ${o.total} | ${o.status}`)
      }
    }
    lines.push('')
  }

  if (ctx.catalog) {
    lines.push('Catalog:')
    const slice = ctx.catalog.slice(0, 20)
    if (slice.length === 0) {
      lines.push('(none)')
    } else {
      for (const p of slice) {
        lines.push(`${p.sku} | ${p.name} | ${p.price}`)
      }
    }
    lines.push('')
  }

  lines.push('Draft a reply (no preamble):')
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
    const tone: Tone =
      (body as { tone?: Tone }).tone === 'professional' ||
      (body as { tone?: Tone }).tone === 'empathetic'
        ? ((body as { tone?: Tone }).tone as Tone)
        : 'friendly'
    const instruction =
      typeof (body as { instruction?: string }).instruction === 'string'
        ? (body as { instruction?: string }).instruction
        : undefined

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
      await assertFeatureEnabled('ai_draft', { id: session.user.id, role: session.user.role })
    } catch (err) {
      const e = err as Error & { statusCode?: number }
      if (e.statusCode === 404) {
        return NextResponse.json({ error: 'AI ร่างปิดอยู่' }, { status: 404 })
      }
      throw err
    }

    try {
      await checkAndIncrementRateLimit(session.user.id, 'ghost_draft')
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json({ error: err.message }, { status: 429 })
      }
      throw err
    }

    const prompt = await loadActivePrompt('ghost_draft')
    const ctx = await buildConversationContext(userId, {
      messageWindow: 30,
      includeOrders: true,
      includeCatalog: true,
    })

    const userText = buildUserText(ctx, tone, instruction)
    const startedAt = Date.now()
    const adminUserIdNum = parseInt(session.user.id, 10)

    const stream = await streamAiText({
      parts: [{ text: userText }],
      systemPrompt: prompt.body,
      model: prompt.model,
      maxTokens: 700,
      onFinish: async (fullText, usage) => {
        try {
          await prisma.aiUsageLog.create({
            data: {
              adminUserId: adminUserIdNum,
              feature: 'ghost_draft',
              model: prompt.model,
              promptTokens: usage.promptTokens,
              outputTokens: usage.outputTokens,
              costUsd: estimateCostUsd(prompt.model, usage),
              latencyMs: Date.now() - startedAt,
              success: true,
              conversationId: userId,
            },
          })
          logger.info('ghost_draft completed', {
            scope: 'api:ai:draft',
            adminUserId: adminUserIdNum,
            userId,
            promptVersion: prompt.version,
            outputTokens: usage.outputTokens,
            chars: fullText.length,
          })
        } catch (err) {
          logger.warn('ghost_draft usage log failed', {
            scope: 'api:ai:draft',
            err: String(err),
          })
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/plain; charset=utf-8',
        'X-Ai-Prompt-Version': String(prompt.version),
        'X-Ai-Context-Degraded': ctx.degraded.join(',') || '',
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logger.error(error, { scope: 'api:ai:draft' })
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to generate draft', message }, { status: 500 })
  }
}
