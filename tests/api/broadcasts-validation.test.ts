import { POST as createBroadcast } from '@/app/api/inbox/broadcasts/route'
import { POST as estimateBroadcast } from '@/app/api/inbox/broadcasts/estimate/route'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  countRecipients: vi.fn(),
  create: vi.fn(),
  cacheInvalidate: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/broadcast-recipient-estimate', () => ({
  countBroadcastRecipients: mocks.countRecipients,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    broadcastMessageV2: {
      create: mocks.create,
    },
  },
  default: {
    broadcastMessageV2: {
      create: mocks.create,
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  cacheInvalidate: mocks.cacheInvalidate,
  cacheQuery: vi.fn(),
  CACHE_TTL: { BROADCASTS: 30 },
}))

describe('broadcast validation compatibility', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({
      user: {
        id: '7',
        lineAccountId: 3,
      },
    })
    mocks.countRecipients.mockResolvedValue(12)
    mocks.create.mockImplementation(async ({ data }) => ({ id: 123, ...data }))
    mocks.cacheInvalidate.mockResolvedValue(undefined)
  })

  test('coerces string tag ids for recipient estimates', async () => {
    const response = await estimateBroadcast(new Request('http://localhost/api/inbox/broadcasts/estimate', {
      method: 'POST',
      body: JSON.stringify({ targetTagIds: ['1', '2', '2'] }),
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.countRecipients).toHaveBeenCalledWith(expect.objectContaining({
      targetTagIds: [1, 2],
    }))
  })

  test('accepts datetime-local scheduledAt and string target ids when creating broadcasts', async () => {
    const response = await createBroadcast(new Request('http://localhost/api/inbox/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Promotion message',
        messageType: 'text',
        scheduledAt: '2026-05-18T10:30',
        targetTagIds: ['1', '2'],
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(mocks.countRecipients).toHaveBeenCalledWith(expect.objectContaining({
      targetTagIds: [1, 2],
    }))
    expect(mocks.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        status: 'scheduled',
        scheduledAt: expect.any(Date),
      }),
    }))
  })

  test('returns a 400 for invalid flex payloads instead of logging a server error', async () => {
    const response = await createBroadcast(new Request('http://localhost/api/inbox/broadcasts', {
      method: 'POST',
      body: JSON.stringify({
        content: 'Broken Flex',
        messageType: 'flex',
        flexContents: [{ type: 'flex', altText: 'ok', contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } } }, { nope: true }],
      }),
    }) as never)

    expect(response.status).toBe(400)
    await expect(response.json()).resolves.toMatchObject({
      success: false,
      error: 'Invalid flexContent payload at index 1',
    })
    expect(mocks.create).not.toHaveBeenCalled()
  })
})
