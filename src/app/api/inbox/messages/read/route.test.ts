/** @vitest-environment node */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { PUT } from './route'
import prisma from '@/lib/prisma'
import { broadcastRealtimeEvent } from '@/lib/realtime'
import { broadcastMessageRead } from '@/lib/pusher'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn().mockResolvedValue({
    user: {
      id: '9',
    },
  }),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    message: {
      findMany: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}))

vi.mock('@/lib/realtime', () => ({
  broadcastRealtimeEvent: vi.fn(),
}))

vi.mock('@/lib/pusher', () => ({
  broadcastMessageRead: vi.fn(),
}))

describe('PUT /api/inbox/messages/read', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('marks unread messages as read and broadcasts both realtime channels', async () => {
    ;(prisma.message.findMany as any).mockResolvedValue([{ id: 11 }, { id: 12 }])
    ;(prisma.message.updateMany as any).mockResolvedValue({ count: 2 })

    const request = new Request('http://localhost/api/inbox/messages/read', {
      method: 'PUT',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({ userId: '123' }),
    }) as any

    const response = await PUT(request)
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.updated).toBe(2)
    expect(prisma.message.updateMany).toHaveBeenCalledWith({
      where: {
        userId: 123,
        direction: 'incoming',
        isRead: false,
      },
      data: { isRead: true },
    })
    expect(broadcastRealtimeEvent).toHaveBeenCalledTimes(1)
    expect(broadcastMessageRead).toHaveBeenCalledWith(
      expect.objectContaining({
        conversationId: '123',
        messageIds: ['11', '12'],
        readBy: '9',
        scope: 'conversation',
      })
    )
  })
})
