import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'

// The seam this guards: the wholesale feed publishes items already in
// ExportPreviewProduct shape, so a schema that quietly rejects the real payload
// would show staff an empty promo tab with no error to explain it.
vi.mock('@/lib/auth-middleware', () => ({
  requireAuth: vi.fn(async () => ({ user: { id: '1', lineAccountId: 3 } })),
}))

import { GET } from '@/app/api/inbox/catalog/wholesale-promos/route'

// Shaped exactly like the live feed's documented response, with synthetic values.
const feed = {
  generatedAt: '2026-08-25T11:00:00.000Z',
  siteUrl: 'https://wholesale.test',
  priceLevelId: 3,
  groups: [
    {
      key: 'flash_sale',
      label: 'Flash Sale',
      template: 'flash_sale',
      endsAt: '2026-08-31T16:59:00.000Z',
      items: [
        {
          productId: 1234,
          sku: '0090',
          name: 'สินค้าทดสอบ ก',
          imageUrl: 'https://assets.test/p/0090.jpg',
          basePrice: 200,
          promotionPrice: 170,
          unitLabel: 'แผง',
          promoLine1: 'ลด 15%',
          offerStart: '2026-08-20T00:00:00.000Z',
          offerEnd: '2026-08-31T16:59:00.000Z',
          productUrl: 'https://wholesale.test/product/0090',
          ribbonText: 'FLASH SALE',
        },
        // No image and no discount: both legal, and both must survive.
        {
          productId: 2345,
          sku: '0132',
          name: 'สินค้าทดสอบ ข',
          imageUrl: null,
          basePrice: 120,
          promotionPrice: null,
          unitLabel: 'กล่อง',
          productUrl: 'https://wholesale.test/product/0132',
        },
        // No sku in the wholesale database, so the feed has no link to build. The
        // product is still a real promotion and must survive, buttonless.
        {
          productId: 3456,
          sku: '',
          name: 'สินค้าทดสอบ ค',
          imageUrl: null,
          basePrice: 250,
          promotionPrice: 199,
          productUrl: '',
        },
        // Relative link: would be nulled downstream and render a dead button.
        {
          productId: 4567,
          sku: '0055',
          name: 'สินค้าทดสอบ ง',
          imageUrl: null,
          basePrice: 90,
          promotionPrice: 80,
          productUrl: '/product/0055',
        },
      ],
    },
    // The campaign group: a giveaway is the offer, so there is no per-unit discount
    // on any of the 1324 rows in production, and product_price has no date columns
    // for the markdown group. Both shapes empty a whole group if the schema demands
    // a number and a date. The group is also far larger than the slice sent.
    {
      key: 'campaign',
      label: 'ซื้อครบแถมฟรี',
      template: 'promotion',
      endsAt: null,
      totalCount: 1324,
      items: [
        {
          productId: 5678,
          sku: '0132',
          name: 'สินค้าทดสอบ จ',
          imageUrl: null,
          basePrice: 120,
          promotionPrice: null,
          unitLabel: 'กล่อง',
          promoLine1: '',
          promoLine2: 'ซื้อ 3 แถม สินค้าแถม ก',
          productUrl: 'https://wholesale.test/product/0132',
          ribbonText: 'ซื้อครบแถมฟรี',
        },
      ],
    },
  ],
}

const call = () => GET(new NextRequest('http://localhost/api/inbox/catalog/wholesale-promos'))

beforeEach(() => {
  process.env.WHOLESALE_PROMO_FEED_URL = 'https://wholesale.test/api/promo-feed'
})

afterEach(() => {
  vi.unstubAllGlobals()
  delete process.env.WHOLESALE_PROMO_FEED_URL
})

describe('GET /api/inbox/catalog/wholesale-promos', () => {
  it('accepts the feed payload and keeps every valid item', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify(feed), { status: 200 })))

    const body = await (await call()).json()

    expect(body.success).toBe(true)
    expect(body.data.siteUrl).toBe('https://wholesale.test')
    const [flash, campaign] = body.data.groups

    // Links are moved onto the host broadcasts point at, path untouched: rebuilding
    // the path from the SKU is what mapped different products onto one page.
    expect(body.data.linkHost).toBe('https://www.cnypharmacy.com')
    expect(flash.items[0].productUrl).toBe('https://www.cnypharmacy.com/product/0090')
    expect(campaign.items[0].productUrl).toBe('https://www.cnypharmacy.com/product/0132')

    // Nothing is dropped: a missing image, a missing sku and an unusable link each
    // degrade to something the bubble can still show.
    expect(flash.template).toBe('flash_sale')
    expect(flash.items.map((item: { sku: string }) => item.sku)).toEqual(['0090', '0132', '', '0055'])
    expect(flash.items[1].imageUrl).toBeNull()
    expect(flash.droppedCount).toBe(0)
    // The relative link must not reach a bubble as a link, but its product stays.
    expect(flash.items[3].productUrl).toBe('')

    // A campaign gives a product away rather than discounting it, and the markdown
    // group has no dates at all — demanding a number or a date here emptied them.
    expect(campaign.items).toHaveLength(1)
    expect(campaign.items[0].promotionPrice).toBeNull()
    expect(campaign.items[0].offerEnd).toBeUndefined()
    expect(campaign.droppedCount).toBe(0)
    // Kept so the tab can say a slice is a slice instead of implying it is the lot.
    expect(campaign.totalCount).toBe(1324)
  })

  it('says which variable is missing instead of failing vaguely', async () => {
    delete process.env.WHOLESALE_PROMO_FEED_URL

    const response = await call()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.error).toContain('WHOLESALE_PROMO_FEED_URL')
  })

  it("passes through the feed's own reason when it refuses", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              statusCode: 503,
              statusMessage: 'promo-feed requires NUXT_PUBLIC_SITE_URL',
            }),
            { status: 503 }
          )
      )
    )

    const body = await (await call()).json()

    expect(body.success).toBe(false)
    expect(body.error).toContain('NUXT_PUBLIC_SITE_URL')
  })
})
