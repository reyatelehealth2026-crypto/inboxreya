/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { GET } from './route'
import prisma from '@/lib/prisma'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    lineUser: {
      findUnique: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('@/lib/php-bridge', () => ({
  sendPlatformMessage: vi.fn(),
}))

vi.mock('@/lib/realtime', () => ({
  broadcastRealtimeEvent: vi.fn(),
}))

vi.mock('@/lib/pusher', () => ({
  broadcastNewMessage: vi.fn(),
}))

describe('GET /api/inbox/messages', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('fetches messages without mutating read state', async () => {
    ;(prisma.lineUser.findUnique as any).mockResolvedValue({
      id: 123,
      lineAccountId: 5,
    })
    ;(prisma.message.findMany as any).mockResolvedValue([
      {
        id: 1,
        userId: 123,
        direction: 'incoming',
        messageType: 'text',
        content: 'hello',
        mediaUrl: null,
        metadata: null,
        isRead: false,
        sentBy: null,
        replyToId: null,
        replyTo: null,
        platform: 'line',
        createdAt: new Date('2026-03-15T12:00:00.000Z'),
        updatedAt: new Date('2026-03-15T12:00:00.000Z'),
      },
    ])
    ;(prisma.message.count as any).mockResolvedValue(1)

    const request = new Request('http://localhost/api/inbox/messages?userId=123', {
      headers: {
        'x-internal-request': 'true',
      },
    }) as any

    const response = await GET(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.data).toHaveLength(1)
    expect(json.data[0].createdAt).toBe('2026-03-15T12:00:00.000+07:00')
    expect(prisma.message.updateMany).not.toHaveBeenCalled()
  })
})
