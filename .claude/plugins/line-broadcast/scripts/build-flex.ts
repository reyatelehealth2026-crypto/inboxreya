#!/usr/bin/env tsx
/**
 * build-flex.ts — Template-substitution Flex generator for the line-broadcast plugin.
 *
 * Produces Flex JSON that matches the production admin template field-by-field:
 *   - cover bubble (mega, themed bg, icon, title, count card, footer text, CTA)
 *   - per-product bubble (mega) with:
 *       hero image 4:3,
 *       "SPECIAL OFFER" badge (themed bg),
 *       SKU label,
 *       product name (≤3 lines),
 *       optional promo box (orange) when promoLine1/promoLine2 set,
 *       price + strike-through (when discounted),
 *       optional date range ("เริ่ม เริ่ม X — ถึง ถึง Y"),
 *       per-bubble CTA button → product URL
 *   - optional closing text message
 *
 * Bubble splitting: max 12 bubbles per carousel; carousel 1 reserves 1 slot
 * for the cover. Up to 5 messages total (LINE quota; one slot reserved for
 * closingText if set). So 47 products max with closingText, 59 without.
 *
 * Usage:
 *   echo '<payload>' | npx tsx .claude/plugins/line-broadcast/scripts/build-flex.ts > flex.json
 *
 * stdin payload — pick ONE source (products | cny):
 *   {
 *     "products": ExportPreviewProduct[],     // pre-mapped
 *     "cny":      <raw CNY API response>,      // OR raw {product:[...]} from cnypharmacy.com
 *
 *     // when cny is provided
 *     "theme":    "promotion"|"flash_sale"|"bestseller"|"new_arrival"|"product_catalog",
 *     "keywords": string?,
 *     "skus":     string[]?,
 *     "limit":    number?,
 *
 *     // copy fields (all optional — sensible defaults per theme)
 *     "title":      string?,    // admin-selected
 *     "intro":      string?,
 *     "countLabel": string?,    // e.g. "รายการสินค้าพร้อมรายละเอียด"
 *     "footerText": string?,
 *     "ctaLabel":   string?,    // admin-selected
 *     "actionUrl":  string?,    // cover CTA target
 *     "badgeText":  string?,    // default "SPECIAL OFFER"
 *     "closingText": string?
 *   }
 */

import type { ExportPreviewProduct, FlexMessageTemplate } from '../../../../src/lib/flex-builder'

const CNY_BASE = 'https://www.cnypharmacy.com'
const CNY_IMG_BASE = 'https://manager.cnypharmacy.com'
const PLACEHOLDER_IMG = `${CNY_IMG_BASE}/uploads/product_photo/placeholder.jpg`
const MAX_BUBBLES_PER_CAROUSEL = 12
const MAX_MESSAGES = 5

type Theme = FlexMessageTemplate

const THEME_COLORS: Record<Theme, string> = {
  promotion: '#E53E3E',
  flash_sale: '#D69E2E',
  bestseller: '#15803D',
  new_arrival: '#805AD5',
  product_catalog: '#4299E1',
}

const THEME_ICONS: Record<Theme, string> = {
  promotion: '🔥',
  flash_sale: '⚡',
  bestseller: '🏆',
  new_arrival: '✨',
  product_catalog: '🛍️',
}

const THEME_DEFAULTS: Record<Theme, { title: string; intro: string }> = {
  promotion: {
    title: 'โปรโมชันพิเศษ',
    intro: 'รวมสินค้าราคาพิเศษ คัดมาให้พร้อมโปรเด่น',
  },
  flash_sale: {
    title: 'Flash Sale',
    intro: 'สินค้าจำนวนจำกัด รีบสั่งก่อนหมด',
  },
  bestseller: {
    title: 'สินค้าขายดี',
    intro: 'รวมสินค้ายอดนิยมที่คนซื้อเยอะที่สุด',
  },
  new_arrival: {
    title: 'สินค้าใหม่',
    intro: 'มาใหม่! สินค้าน่าสนใจคัดสรรมาให้',
  },
  product_catalog: {
    title: 'แคตตาล็อคสินค้า',
    intro: 'สินค้าหลากหลายแบบให้เลือก',
  },
}

// ── Filter/Map helpers (raw CNY response → ExportPreviewProduct[]) ────────

interface CnyProductDataInner {
  id: number
  sku: string
  name: string
  name_en?: string
  spec_name?: string
  barcode?: string
  is_recommend?: number
  is_promotion?: number
  is_bestseller?: number
}

interface CnyPriceInner {
  price?: string | number
  promotion_price?: string | number
  buy_min?: number
}

