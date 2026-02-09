import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { generateAiText } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const userId = body.userId ? parseInt(String(body.userId), 10) : undefined
    const tone = (body.tone as string | undefined) || 'professional'

    if (!userId || isNaN(userId)) {
      return NextResponse.json({ error: 'Invalid or missing userId' }, { status: 400 })
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
      take: 14,
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

    const prompt = `You are preparing a ghost draft for a pharmacy agent. Write a draft response in Thai with a ${tone} tone. Use short paragraphs and include helpful next steps if needed.

Conversation:
${history}

Draft:`

    const text = await generateAiText({
      parts: [{ text: prompt }],
      systemPrompt: 'Provide a draft only. Do not include disclaimers unless needed.',
      maxTokens: 500,
    })

    return NextResponse.json({ text })
  } catch (error) {
    console.error('AI draft error:', error)
    return NextResponse.json({ error: 'Failed to generate draft' }, { status: 500 })
  }
}
