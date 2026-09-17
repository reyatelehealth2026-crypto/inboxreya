import { describe, it, expect } from 'vitest'
import {
  buildPromoMessages,
  buildDetailMessages,
  type ExportGlobalConfig,
  type ExportPreviewProduct,
} from '@/lib/flex-builder'

// Three things here are only wrong once they are on a customer's phone, in front of
// the whole follower list, with no way to unsend:
//   1. an offer date printed as a raw ISO timestamp,
//   2. a wholesale product linking to the other shop on www.cnypharmacy.com,
//   3. a hero image pointed at a URL that 404s.
// Each was live before the wholesale promo feed made the input shapes visible.

const config: ExportGlobalConfig = {
  template: 'flash_sale',
  title: 'Flash Sale',
  intro: '',
  footerText: '',
  ctaLabel: 'ดูสินค้า',
  theme: 'rose',
}

const product = (over: Partial<ExportPreviewProduct> = {}): ExportPreviewProduct => ({
  productId: 1,
  sku: '0090',
  name: 'สินค้าทดสอบ',
  imageUrl: 'https://example.test/p/0090.jpg',
  basePrice: 200,
  promotionPrice: 170,
  unitLabel: 'แผง',
  productUrl: 'https://wholesale.test/product/0090',
  ...over,
})

/** Every uri / image url / text string anywhere in a built payload. */
function collect(
  node: unknown,
  found = { uris: [] as string[], images: [] as string[], texts: [] as string[] }
) {
  if (!node || typeof node !== 'object') return found
  if (Array.isArray(node)) {
    node.forEach((child) => collect(child, found))
    return found
  }
  const obj = node as Record<string, unknown>
  if (obj.type === 'uri' && 'uri' in obj) found.uris.push(String(obj.uri))
  if (obj.type === 'image' && obj.url) found.images.push(String(obj.url))
  if (obj.type === 'text' && typeof obj.text === 'string') found.texts.push(obj.text)
  Object.values(obj).forEach((value) => collect(value, found))
  return found
}

describe('offer dates', () => {
  it('renders an ISO timestamp as a Thai date, not the raw string', () => {
    const messages = buildDetailMessages(
      [product({ offerStart: '2026-08-20T00:00:00.000Z', offerEnd: '2026-08-31T16:59:00.000Z' })],
      config,
      { maxCarousels: 4 }
    )

    const line = collect(messages).texts.find((text) => text.startsWith('เริ่ม'))
    expect(line).toBeDefined()
    expect(line).not.toContain('T00:00:00')
    expect(line).not.toContain('Z')
  })

  it('leaves a date that is already display text alone', () => {
    const messages = buildDetailMessages(
      [product({ offerStart: '20 ส.ค. 69', offerEnd: '31 ส.ค. 69' })],
      config,
      { maxCarousels: 4 }
    )

    expect(collect(messages).texts).toContain('เริ่ม 20 ส.ค. 69 — ถึง 31 ส.ค. 69')
  })
})

describe('product links', () => {
  it('never invents a link to the other shop for a wholesale send', () => {
    // The fallback builds www.cnypharmacy.com/product/<sku> — a different application
    // from the wholesale shop, which answers 200 for those paths too, so the wrong
    // link is indistinguishable from a right one. It also pads to four digits, so a
    // product with no sku became /product/0000.
    const items = [product({ productUrl: '' }), product({ productUrl: '', sku: '' })]
    const wholesale = { ...config, allowRetailUrlFallback: false }

    for (const messages of [
      buildPromoMessages(items, wholesale, { productsPerBubble: 6, maxCarousels: 3 }),
      buildDetailMessages(items, wholesale, { maxCarousels: 4 }),
    ]) {
      const uris = collect(messages).uris
      expect(uris.some((uri) => uri.includes('cnypharmacy.com/product/'))).toBe(false)
      // An empty uri is rejected by LINE and nulled by sanitizeFlexActionUris(),
      // so "no link" has to mean the action is absent entirely.
      expect(uris.every((uri) => /^https?:\/\//.test(uri))).toBe(true)
    }
  })

  it('keeps the SKU fallback for the catalogue tabs, whose products live there', () => {
    const messages = buildDetailMessages([product({ productUrl: '' })], config, { maxCarousels: 4 })
    expect(collect(messages).uris).toContain('https://www.cnypharmacy.com/product/0090')
  })
})

describe('missing product photo', () => {
  it('omits the hero instead of pointing at a placeholder that 404s', () => {
    const messages = buildDetailMessages([product({ imageUrl: null })], config, { maxCarousels: 4 })

    expect(collect(messages).images.some((url) => url.includes('placeholder.jpg'))).toBe(false)
    const bubbles = (messages[0] as { contents: { contents: Array<Record<string, unknown>> } })
      .contents.contents
    expect(bubbles[bubbles.length - 1].hero).toBeUndefined()
  })

  it('keeps a grid row aligned with a blank block', () => {
    const messages = buildPromoMessages([product({ imageUrl: null }), product()], config, {
      productsPerBubble: 6,
      maxCarousels: 3,
    })

    expect(collect(messages).images.some((url) => url.includes('placeholder.jpg'))).toBe(false)
    expect(JSON.stringify(messages)).toContain('#F1F5F9')
  })
})