interface CnyProductItem {
  product_data?: CnyProductDataInner[]
  product_photo?: Array<{ photo_path?: string }>
  product_unit?: Array<{ unit?: string }>
  product_price?: Array<{ product_price?: CnyPriceInner[] }>
  product_stock?: Array<{ stock_num?: string | number }>
  product_is_flashSale?: number
  product_is_recommend?: number
  customer_buyed?: number
  is_rx?: number
}

interface CnyResponse {
  product?: CnyProductItem[]
}

function toNumber(v: string | number | undefined | null): number {
  if (v === null || v === undefined) return 0
  const n = typeof v === 'number' ? v : Number(v)
  return Number.isFinite(n) ? n : 0
}

function hasStock(item: CnyProductItem): boolean {
  const s = item.product_stock
  if (!s || s.length === 0) return false
  return s.some((x) => toNumber(x.stock_num) > 0)
}

function matchesTheme(item: CnyProductItem, theme: Theme): boolean {
  const data = item.product_data?.[0]
  if (!data) return false
  const pi = item.product_price?.[0]?.product_price?.[0]
  switch (theme) {
    case 'flash_sale': {
      const isFlash = item.product_is_flashSale === 1 || data.is_promotion === 1
      if (!isFlash) return false
      const base = toNumber(pi?.price)
      const promo = toNumber(pi?.promotion_price)
      return promo > 0 && promo < base
    }
    case 'promotion':
      return data.is_promotion === 1
    case 'bestseller':
      return data.is_bestseller === 1 || (item.customer_buyed ?? 0) > 0
    case 'new_arrival':
      return item.product_is_recommend === 1 || data.is_recommend === 1
    case 'product_catalog':
    default:
      return true
  }
}

function matchesKeywords(item: CnyProductItem, keywords?: string): boolean {
  if (!keywords) return true
  const d = item.product_data?.[0]
  if (!d) return false
  const hay = [d.name, d.name_en, d.barcode, d.sku, d.spec_name].filter(Boolean).join(' ').toLowerCase()
  return hay.includes(keywords.toLowerCase())
}

function matchesSkus(item: CnyProductItem, skus?: string[]): boolean {
  if (!skus || skus.length === 0) return true
  const sku = item.product_data?.[0]?.sku
  return sku ? skus.includes(sku) : false
}

function mapItemToPreviewProduct(item: CnyProductItem): ExportPreviewProduct | null {
  const data = item.product_data?.[0]
  if (!data) return null
  const photo = item.product_photo?.[0]?.photo_path ?? null
  const pi = item.product_price?.[0]?.product_price?.[0]
  const basePrice = toNumber(pi?.price)
  const promoRaw = toNumber(pi?.promotion_price)
  const promotionPrice = promoRaw > 0 && promoRaw < basePrice ? promoRaw : null
  const unit = item.product_unit?.[0]?.unit ?? ''
  const buyMin = pi?.buy_min ?? 0
  return {
    productId: data.id,
    sku: data.sku,
    name: data.name,
    imageUrl: photo ? `${CNY_IMG_BASE}/${photo}` : null,
    basePrice,
    promotionPrice,
    unitLabel: unit,
    quantity: buyMin > 1 ? buyMin : 1,
    productUrl: data.sku ? `${CNY_BASE}/product/${data.sku}` : undefined,
    isPrescription: item.is_rx === 1,
    ribbonText:
      item.product_is_flashSale === 1 || data.is_promotion === 1
        ? 'PROMOTION'
        : data.is_bestseller === 1
          ? 'BESTSELLER'
          : data.is_recommend === 1 || item.product_is_recommend === 1
            ? 'NEW'
            : '',
  }
}

function selectProductsForCampaign(
  items: CnyProductItem[],
  opts: { theme: Theme; keywords?: string; skus?: string[]; cap: number }
): CnyProductItem[] {
  const filteredByText = items.filter(
    (it) => matchesKeywords(it, opts.keywords) && matchesSkus(it, opts.skus)
  )
  const primary = filteredByText.filter((it) => matchesTheme(it, opts.theme))
  if (primary.length >= opts.cap) return primary.slice(0, opts.cap)
  const primaryIds = new Set(primary.map((it) => it.product_data?.[0]?.id).filter(Boolean))
  const topUp = filteredByText.filter((it) => {
    const id = it.product_data?.[0]?.id
    if (!id || primaryIds.has(id)) return false
    return hasStock(it) || (it.product_stock?.length ?? 0) === 0
  })
  return [...primary, ...topUp].slice(0, opts.cap)
}

// ── Template builders ────────────────────────────────────────────

function formatPrice(value: number, unit?: string): string {
  const unitStr = unit ? ` / ${unit}` : ''
  return `฿${value.toFixed(2)}${unitStr}`
}

