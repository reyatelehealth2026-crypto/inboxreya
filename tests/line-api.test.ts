import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  findFirst: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  default: {
    lineAccount: {
      findUnique: mocks.findUnique,
      findFirst: mocks.findFirst,
    },
  },
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: mocks.warn,
    error: mocks.error,
  },
}))

describe('pushLineMessage', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.findUnique.mockResolvedValue({ channelAccessToken: 'line-token' })
    mocks.findFirst.mockResolvedValue(null)
    global.fetch = vi.fn().mockResolvedValue({ ok: true }) as any
  })

  test('removes unsupported generated Flex style fields before pushing to LINE', async () => {
    const { pushLineMessage } = await import('@/lib/line-api')

    await pushLineMessage('U123', [{
      type: 'flex',
      altText: 'promo',
      contents: {
        type: 'bubble',
        header: {
          type: 'box',
          layout: 'vertical',
          contents: [{ type: 'text', text: 'Promo', opacity: 0.7 }],
        },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [{ type: 'button', action: { type: 'uri', label: 'Open', uri: 'https://example.com' }, cornerRadius: 'md' }],
        },
      },
    }], 3)

    const body = JSON.parse((global.fetch as any).mock.calls[0][1].body)
    expect(JSON.stringify(body)).not.toContain('opacity')
    expect(JSON.stringify(body)).not.toContain('cornerRadius')
    expect(body.messages[0].contents.header.contents[0]).toEqual({ type: 'text', text: 'Promo' })
    expect(body.messages[0].contents.footer.contents[0]).toEqual({
      type: 'button',
      action: { type: 'uri', label: 'Open', uri: 'https://example.com' },
    })
  })
})
