import { POST } from '@/app/api/ai-agent/promo-drafts/[id]/approve/route'
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findDraft: vi.fn(),
  countRecipients: vi.fn(),
  createBroadcast: vi.fn(),
  updateDraft: vi.fn(),
  transaction: vi.fn(),
  cacheInvalidate: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    aiPromoDraft: {
      findFirst: mocks.findDraft,
    },
    $transaction: mocks.transaction,
  },
}))

vi.mock('@/lib/broadcast-recipient-estimate', () => ({
  countBroadcastRecipients: mocks.countRecipients,
}))

vi.mock('@/lib/redis', () => ({
  cacheInvalidate: mocks.cacheInvalidate,
}))

describe('POST /api/ai-agent/promo-drafts/[id]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.requireAuth.mockResolvedValue({ user: { id: '7', lineAccountId: 3 } })
    mocks.findDraft.mockResolvedValue({
      id: 11,
      lineAccountId: 3,
      generatedCopy: 'Promo copy',
      flexJson: { type: 'flex', altText: 'Promo', contents: { type: 'carousel', contents: [] } },
      status: 'draft',
      errorMessage: null,
      createdBroadcastId: null,
    })
    mocks.countRecipients.mockResolvedValue(2)
    mocks.createBroadcast.mockResolvedValue({ id: 99 })
    mocks.updateDraft.mockResolvedValue({ id: 11, status: 'scheduled_broadcast_created' })
    mocks.transaction.mockImplementation(async (callback) => callback({
      broadcastMessageV2: { create: mocks.createBroadcast },
      aiPromoDraft: { update: mocks.updateDraft },
      $executeRawUnsafe: vi.fn(),
    }))
    mocks.cacheInvalidate.mockResolvedValue(undefined)
  })

  test('creates only a scheduled broadcast after approval', async () => {
    const response = await POST(new Request('http://localhost/api/ai-agent/promo-drafts/11/approve', {
      method: 'POST',
      body: JSON.stringify({
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        targetTagIds: [1, 2],
      }),
    }) as never, { params: Promise.resolve({ id: '11' }) })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ success: true })
    expect(mocks.createBroadcast).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'scheduled', totalRecipients: 2 }),
    }))
    expect(mocks.updateDraft).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ status: 'scheduled_broadcast_created', createdBroadcastId: 99 }),
    }))
  })

  test('rejects unauthenticated requests', async () => {
    mocks.requireAuth.mockResolvedValueOnce(NextResponse.json({ success: false }, { status: 401 }))

    const response = await POST(new Request('http://localhost/api/ai-agent/promo-drafts/11/approve', {
      method: 'POST',
      body: JSON.stringify({ scheduledAt: new Date().toISOString(), targetTagIds: [1] }),
    }) as never, { params: Promise.resolve({ id: '11' }) })

    expect(response.status).toBe(401)
    expect(mocks.findDraft).not.toHaveBeenCalled()
  })
})

