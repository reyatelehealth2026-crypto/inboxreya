import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

 async function findQuotedMessage(referenceId: string, userId?: number) {
   const whereBase = {
     metadata: { not: null as null | string },
     ...(userId ? { userId } : {}),
   }

   const matchedMessage = await prisma.message.findFirst({
     where: {
       ...whereBase,
       OR: [
         { metadata: { contains: `"lineMessageId":"${referenceId}"` } },
         { metadata: { contains: `"quoteToken":"${referenceId}"` } },
       ],
     },
     orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
     select: {
       id: true,
       content: true,
       messageType: true,
       direction: true,
       metadata: true,
     },
   })

   if (matchedMessage) {
     return matchedMessage
   }

   const fallbackMessages = await prisma.message.findMany({
     where: whereBase,
     orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
     take: userId ? 2000 : 500,
     select: {
       id: true,
       content: true,
       messageType: true,
       direction: true,
       metadata: true,
     },
   })

   for (const msg of fallbackMessages) {
     try {
       const meta = typeof msg.metadata === 'string'
         ? JSON.parse(msg.metadata)
         : msg.metadata

       if (meta?.lineMessageId === referenceId || meta?.quoteToken === referenceId) {
         return msg
       }
     } catch {
     }
   }

   return null
 }

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    // quotedMessageId = LINE message ID of the quoted message (from LINE webhook quotedMessageId field)
    // quoteToken = legacy param (quoteToken stored in outgoing message metadata)
    const quotedMessageId = searchParams.get('quotedMessageId') || searchParams.get('quoteToken')
    const userIdParam = searchParams.get('userId')

    if (!quotedMessageId) {
      return NextResponse.json({ error: 'quotedMessageId is required' }, { status: 400 })
    }

    let parsedUserId: number | undefined
    if (userIdParam) {
      parsedUserId = Number(userIdParam)
      if (!Number.isFinite(parsedUserId)) {
        return NextResponse.json({ error: 'userId must be a number' }, { status: 400 })
      }

      if (session.user.role !== 'super_admin' && session.user.lineAccountId) {
        const lineUser = await prisma.lineUser.findUnique({
          where: { id: parsedUserId },
          select: { lineAccountId: true },
        })

        if (!lineUser) {
          return NextResponse.json({ error: 'User not found' }, { status: 404 })
        }

        if (lineUser.lineAccountId !== session.user.lineAccountId) {
          return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
        }
      }
    }

    const matchedMessage = await findQuotedMessage(quotedMessageId, parsedUserId)

    if (!matchedMessage) {
      return NextResponse.json({
        error: 'Message not found',
        content: null,
      }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      content: matchedMessage.content,
      messageType: matchedMessage.messageType,
      direction: matchedMessage.direction,
      messageId: matchedMessage.id.toString(),
    })
  } catch (error) {
    console.error('Error fetching quoted message:', error)
    return NextResponse.json(
      { error: 'Failed to fetch quoted message' },
      { status: 500 }
    )
  }
}
