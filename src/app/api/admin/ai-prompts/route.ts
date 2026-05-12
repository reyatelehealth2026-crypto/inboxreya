import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { __resetPromptCache } from '@/lib/ai/prompts'

const ALLOWED_KEYS = ['ghost_draft', 'summarizer', 'action_suggester', 'order_parser'] as const
type AllowedKey = (typeof ALLOWED_KEYS)[number]

function isAllowedKey(value: unknown): value is AllowedKey {
  return typeof value === 'string' && (ALLOWED_KEYS as readonly string[]).includes(value)
}

async function guard() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }), session: null }
  }
  const role = session.user.role
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }), session: null }
  }
  return { error: null, session }
}

export async function GET() {
  const { error } = await guard()
  if (error) return error

  try {
    const rows = await prisma.aiPrompt.findMany({
      orderBy: [{ key: 'asc' }, { version: 'desc' }],
    })
    return NextResponse.json({ data: rows })
  } catch (err) {
    logger.error(err, { scope: 'admin/ai-prompts:GET' })
    return NextResponse.json({ error: 'Failed to load prompts' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const { error, session } = await guard()
  if (error) return error

  try {
    const body = (await request.json()) as { key?: unknown; body?: unknown; model?: unknown }
    if (!isAllowedKey(body.key)) {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }
    if (typeof body.body !== 'string' || body.body.trim().length === 0) {
      return NextResponse.json({ error: 'body is required' }, { status: 400 })
    }
    const promptBody = body.body
    const modelName =
      typeof body.model === 'string' && body.model.trim().length > 0
        ? body.model.trim()
        : 'gemini-flash-latest'
    const key: AllowedKey = body.key

    const latest = await prisma.aiPrompt.findFirst({
      where: { key },
      orderBy: { version: 'desc' },
      select: { version: true },
    })
    const nextVersion = (latest?.version ?? 0) + 1
    const createdBy = session ? parseInt(session.user.id, 10) : null

    const [, created] = await prisma.$transaction([
      prisma.aiPrompt.updateMany({ where: { key }, data: { isActive: false } }),
      prisma.aiPrompt.create({
        data: {
          key,
          version: nextVersion,
          body: promptBody,
          model: modelName,
          isActive: true,
          createdBy: Number.isFinite(createdBy) ? (createdBy as number) : null,
        },
      }),
    ])

    __resetPromptCache()
    logger.info('ai prompt version created', {
      scope: 'admin/ai-prompts:POST',
      key,
      version: nextVersion,
      id: created.id,
    })
    return NextResponse.json({ data: created })
  } catch (err) {
    logger.error(err, { scope: 'admin/ai-prompts:POST' })
    return NextResponse.json({ error: 'Failed to create prompt' }, { status: 500 })
  }
}
