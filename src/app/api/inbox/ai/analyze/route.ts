import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { fetchImageAsInlineData, generateAiText } from '@/lib/ai'

export async function POST(request: Request) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const userId = body.userId ? parseInt(String(body.userId), 10) : undefined
    const imageUrl = body.imageUrl as string | undefined

    if (!userId || isNaN(userId) || !imageUrl) {
      return NextResponse.json({ error: 'Missing or invalid userId or imageUrl' }, { status: 400 })
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

    const inlineData = await fetchImageAsInlineData(imageUrl)

    const prompt = `Analyze this image from a customer message. Provide a concise summary in Thai, focusing on medical or pharmacy-relevant details.`

    const text = await generateAiText({
      parts: [
        { text: prompt },
        {
          inline_data: {
            mime_type: inlineData.mimeType,
            data: inlineData.data,
          },
        },
      ],
      systemPrompt: 'Be factual and cautious. If unsure, say so.',
      maxTokens: 300,
    })

    return NextResponse.json({ text })
  } catch (error) {
    console.error('AI analyze error:', error)
    return NextResponse.json({ error: 'Failed to analyze image' }, { status: 500 })
  }
}
