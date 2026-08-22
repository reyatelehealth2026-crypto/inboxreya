import { describe, expect, it } from 'vitest'
import { firstOkCall, type SlipCCall } from './slip-verify'

/**
 * `firstOkCall` decides which of the two racing slip-c calls wins, so getting it
 * wrong either reports a genuine slip as invalid (QR's 404 beating OCR's answer)
 * or hangs the request. These cases pin the outcomes that matter.
 */

function call(ok: boolean, ref: string, delayMs = 0): Promise<SlipCCall | null> {
  const value = { res: { ok } as Response, data: { ref } }
  return new Promise((resolve) => setTimeout(() => resolve(value), delayMs))
}

describe('firstOkCall', () => {
  it('returns the first ok call without waiting for the slower one', async () => {
    const startedAt = Date.now()
    const winner = await firstOkCall([call(true, 'fast', 5), call(true, 'slow', 400)])

    expect(winner?.data.ref).toBe('fast')
    // Proves it resolved on the fast call rather than awaiting both.
    expect(Date.now() - startedAt).toBeLessThan(300)
  })

  it('waits past an early failure for a later ok call', async () => {
    // The QR endpoint answering 404 in 10ms must not beat OCR reading the slip.
    const winner = await firstOkCall([call(false, 'qr-404', 10), call(true, 'ocr-ok', 120)])

    expect(winner?.data.ref).toBe('ocr-ok')
  })

  it('falls back to the first failure when nothing succeeds', async () => {
    const winner = await firstOkCall([call(false, 'qr-404', 10), call(false, 'ocr-500', 40)])

    expect(winner?.res.ok).toBe(false)
    expect(winner?.data.ref).toBe('qr-404')
  })

  it('resolves to null when every task rejects or returns null', async () => {
    const rejected: Promise<SlipCCall | null> = Promise.reject(new Error('timeout'))
    // Attach a no-op handler so the rejection is never unhandled.
    rejected.catch(() => {})

    const winner = await firstOkCall([rejected, Promise.resolve(null)])

    expect(winner).toBeNull()
  })
})
