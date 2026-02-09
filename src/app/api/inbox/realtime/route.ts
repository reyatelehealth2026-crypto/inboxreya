import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { addRealtimeClient } from '@/lib/realtime'

// SSE endpoint for real-time updates
export const runtime = 'nodejs'
export const maxDuration = 300
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let removeClient = () => {}
      let keepAliveInterval: ReturnType<typeof setInterval> | null = null

      const closeStream = () => {
        removeClient()
        if (keepAliveInterval) {
          clearInterval(keepAliveInterval)
        }
        controller.close()
      }

      const client = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        send: (event: { type: string; data: unknown; timestamp: number }) => {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`))
        },
      }
      removeClient = addRealtimeClient(client)

      controller.enqueue(encoder.encode('retry: 5000\n\n'))

      // Send initial connection message
      client.send({
        type: 'ping',
        data: { userId: session.user.id },
        timestamp: Date.now(),
      })

      // Keep-alive interval
      keepAliveInterval = setInterval(() => {
        try {
          client.send({
            type: 'ping',
            data: {},
            timestamp: Date.now(),
          })
        } catch {
          closeStream()
        }
      }, 25000) // Send ping every 25 seconds (before 30s timeout)

      // Cleanup on close
      request.signal.addEventListener('abort', () => {
        closeStream()
      })

      // Close after 4 minutes to prevent timeout
      setTimeout(() => {
        closeStream()
      }, 240000) // 4 minutes
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
