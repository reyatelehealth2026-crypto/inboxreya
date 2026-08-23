import { afterEach, describe, expect, it, vi } from 'vitest'
import { Jimp } from 'jimp'
import { fetchSlipImage } from './slip-verify'

/**
 * Regression cover for `fetchSlipImage`'s size decision.
 *
 * Measured against real customer slips: re-encoding is not automatically a win.
 * A 1074x1320 slip shrank 302KB→222KB, but an already-tight 720x1280 one GREW
 * 61KB→95KB — the "optimisation" was costing 55% more upload on exactly the
 * images that were cheapest to begin with. These cases pin both directions.
 */

async function jpegOf(width: number, height: number, quality: number) {
  // Noise, not flat colour: a flat image compresses to almost nothing and would
  // make every size comparison meaningless.
  const image = new Jimp({ width, height, color: 0xffffffff })
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      image.setPixelColor(((x * 2654435761 + y * 40503) >>> 8) | 0xff, x, y)
    }
  }
  return image.getBuffer('image/jpeg', { quality })
}

function mockFetchReturning(buffer: Buffer) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => ({
      ok: true,
      headers: { get: () => 'image/jpeg' },
      arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength),
    }))
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchSlipImage size decision', () => {
  it('never returns more bytes than a small, already-compressed slip', async () => {
    // Well under the 1400px cap and encoded harder than our own quality setting.
    const original = await jpegOf(720, 1280, 45)
    mockFetchReturning(original)

    const result = await fetchSlipImage('https://example.test/small.jpg')

    expect(result).not.toBeNull()
    expect(result!.buffer.length).toBeLessThanOrEqual(original.length)
  }, 30_000)

  it('re-encodes an under-cap slip when that genuinely saves bytes', async () => {
    // Same pixel budget, but stored at a much higher quality than we need.
    const original = await jpegOf(1074, 1320, 100)
    mockFetchReturning(original)

    const result = await fetchSlipImage('https://example.test/roomy.jpg')

    expect(result!.buffer.length).toBeLessThan(original.length)
  }, 30_000)

  it('downscales an oversized slip', async () => {
    const original = await jpegOf(2400, 3200, 90)
    mockFetchReturning(original)

    const result = await fetchSlipImage('https://example.test/huge.jpg')

    const decoded = await Jimp.read(result!.buffer)
    expect(Math.max(decoded.bitmap.width, decoded.bitmap.height)).toBeLessThanOrEqual(1400)
  }, 30_000)
})
