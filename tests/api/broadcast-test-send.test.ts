import { beforeEach, describe, expect, test, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findFirst: vi.fn(),
  push: vi.fn(),
}))

vi.mock('@/lib/auth-middleware', () => ({ requireAuth: mocks.requireAuth }))
vi.mock('@/lib/prisma', () => ({
  default: { lineUser: { findFirst: mocks.findFirst } },
  prisma: { lineUser: { findFirst: mocks.findFirst } },
}))
vi.mock('@/lib/line-api', () => ({ pushLineMessage: mocks.push }))

const { POST } = await import('@/app/api/inbox/broadcasts/test-send/route')

const flex = {
  type: 'flex',
  altText: 'ดีลใกล้หมดเวลา',
  contents: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [{ type: 'text', text: 'hi' }] } },
}

const request = (body: unknown) =>
  new NextRequest('http://localhost/api/inbox/broadcasts/test-send', {
    method: 'POST',
    body: JSON.stringify(body),
  })

describe('POST /api/inbox/broadcasts/test-send', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    mocks.requireAuth.mockResolvedValue({ user: { id: '1', lineAccountId: 3 } })
    mocks.findFirst.mockResolvedValue({ lineUserId: 'U-test', lineAccountId: 3 })
    mocks.push.mockResolvedValue({ success: true })
  })

  test('pushes flex-only messages to the chosen customer, links left as-is', async () => {
    const res = await POST(request({ customerId: 7, flexContents: [flex, flex] }))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ success: true, data: { totalMessages: 2 } })
    expect(mocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ id: 7, lineAccountId: 3 }) })
    )
    const [to, messages] = mocks.push.mock.calls[0]
    expect(to).toBe('U-test')
    expect(messages).toHaveLength(2)
    expect(messages[0]).toMatchObject({ type: 'flex', altText: 'ดีลใกล้หมดเวลา' })
  })

  test('rejects a body with neither an imagemap nor flex messages', async () => {
    const res = await POST(request({ customerId: 7 }))
    expect(res.status).toBe(400)
    expect(mocks.push).not.toHaveBeenCalled()
  })

  test('refuses a customer outside the caller account', async () => {
    mocks.findFirst.mockResolvedValue(null)
    const res = await POST(request({ customerId: 7, flexContents: [flex] }))
    expect(res.status).toBe(404)
    expect(mocks.push).not.toHaveBeenCalled()
  })
})
