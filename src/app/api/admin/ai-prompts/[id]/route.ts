import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { __resetPromptCache } from '@/lib/ai/prompts'

async function guard() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = session.user.role
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { error: null as null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { error } = await guard()
  if (error) return error

  try {
    const { id } = await params
    const promptId = parseInt(id, 10)
    if (!Number.isFinite(promptId)) {
      return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
    }

    const body = (await request.json()) as { isActive?: unknown }
    if (typeof body.isActive !== 'boolean') {
      return NextResponse.json({ error: 'isActive must be boolean' }, { status: 400 })
    }

    const updated = await prisma.aiPrompt.update({
      where: { id: promptId },
      data: { isActive: body.isActive },
    })

    __resetPromptCache()
    logger.info('ai prompt toggled', {
      scope: 'admin/ai-prompts:PATCH',
      id: promptId,
      isActive: body.isActive,
    })
    return NextResponse.json({ data: updated })
  } catch (err) {
    logger.error(err, { scope: 'admin/ai-prompts:PATCH' })
    return NextResponse.json({ error: 'Failed to update prompt' }, { status: 500 })
  }
}