function formatDate(input: string): string {
  // Normalise to DD-MM-YYYY
  const d = new Date(input)
  if (!Number.isNaN(d.getTime())) {
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`
  }
  return input
}

interface CoverOpts {
  theme: Theme
  title: string
  intro: string
  productsCount: number
  countLabel: string
  footerText: string
  ctaLabel: string
  actionUrl: string
}

function buildCoverBubble(opts: CoverOpts): object {
  const color = THEME_COLORS[opts.theme]
  const icon = THEME_ICONS[opts.theme]
  return {
    type: 'bubble',
    size: 'mega',
    styles: {
      body: { backgroundColor: color },
      footer: { backgroundColor: color },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        { type: 'text', text: icon, size: '3xl', align: 'center' },
        { type: 'text', text: opts.title, size: 'xl', weight: 'bold', color: '#FFFFFF', align: 'center', wrap: true },
        { type: 'text', text: opts.intro, size: 'sm', color: '#FFFFFF', align: 'center', wrap: true, margin: 'md' },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: 'rgba(255,255,255,0.25)',
          cornerRadius: '12px',
          paddingAll: '12px',
          margin: 'lg',
          contents: [
            { type: 'text', text: String(opts.productsCount), size: '3xl', weight: 'bold', color: '#FFFFFF', align: 'center' },
            { type: 'text', text: opts.countLabel, size: 'xs', color: '#FFFFFF', align: 'center' },
          ],
        },
        { type: 'text', text: opts.footerText, size: 'xs', color: '#FFFFFF', align: 'center', wrap: true, margin: 'md' },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: color,
          action: { type: 'uri', label: opts.ctaLabel, uri: opts.actionUrl },
        },
      ],
    },
  }
}

interface ProductBubbleOpts {
  theme: Theme
  product: ExportPreviewProduct
  ctaLabel: string
  badgeText: string
}

function buildProductBubble(opts: ProductBubbleOpts): object {
  const p = opts.product
  const color = THEME_COLORS[opts.theme]
  const productUrl = p.productUrl || `${CNY_BASE}/product/${p.sku}`
  const salePrice = p.promotionPrice ?? p.basePrice
  const hasDiscount =
    p.promotionPrice !== null && p.promotionPrice !== undefined && p.basePrice > p.promotionPrice
  const promoLines = [p.promoLine1, p.promoLine2].filter(
    (s): s is string => Boolean(s && s.trim())
  )
  const dateRange =
    p.offerStart && p.offerEnd
      ? `เริ่ม เริ่ม ${formatDate(p.offerStart)} — ถึง ถึง ${formatDate(p.offerEnd)}`
      : null

  const bodyContents: object[] = [
    // Badge row
    {
      type: 'box',
      layout: 'horizontal',
      spacing: 'xs',
      contents: [
        {
          type: 'box',
          layout: 'vertical',
          flex: 0,
          backgroundColor: color,
          cornerRadius: '10px',
          paddingAll: '5px',
          contents: [
            { type: 'text', text: opts.badgeText, size: 'xxs', weight: 'bold', color: '#FFFFFF' },
          ],
        },
      ],
    },
    // SKU
    { type: 'text', text: `SKU ${p.sku}`, size: 'xxs', color: '#64748B' },
    // Name
    { type: 'text', text: p.name, size: 'sm', weight: 'bold', color: '#0F172A', wrap: true, maxLines: 3 },
  ]

  if (promoLines.length > 0) {
    bodyContents.push({
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#FFF7ED',
      cornerRadius: '10px',
      paddingAll: '8px',
      contents: promoLines.map((line) => ({
        type: 'text',
        text: line,
        size: 'xxs',
        color: '#C2410C',
        wrap: true,
      })),
    })
  }

  const priceContents: object[] = [
    {
      type: 'text',
      text: formatPrice(salePrice, p.unitLabel),
      size: 'lg',
      weight: 'bold',
      color: color,
      wrap: true,
    },
  ]
  if (hasDiscount) {
    priceContents.push({
      type: 'text',
      text: formatPrice(p.basePrice, p.unitLabel),
      size: 'xs',
      color: '#94A3B8',
      decoration: 'line-through',
    })
  }
  bodyContents.push({
    type: 'box',
    layout: 'vertical',
    spacing: 'xs',
    contents: priceContents,
  })

  if (dateRange) {
    bodyContents.push({
      type: 'text',
      text: dateRange,
      size: 'xxs',
      color: '#94A3B8',
      wrap: true,
    })
  }

  return {
    type: 'bubble',
    size: 'mega',
    hero: {
      type: 'image',
      url: p.imageUrl || PLACEHOLDER_IMG,
      size: 'full',
      aspectMode: 'cover',
      aspectRatio: '4:3',
      action: { type: 'uri', uri: productUrl },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      paddingAll: '12px',
      contents: bodyContents,
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: color,
          action: { type: 'uri', label: opts.ctaLabel, uri: productUrl },
        },
      ],
    },
  }
}

function splitIntoCarousels(
  cover: object,
  productBubbles: object[],
  maxCarousels: number,
  altText: string
): object[] {
  const messages: object[] = []
  let cursor = 0
  for (let i = 0; i < maxCarousels; i++) {
    const isFirst = i === 0
    const slots = MAX_BUBBLES_PER_CAROUSEL - (isFirst ? 1 : 0)
    if (!isFirst && cursor >= productBubbles.length) break
    const chunk = productBubbles.slice(cursor, cursor + slots)
    cursor += chunk.length
    const carouselContents = isFirst ? [cover, ...chunk] : chunk
    messages.push({
      type: 'flex',
      altText,
      contents: { type: 'carousel', contents: carouselContents },
    })
    if (chunk.length < slots) break
  }
  return messages
}

// ── Main ─────────────────────────────────────────────────────────

interface Payload {
  products?: ExportPreviewProduct[]
  cny?: CnyResponse
  theme?: Theme
  keywords?: string
  skus?: string[]
  limit?: number
  title?: string
  intro?: string
  countLabel?: string
  footerText?: string
  ctaLabel?: string
  actionUrl?: string
  badgeText?: string
  closingText?: string
}

async function readStdin(): Promise<string> {
  const chunks: Buffer[] = []
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  return Buffer.concat(chunks).toString('utf8')
}

function fail(msg: string, code = 1): never {
  process.stderr.write(`build-flex: ${msg}\n`)
  process.exit(code)
}

async function main(): Promise<void> {
  const raw = (await readStdin()).trim()
  if (!raw) fail('empty stdin — pipe a JSON payload')

  let payload: Payload
  try {
    payload = JSON.parse(raw) as Payload
  } catch (e) {
    fail(`invalid JSON on stdin: ${(e as Error).message}`)
  }

  const theme: Theme = payload.theme ?? 'promotion'

  // Resolve products
  let products: ExportPreviewProduct[]
  if (payload.products && payload.products.length > 0) {
    products = payload.products
  } else if (payload.cny?.product && payload.cny.product.length > 0) {
    const cap = Math.min(Math.max(1, payload.limit ?? 6), 47)
    const selected = selectProductsForCampaign(payload.cny.product, {
      theme,
      keywords: payload.keywords,
      skus: payload.skus,
      cap,
    })
    products = selected
      .map(mapItemToPreviewProduct)
      .filter((p): p is ExportPreviewProduct => p !== null)
    if (products.length === 0) {
      fail(`no products matched theme=${theme}${payload.keywords ? ` keywords="${payload.keywords}"` : ''}`)
    }
  } else {
    fail('payload must include either "products" array or "cny" raw response')
  }

  const defaults = THEME_DEFAULTS[theme]
  const title = payload.title ?? defaults.title
  const intro = payload.intro ?? defaults.intro
  const countLabel = payload.countLabel ?? 'รายการสินค้าพร้อมรายละเอียด'
  const footerText = payload.footerText ?? 'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย'
  const ctaLabel = payload.ctaLabel ?? 'ซื้อเลย'
  const actionUrl = payload.actionUrl ?? CNY_BASE
  const badgeText = payload.badgeText ?? 'SPECIAL OFFER'

  // Build pieces
  const cover = buildCoverBubble({
    theme,
    title,
    intro,
    productsCount: products.length,
    countLabel,
    footerText,
    ctaLabel,
    actionUrl,
  })

  const productBubbles = products.map((p) =>
    buildProductBubble({ theme, product: p, ctaLabel, badgeText })
  )

  // Reserve slots
  const reservedForClosing = payload.closingText?.trim() ? 1 : 0
  const maxCarousels = MAX_MESSAGES - reservedForClosing

  const messages = splitIntoCarousels(cover, productBubbles, maxCarousels, title)

  if (payload.closingText?.trim()) {
    messages.push({ type: 'text', text: payload.closingText.trim() })
  }

  if (messages.length === 0) fail('no messages generated')
  if (messages.length > MAX_MESSAGES) {
    fail(`generated ${messages.length} messages — exceeds LINE quota of ${MAX_MESSAGES}`)
  }

  process.stdout.write(JSON.stringify(messages))
  process.stdout.write('\n')
}

main().catch((e) => fail((e as Error).message))
