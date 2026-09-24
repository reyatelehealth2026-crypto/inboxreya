// @vitest-environment node
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendPlatformMessage } from './php-bridge'

const okJson = (body: unknown) =>
  new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })

describe('sendPlatformMessage', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    process.env.PHP_API_URL = 'https://php.test'
    vi.stubGlobal('fetch', fetchMock)
    fetchMock.mockReset()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('retries once when the connection to PHP fails before the request is sent', async () => {
    fetchMock
      .mockRejectedValueOnce(new TypeError('fetch failed'))
      .mockResolvedValueOnce(okJson({ success: true, lineMessageId: '1' }))

    const res = await sendPlatformMessage({ userId: '1', message: 'hi', platform: 'line' })

    expect(res.success).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not retry an HTTP error (PHP may already have pushed to LINE)', async () => {
    fetchMock.mockResolvedValueOnce(new Response('LINE API Error: quota', { status: 500 }))

    const res = await sendPlatformMessage({ userId: '1', message: 'hi', platform: 'line' })

    expect(res.success).toBe(false)
    expect(res.error).toContain('500')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('reports the failure (with cause code) when the connection keeps failing', async () => {
    const err = new TypeError('fetch failed')
    ;(err as { cause?: unknown }).cause = { code: 'ECONNREFUSED' }
    fetchMock.mockRejectedValue(err)

    const res = await sendPlatformMessage({ userId: '1', message: 'hi', platform: 'line' })

    expect(res.success).toBe(false)
    expect(res.error).toBe('fetch failed (ECONNREFUSED)')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
