// @vitest-environment node
// Node env, not jsdom: jsdom's Blob/File lack arrayBuffer(), which the upload
// path (and this test's mock) both rely on for real binary image bytes.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { Jimp } from 'jimp'

const mocks = vi.hoisted(() => ({
  callPhpApiFormData: vi.fn(),
}))

vi.mock('@/lib/php-bridge', () => ({
  callPhpApiFormData: mocks.callPhpApiFormData,
}))

import { createImagemapImageSet, resolveImagemapUrls } from '@/lib/imagemap-images'
import { IMAGEMAP_SIZES } from '@/lib/imagemap-types'
import { signValue } from '@/lib/broadcast-link'
import { GET } from '@/app/api/imagemap/[key]/[size]/route'

const SECRET = 'test-secret-for-imagemap-images-tests'
const PHP_HOST = 'cny.re-ya.test'

let uploadedBuffers: Record<number, Buffer> = {}

beforeEach(() => {
  vi.clearAllMocks()
  uploadedBuffers = {}
  process.env.BROADCAST_LINK_SECRET = SECRET
  process.env.PHP_API_URL = `https://${PHP_HOST}`
  process.env.NEXT_PUBLIC_PHP_API_URL = `https://${PHP_HOST}`

  mocks.callPhpApiFormData.mockImplementation(async (_endpoint: string, formData: FormData) => {
    const file = formData.get('file') as File
    const match = file.name.match(/-(\d+)\./)
    const size = match ? Number(match[1]) : 0
    uploadedBuffers[size] = Buffer.from(await file.arrayBuffer())
    return { success: true, data: { mediaUrl: `https://${PHP_HOST}/uploads/${file.name}` } }
  })
})

afterEach(() => {
  delete process.env.BROADCAST_LINK_SECRET
  delete process.env.PHP_API_URL
  delete process.env.NEXT_PUBLIC_PHP_API_URL
  vi.unstubAllGlobals()
})

async function makeSourceBuffer(width: number, height: number) {
  const image = new Jimp({ width, height, color: 0xff0000ff })
  return image.getBuffer('image/png')
}

describe('createImagemapImageSet', () => {
  it('produces the 5 IMAGEMAP_SIZES widths and a baseKey that verifies back to 5 https urls', async () => {
    const source = await makeSourceBuffer(2000, 1000)
    const result = await createImagemapImageSet(source)

    expect(result.width).toBe(1040)
    expect(result.height).toBe(Math.round((1000 * 1040) / 2000))
    expect(mocks.callPhpApiFormData).toHaveBeenCalledTimes(IMAGEMAP_SIZES.length)

    for (const size of IMAGEMAP_SIZES) {
      const decoded = await Jimp.read(uploadedBuffers[size])
      expect(decoded.bitmap.width).toBe(size)
    }

    const urls = resolveImagemapUrls(result.baseKey)
    expect(urls).toHaveLength(IMAGEMAP_SIZES.length)
    urls!.forEach((u) => expect(u.startsWith('https://')).toBe(true))
  })

  it('rejects an image that is still too tall after scaling to width 1040', async () => {
    const source = await makeSourceBuffer(1040, 3000)
    await expect(createImagemapImageSet(source)).rejects.toThrow(/too tall/)
  })
})

describe('GET /api/imagemap/[key]/[size]', () => {
  const call = (key: string, size: string) =>
    GET(new NextRequest(`http://localhost/api/imagemap/${key}/${size}`), {
      params: Promise.resolve({ key, size }),
    })

  it('404s on an unknown size', async () => {
    const urls = IMAGEMAP_SIZES.map((s) => `https://${PHP_HOST}/uploads/imagemap-${s}.jpg`)
    const key = signValue(JSON.stringify(urls))

    const res = await call(key, '999')
    expect(res.status).toBe(404)
  })

  it('404s on a tampered/garbage key', async () => {
    const res = await call('not-a-real-key', '1040')
    expect(res.status).toBe(404)
  })

  it('404s when the signed key resolves to a foreign host', async () => {
    const urls = IMAGEMAP_SIZES.map((s) => `https://evil.example.com/imagemap-${s}.jpg`)
    const key = signValue(JSON.stringify(urls))

    const res = await call(key, '1040')
    expect(res.status).toBe(404)
  })

  it('serves the image with an immutable cache header on a valid key', async () => {
    const urls = IMAGEMAP_SIZES.map((s) => `https://${PHP_HOST}/uploads/imagemap-${s}.jpg`)
    const key = signValue(JSON.stringify(urls))

    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(Buffer.from([1, 2, 3]), {
            status: 200,
            headers: { 'content-type': 'image/jpeg' },
          })
      )
    )

    const res = await call(key, '1040')
    expect(res.status).toBe(200)
    expect(res.headers.get('cache-control')).toBe('public, max-age=31536000, immutable')
    expect(res.headers.get('content-type')).toBe('image/jpeg')
  })
})
