import type { SSEEvent } from '@/types'

type RealtimeClient = {
  id: string
  send: (event: SSEEvent) => void
}

const globalForRealtime = globalThis as typeof globalThis & {
  __realtimeClients?: Set<RealtimeClient>
}

const clients = globalForRealtime.__realtimeClients ?? new Set<RealtimeClient>()
globalForRealtime.__realtimeClients = clients

export function addRealtimeClient(client: RealtimeClient) {
  clients.add(client)
  return () => {
    clients.delete(client)
  }
}

export function broadcastRealtimeEvent(event: SSEEvent) {
  for (const client of clients) {
    try {
      client.send(event)
    } catch {
      clients.delete(client)
    }
  }
}
