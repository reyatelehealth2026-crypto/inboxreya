/** Order Intake Parser: matches free-form customer message against catalog and returns structured items + confidence. */
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { assertFeatureEnabled } from '@/lib/feature-flags'
import { loadActivePrompt } from '@/lib/ai/prompts'
import { checkAndIncrementRateLimit } from '@/lib/ai/rate-limit'
import { buildConversationContext, type AiContext } from '@/lib/ai/context'
import { generateAiText } from '@/lib/ai'
import { RateLimitError } from '@/lib/errors'
import { logger } from '@/lib/logger'

interface ParsedItem {
  sku: string
  name: string
  qty: number
  price: number
  confidence: number
}

function stripCodeFences(raw: string): string {
  const trimmed = raw.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1].trim()
  return trimmed
}

function safeParse(raw: string): { items: ParsedItem[] } | null {
  try {
    const cleaned = stripCodeFences(raw)
    const parsed = JSON.parse(cleaned) as unknown
    if (!parsed || typeof parsed !== 'object') return null
    const itemsRaw = (parsed as { items?: unknown }).items
    if (!Array.isArray(itemsRaw)) return null
    const items: ParsedItem[] = []
    for (const it of itemsRaw) {
      if (!it || typeof it !== 'object') continue
      const r = it as Record<string, unknown>
      const sku = typeof r.sku === 'string' ? r.sku : ''
      const name = typeof r.name === 'string' ? r.name : ''
      const qty = typeof r.qty === 'number' ? r.qty : Number(r.qty)
      const price = typeof r.price === 'number' ? r.price : Number(r.price)
      const confidence = typeof r.confidence === 'number' ? r.confidence : Number(r.confidence)
      if (!Number.isInteger(qty) || qty <= 0) continue
      if (!Number.isFinite(price)) continue
      const conf = Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0
      items.push({ sku, name, qty, price, confidence: conf })
    }
    return { items }
  } catch {
    return null
  }
}

function buildUserText(ctx: AiContext, text: string): string {
  const lines: string[] = []
  lines.push(`Message to parse: "${text}"`)
  lines.push('')

  const recent = ctx.messages.slice(-3)
  if (recent.length > 0) {
    lines.push('Recent conversation:')
    for (const m of recent) {
      lines.push(`${m.role}: ${m.content}`)
    }
    lines.push('')
  }

  lines.push('Catalog:')
  if (!ctx.catalog || ctx.catalog.length === 0) {
    lines.push('(catalog unavailable)')
  } else {
    for (const p of ctx.catalog.slice(0, 50)) {
      lines.push(`${p.sku} | ${p.name} | ${p.price}`)
    }
  }
  lines.push('')

  lines.push(
    'Return ONLY valid JSON matching this schema: { items: [{ sku, name, qty, price, confidence }] }. confidence is 0..1. Use only SKUs from the catalog above; if no good match, set confidence < 0.5 and keep the original phrasing in name. qty must be a positive integer.',
  )
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
    const text = (body as { text?: unknown }).text
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 4000) {
      return NextResponse.json({ error: 'Invalid or missing text' }, { status: 400 })
    }
    const messageId = (body as { messageId?: number | string }).messageId

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
      await assertFeatureEnabled('ai_order_parser', {
        id: session.user.id,
        role: session.user.role,
      })
    } catch (err) {
      const e = err as Error & { statusCode?: number }
      if (e.statusCode === 404) {
        return NextResponse.json({ error: 'ตัวแปลงออเดอร์ปิดอยู่' }, { status: 404 })
      }
      throw err
    }

    try {
      await checkAndIncrementRateLimit(session.user.id, 'order_parser')
    } catch (err) {
      if (err instanceof RateLimitError) {
        return NextResponse.json({ error: err.message }, { status: 429 })
      }
      throw err
    }

    const prompt = await loadActivePrompt('order_parser')
    const ctx = await buildConversationContext(userId, {
      messageWindow: 6,
      includeOrders: false,
      includeCatalog: true,
    })

    const userText = buildUserText(ctx, text)
    const startedAt = Date.now()
    const adminUserIdNum = parseInt(session.user.id, 10)

    const raw = await generateAiText({
      parts: [{ text: userText }],
      systemPrompt: prompt.body,
      model: prompt.model,
      maxTokens: 800,
      temperature: 0.1,
    })

    const latencyMs = Date.now() - startedAt
    const parsed = safeParse(raw)

    try {
      await prisma.aiUsageLog.create({
        data: {
          adminUserId: adminUserIdNum,
          feature: 'order_parser',
          model: prompt.model,
          promptTokens: 0,
          outputTokens: 0,
          costUsd: 0,
          latencyMs,
          success: true,
          conversationId: userId,
        },
      })
      logger.info('order_parser completed', {
        scope: 'api:ai:parse-order',
        adminUserId: adminUserIdNum,
        userId,
        messageId: messageId != null ? String(messageId) : undefined,
        promptVersion: prompt.version,
        itemCount: parsed?.items.length ?? 0,
        latencyMs,
      })
    } catch (err) {
      logger.warn('order_parser usage log failed', {
        scope: 'api:ai:parse-order',
        err: String(err),
      })
    }

    if (!parsed) {
      return NextResponse.json({
        items: [],
        parseError: 'AI did not return valid JSON',
        degraded: ctx.degraded,
      })
    }

    return NextResponse.json({ items: parsed.items, degraded: ctx.degraded })
  } catch (error) {
    logger.error(error, { scope: 'api:ai:parse-order' })
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ error: 'Failed to parse order', message }, { status: 500 })
  }
}
