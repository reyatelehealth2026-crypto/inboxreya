import { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'
import { addRealtimeClient } from '@/lib/realtime'

// SSE endpoint for real-time updates.
//
// NOTE on infra cost: each open SSE connection holds a serverless
// function alive for the full duration, billed as Provisioned Memory
// GB-Hrs. Pusher is already wired in this app and does the same job
// for free up to its quota, so this route is intentionally short-lived
// (50s self-close, 60s hard cap) to bound cost. Long term, prefer
// Pusher and disable this route entirely (set NEXT_PUBLIC_USE_SSE=0
// on the client).
export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session?.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      let removeClient = () => { }
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

      // Tell the browser to wait 5s before reconnecting after we close
      controller.enqueue(encoder.encode('retry: 5000\n\n'))

      client.send({
        type: 'ping',
        data: { userId: session.user.id },
        timestamp: Date.now(),
      })

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
      }, 25000)

      request.signal.addEventListener('abort', () => {
        closeStream()
      })

      // Self-close before the 60s platform cap so the browser reconnects cleanly
      setTimeout(() => {
        closeStream()
      }, 50000)
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
