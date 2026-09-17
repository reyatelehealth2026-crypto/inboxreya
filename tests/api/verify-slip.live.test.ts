import { POST } from '@/app/api/inbox/verify-slip/route'
import { readFile } from 'node:fs/promises'
import { createServer, type Server } from 'node:http'
import { extname } from 'node:path'
import { afterAll, beforeAll, describe, expect, test, vi } from 'vitest'

/**
 * Live check against the real slip-c API — opt-in, so `npm test` never hits the
 * network. Everything except `auth()` is real: the route downloads the image over
 * HTTP, base64-encodes it and calls https://slip-c.oiio.download itself.
 *
 *   SLIP_C_LIVE=1 npx vitest run tests/api/verify-slip.live.test.ts
 *   SLIP_C_LIVE=1 SLIP_C_LIVE_IMAGE=./slip.jpg npx vitest run tests/api/verify-slip.live.test.ts
 *
 * With the default image (a repo icon, no QR) slip-c must answer `qr-not-found`.
 * Point SLIP_C_LIVE_IMAGE at a real slip to exercise the success path.
 * Never logs payer names or account numbers.
 */
const LIVE = process.env.SLIP_C_LIVE === '1'
const IMAGE_PATH = process.env.SLIP_C_LIVE_IMAGE || 'public/icons/icon-192x192.png'
/** Set to exercise the QR fast path; a wrong value proves the fallback. */
const AMOUNT = process.env.SLIP_C_LIVE_AMOUNT

const MIME: Record<string, string> = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
}

vi.mock('@/lib/auth', () => ({
  auth: async () => ({ user: { id: 'live-test' } }),
}))

describe.skipIf(!LIVE)('POST /api/inbox/verify-slip — live slip-c call', () => {
  let server: Server
  let imageUrl: string

  beforeAll(async () => {
    const bytes = await readFile(IMAGE_PATH)
    const contentType = MIME[extname(IMAGE_PATH).toLowerCase()] || 'image/jpeg'

    server = createServer((_req, res) => {
      res.writeHead(200, { 'Content-Type': contentType })
      res.end(bytes)
    })

    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
    const address = server.address()
    if (!address || typeof address === 'string') throw new Error('failed to start test server')
    imageUrl = `http://127.0.0.1:${address.port}/slip${extname(IMAGE_PATH)}`
  })

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()))
  })

  test('returns a usable answer for a real slip-c round trip', async () => {
    const startedAt = Date.now()
    const response = await POST({
      json: async () => ({ imageUrl, amount: AMOUNT ? Number(AMOUNT) : undefined }),
    } as never)
    const json = await response.json()

    console.log(`[live] amount sent: ${AMOUNT ?? '(none)'} — took ${((Date.now() - startedAt) / 1000).toFixed(1)}s`)
    expect(response.status).toBe(200)

    if (!json.verified) {
      console.log('[live] not verified:', { slug: json.status, error: json.error })
      // A non-slip image must come back as a mapped error, never as a crash.
      expect(typeof json.error).toBe('string')
      expect(json.error.length).toBeGreaterThan(0)
      return
    }

    console.log('[live] verified:', {
      amount: json.data.amount,
      transRef: json.data.transRef,
      transDate: json.data.transDate,
      transTime: json.data.transTime,
      sendingBankName: json.data.sendingBankName,
      receivingBankName: json.data.receivingBankName,
      warnings: json.warnings.map((w: { type: string }) => w.type),
    })

    expect(json.success).toBe(true)
    expect(typeof json.data.amount).toBe('number')
    expect(json.data.transRef).not.toBe('')
    expect(json.data.transDate).toMatch(/^\d{8}$/)
    expect(json.data.transTime).toMatch(/^\d{2}:\d{2}:\d{2}$/)
    // Room for both slip-c calls when the QR path misses and it falls back.
  }, 180_000)
})
