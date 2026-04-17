import { DELETE } from '@/app/api/inbox/broadcasts/[id]/route'
import { NextResponse } from 'next/server'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findFirst: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
  cacheInvalidate: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: mocks.requireAuth,
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    broadcastMessageV2: {
      findFirst: mocks.findFirst,
      update: mocks.update,
      delete: mocks.delete,
    },
  },
}))

vi.mock('@/lib/redis', () => ({
  cacheInvalidate: mocks.cacheInvalidate,
}))

describe('DELETE /api/inbox/broadcasts/[id]', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    mocks.requireAuth.mockResolvedValue({
      user: {
        id: '7',
        lineAccountId: 3,
      },
    })

    mocks.findFirst.mockResolvedValue({
      id: 123,
      lineAccountId: 3,
      status: 'scheduled',
    })

    mocks.update.mockResolvedValue({})
    mocks.delete.mockResolvedValue({})
    mocks.cacheInvalidate.mockResolvedValue(undefined)
  })

  test('falls back to deleting scheduled broadcasts when legacy status enum rejects cancelled', async () => {
    mocks.update.mockRejectedValueOnce(
      new Error(
        'ConnectorError(Server(MysqlError { code: 1265, message: "Data truncated for column \'status\' at row 1" }))'
      )
    )

    const response = await DELETE(new Request('http://localhost/api/inbox/broadcasts/123') as never, {
      params: Promise.resolve({ id: '123' }),
    })

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toEqual({ success: true })

    expect(mocks.update).toHaveBeenCalledWith({
      where: { id: 123 },
      data: { status: 'cancelled' },
    })
    expect(mocks.delete).toHaveBeenCalledWith({
      where: { id: 123 },
    })
    expect(mocks.cacheInvalidate).toHaveBeenCalledWith('broadcasts:*')
  })

  test('returns auth response when unauthenticated', async () => {
    mocks.requireAuth.mockResolvedValueOnce(
      NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    )

    const response = await DELETE(new Request('http://localhost/api/inbox/broadcasts/123') as never, {
      params: Promise.resolve({ id: '123' }),
    })

    expect(response.status).toBe(401)
    expect(mocks.findFirst).not.toHaveBeenCalled()
  })
})
