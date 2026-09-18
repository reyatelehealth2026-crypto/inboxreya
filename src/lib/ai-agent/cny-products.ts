export type AiPromoCampaignType = 'flash_sale' | 'promotion' | 'bestseller' | 'new_arrival' | 'product_catalog'

export interface NormalizedCnyProduct {
  productId: number
  sku: string
  barcode: string
  name: string
  nameEn: string
  specName: string
  imageUrl: string | null
  unitLabel: string
  basePrice: number
  promotionPrice: number | null
  stock: number
  isPromotion: boolean
  isBestseller: boolean
  productUrl: string
}

export const DEFAULT_CNY_PRODUCT_API_URL =
  'https://www.cnypharmacy.com/api/getDataProductIsGroup?page=1&sort_product_name=asc&sort_product_sku=&isPageGroup=&paginate_num=100&search_barcode=&product_sub_type=&supplier=0&see_query=0&new_sort_type=0'

const CNY_MANAGER_BASE_URL = 'https://manager.cnypharmacy.com'
const CNY_STORE_BASE_URL = 'https://www.cnypharmacy.com'

function asArray(value: unknown): any[] {
  return Array.isArray(value) ? value : []
}

function firstObject(value: unknown): Record<string, any> {
  const first = asArray(value)[0]
  return first && typeof first === 'object' ? first : {}
}

function toNumber(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  if (typeof value === 'string') {
    const parsed = Number(value.replace(/[^\d.-]/g, ''))
    return Number.isFinite(parsed) ? parsed : 0
  }
  return 0
}

function normalizeImageUrl(photoPath: unknown): string | null {
  if (typeof photoPath !== 'string' || !photoPath.trim()) return null
  const path = photoPath.trim()
  if (path.startsWith('http://') || path.startsWith('https://')) return path
  return `${CNY_MANAGER_BASE_URL}/${path.replace(/^\/+/, '')}`
}

function getBestPrice(row: Record<string, any>) {
  const priceGroups = asArray(row.product_price)
  const prices = priceGroups.flatMap((group) => asArray(group?.product_price))
  const firstPrice = prices.find((price) => toNumber(price?.price) > 0) || prices[0] || {}
  const basePrice = toNumber(firstPrice.price)
  const promo = toNumber(firstPrice.promotion_price)
  return {
    basePrice,
    promotionPrice: promo > 0 && promo < basePrice ? promo : null,
  }
}

function getPrimaryUnit(row: Record<string, any>, priceUnitId?: unknown) {
  const units = asArray(row.product_unit)
  const matched = units.find((unit) => String(unit.id) === String(priceUnitId))
  const unit = matched || units[0] || {}
  return typeof unit.unit === 'string' ? unit.unit : ''
}

function getStock(row: Record<string, any>) {
  return asArray(row.product_stock).reduce((sum, lot) => sum + toNumber(lot?.stock_num), 0)
}

export function normalizeCnyProducts(payload: unknown): NormalizedCnyProduct[] {
  const root = payload && typeof payload === 'object' ? payload as Record<string, any> : {}
  return asArray(root.product)
    .map((row) => {
      const data = firstObject(row?.product_data)
      const photo = firstObject(row?.product_photo)
      const prices = asArray(row?.product_price).flatMap((group) => asArray(group?.product_price))
      const firstPrice = prices.find((price) => toNumber(price?.price) > 0) || prices[0] || {}
      const { basePrice, promotionPrice } = getBestPrice(row)
      const sku = String(data.sku || data.barcode || data.id || '').trim()
      const productId = Number(data.id || sku.replace(/\D/g, '')) || 0

      return {
        productId,
        sku,
        barcode: String(data.barcode || sku).trim(),
        name: String(data.name || data.name_en || '').trim(),
        nameEn: String(data.name_en || '').trim(),
        specName: String(data.spec_name || '').trim(),
        imageUrl: normalizeImageUrl(photo.photo_path),
        unitLabel: getPrimaryUnit(row, firstPrice.product_unit_id),
        basePrice,
        promotionPrice,
        stock: getStock(row),
        isPromotion: Number(data.is_promotion || 0) === 1 || promotionPrice !== null,
        isBestseller: Number(data.is_bestseller || 0) === 1,
        productUrl: `${CNY_STORE_BASE_URL}/product/${sku.replace(/\D+/g, '').padStart(4, '0')}`,
      }
    })
    .filter((product) => product.sku && product.name && product.basePrice > 0)
}

export async function fetchCnyProducts(url = process.env.CNY_PRODUCT_API_URL || DEFAULT_CNY_PRODUCT_API_URL) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json' },
    cache: 'no-store',
  })
  if (!response.ok) {
    throw new Error(`CNY product API failed (${response.status})`)
  }
  const payload = await response.json()
  return {
    products: normalizeCnyProducts(payload),
    sourceUrl: url,
  }
}

export function inferCampaignType(input: string | undefined): AiPromoCampaignType {
  const lower = (input || '').toLowerCase()
  if (lower.includes('flash')) return 'flash_sale'
  if (lower.includes('best') || lower.includes('ขายดี')) return 'bestseller'
  if (lower.includes('new') || lower.includes('สินค้าใหม่')) return 'new_arrival'
  if (lower.includes('catalog') || lower.includes('แคต')) return 'product_catalog'
  return 'promotion'
}

export function selectProductsForCampaign(
  products: NormalizedCnyProduct[],
  campaignType: AiPromoCampaignType,
  maxProducts = 6,
  filters?: { skuIncludes?: string[]; minStock?: number }
) {
  const minStock = filters?.minStock ?? 1
  const skuIncludes = filters?.skuIncludes?.map((sku) => sku.trim()).filter(Boolean) || []
  let candidates = products.filter((product) => product.stock >= minStock)

  if (skuIncludes.length > 0) {
    const wanted = new Set(skuIncludes)
    candidates = candidates.filter((product) => wanted.has(product.sku) || wanted.has(product.barcode))
  } else if (campaignType === 'flash_sale' || campaignType === 'promotion') {
    candidates = candidates.filter((product) => product.isPromotion || product.promotionPrice !== null)
  } else if (campaignType === 'bestseller') {
    candidates = candidates.filter((product) => product.isBestseller)
  }

  const sortByCampaign = (a: NormalizedCnyProduct, b: NormalizedCnyProduct) => {
    if (campaignType === 'flash_sale' || campaignType === 'promotion') {
      const aDiscount = (a.basePrice - (a.promotionPrice || a.basePrice)) / a.basePrice
      const bDiscount = (b.basePrice - (b.promotionPrice || b.basePrice)) / b.basePrice
      if (bDiscount !== aDiscount) return bDiscount - aDiscount
    }
    if (campaignType === 'bestseller' && a.isBestseller !== b.isBestseller) {
      return a.isBestseller ? -1 : 1
    }
    return b.stock - a.stock
  }

  const cap = Math.max(1, Math.min(maxProducts, 12))
  let result = [...candidates].sort(sortByCampaign)

  if (result.length < cap) {
    const have = new Set(result.map((p) => p.sku))
    const topUp = products
      .filter((product) => product.stock >= minStock && !have.has(product.sku))
      .sort(sortByCampaign)
    result = [...result, ...topUp]
  }

  return result.slice(0, cap)
}

