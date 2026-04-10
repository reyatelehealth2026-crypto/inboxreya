import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { sendBroadcastRecord } from '@/lib/broadcast-runtime'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const { id } = await params
    const broadcastId = Number(id)
    if (!broadcastId || broadcastId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid broadcast id' }, { status: 400 })
    }

    const broadcast = await prisma.broadcastMessageV2.findFirst({
      where: {
        id: broadcastId,
        lineAccountId: user.lineAccountId as number,
      },
    })

    if (!broadcast) {
      return NextResponse.json({ success: false, error: 'Broadcast not found' }, { status: 404 })
    }

    if (broadcast.status === 'sent') {
      return NextResponse.json({ success: false, error: 'Broadcast already sent' }, { status: 400 })
    }

    if (broadcast.status === 'cancelled') {
      return NextResponse.json({ success: false, error: 'Broadcast is cancelled' }, { status: 400 })
    }

    // Stream progress via SSE
    const encoder = new TextEncoder()

    const stream = new ReadableStream({
      async start(controller) {
        const emit = (data: object) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        }

        try {
          emit({ type: 'start', total: broadcast.totalRecipients ?? 0 })

          const result = await sendBroadcastRecord(
            {
              id: broadcast.id,
              lineAccountId: broadcast.lineAccountId,
              content: broadcast.content,
              mediaUrl: broadcast.mediaUrl,
            },
            (sent, success, failed, total) => {
              emit({ type: 'progress', sent, success, failed, total })
            }
          )

          const finalStatus = result.finalStatus === 'sent' ? 'sent' : 'failed'

          await prisma.broadcastMessageV2.update({
            where: { id: broadcast.id },
            data: {
              status: finalStatus,
              sentAt: finalStatus === 'sent' ? new Date() : null,
              deliveredCount: result.successCount,
            },
          })

          emit({
            type: 'complete',
            success: true,
            status: finalStatus,
            totalRecipients: result.totalRecipients,
            successCount: result.successCount,
            failedCount: result.failCount,
            errors: result.errors,
          })
        } catch (error: any) {
          console.error('[Broadcast Send] Error:', error)
          emit({ type: 'error', error: error.message || 'Failed to send broadcast' })
        } finally {
          controller.close()
        }
      },
    })

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (error: any) {
    console.error('[Broadcast Send] Unexpected error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to send broadcast' },
      { status: 500 }
    )
  }
}
