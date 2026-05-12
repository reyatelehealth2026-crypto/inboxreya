import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateAiText } from '@/lib/ai'
import { logger } from '@/lib/logger'

export async function POST(request: Request) {
  let debugUserId: number | null = null
  let debugTone: string | undefined
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const rawUserId = body.userId
    const userId = rawUserId ? Number(rawUserId) : undefined
    const tone = (body.tone as string | undefined) || 'friendly'
    debugUserId = Number.isFinite(userId) ? (userId as number) : null
    debugTone = tone

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Missing or invalid userId' }, { status: 400 })
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

    const messages = await prisma.message.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 12,
    })

    const history = messages
      .slice()
      .reverse()
      .map((msg) => {
        const role = msg.direction === 'incoming' ? 'Customer' : 'Agent'
        const content = msg.content || `[${msg.messageType}]`
        return `${role}: ${content}`
      })
      .join('\n')

    const prompt = `You are a pharmacy customer support assistant. Write a concise reply in Thai with a ${tone} tone. Keep it helpful and safe.

Conversation:
${history}

Reply:`

    const text = await generateAiText({
      parts: [{ text: prompt }],
      systemPrompt: 'Be concise, polite, and accurate.',
      maxTokens: 1500,
    })

    return NextResponse.json({ text })
  } catch (error) {
    logger.error(error, { scope: 'api:ai:reply', userId: debugUserId, tone: debugTone })
    // #region agent log
    /*
    fetch('http://127.0.0.1:7242/ingest/93a2d762-e9a0-44b0-a3f0-f6fecdab7f7f', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sessionId: 'debug-session',
        runId: 'run1',
        hypothesisId: 'H4',
        location: 'ai/reply/route.ts:POST',
        message: 'AI reply failed',
        data: {
          userId: debugUserId,
          tone: debugTone,
          error: error instanceof Error ? error.message : 'Unknown error',
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {})
    */
    // #endregion agent log
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to generate reply: ${errorMessage}` },
      { status: 500 }
    )
  }
}
