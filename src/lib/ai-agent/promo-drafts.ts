import { buildBroadcastEnvelope } from '@/lib/broadcast-runtime'
import { buildFlexPayload, type ExportPreviewProduct, type FlexMessageTemplate } from '@/lib/flex-builder'
import { generateAiText } from '@/lib/ai'
import {
  type AiPromoCampaignType,
  type NormalizedCnyProduct,
  inferCampaignType,
  selectProductsForCampaign,
} from './cny-products'

export interface GeneratedPromoDraft {
  campaignType: AiPromoCampaignType
  selectedProducts: NormalizedCnyProduct[]
  generatedCopy: string
  flexJson: Record<string, unknown>
  proposedScheduledAt: Date | null
  status: 'draft' | 'needs_review'
  errorMessage?: string
}

const CAMPAIGN_TITLE: Record<AiPromoCampaignType, string> = {
  flash_sale: 'Flash Sale',
  promotion: 'Promotion',
  bestseller: 'Best Sellers',
  new_arrival: 'New Arrivals',
  product_catalog: 'Product Catalog',
}

function toFlexTemplate(campaignType: AiPromoCampaignType): FlexMessageTemplate {
  if (campaignType === 'flash_sale') return 'flash_sale'
  if (campaignType === 'bestseller') return 'bestseller'
  if (campaignType === 'new_arrival') return 'new_arrival'
  if (campaignType === 'product_catalog') return 'product_catalog'
  return 'promotion'
}

function toPreviewProduct(product: NormalizedCnyProduct): ExportPreviewProduct {
  return {
    productId: product.productId,
    sku: product.sku,
    name: product.name,
    imageUrl: product.imageUrl,
    basePrice: product.basePrice,
    promotionPrice: product.promotionPrice,
    unitLabel: product.unitLabel,
    promoLine1: product.promotionPrice ? `Special ${product.promotionPrice.toFixed(2)}` : '',
    promoLine2: product.stock > 0 ? `Stock ${Math.floor(product.stock)}` : '',
    productUrl: product.productUrl,
    ribbonText: product.isPromotion ? 'PROMO' : product.isBestseller ? 'BESTSELLER' : '',
  }
}

function extractFirstJsonObject(input: string): string {
  const start = input.indexOf('{')
  if (start < 0) throw new Error('AI response contained no JSON object')
  let depth = 0
  let inString = false
  let escape = false
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (escape) { escape = false; continue }
    if (ch === '\\') { escape = true; continue }
    if (ch === '"') { inString = !inString; continue }
    if (inString) continue
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return input.slice(start, i + 1)
    }
  }
  throw new Error('AI response had unbalanced JSON braces')
}

function parseAiJson(text: string): { title?: string; intro?: string; footerText?: string; ctaLabel?: string; scheduledAt?: string } {
  const stripped = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const jsonStr = extractFirstJsonObject(stripped)
  const parsed = JSON.parse(jsonStr)
  if (!parsed || typeof parsed !== 'object') throw new Error('AI did not return an object')
  return parsed
}

export function parseScheduledAt(input: string | undefined, fallbackHours = 24): Date {
  if (input) {
    const explicit = new Date(input)
    if (Number.isFinite(explicit.getTime())) return explicit
  }
  const fallback = new Date()
  fallback.setHours(fallback.getHours() + fallbackHours, 0, 0, 0)
  return fallback
}

export async function generatePromoDraft(params: {
  prompt: string
  products: NormalizedCnyProduct[]
  campaignType?: AiPromoCampaignType
  maxProducts?: number
  source?: 'manual' | 'rule'
  productFilters?: { skuIncludes?: string[]; minStock?: number }
}): Promise<GeneratedPromoDraft> {
  const campaignType = params.campaignType || inferCampaignType(params.prompt)
  const selectedProducts = selectProductsForCampaign(
    params.products,
    campaignType,
    params.maxProducts || 6,
    params.productFilters
  )

  if (selectedProducts.length === 0) {
    return {
      campaignType,
      selectedProducts: [],
      generatedCopy: '',
      flexJson: { type: 'carousel', contents: [] },
      proposedScheduledAt: null,
      status: 'needs_review',
      errorMessage: 'No eligible products from source API',
    }
  }

  const productLines = selectedProducts.map((product) => (
    `${product.sku} | ${product.name} | base=${product.basePrice} | promo=${product.promotionPrice ?? ''} | stock=${product.stock}`
  )).join('\n')

  let ai = {
    title: CAMPAIGN_TITLE[campaignType],
    intro: 'Selected products from CNY catalog, ready for approval.',
    footerText: 'Please review product details before approving.',
    ctaLabel: 'View product',
    scheduledAt: undefined as string | undefined,
  }
  let errorMessage: string | undefined

  try {
    const aiText = await generateAiText({
      maxTokens: 900,
      temperature: 0.3,
      systemPrompt: [
        'You draft Thai B2B pharmacy promotion copy for LINE Flex broadcasts.',
        'Return JSON only with title, intro, footerText, ctaLabel, scheduledAt.',
        'Do not invent SKU, price, stock, dosage, availability, or medical claims.',
        'Use only the provided products for factual details.',
      ].join('\n'),
      parts: [{
        text: [
          `Campaign type: ${campaignType}`,
          `Admin instruction: ${params.prompt}`,
          'Products:',
          productLines,
        ].join('\n'),
      }],
    })
    ai = { ...ai, ...parseAiJson(aiText) }
  } catch (error) {
    errorMessage = error instanceof Error ? error.message : 'AI generation failed'
  }

  const flexContents = buildFlexPayload(
    selectedProducts.map(toPreviewProduct),
    {
      template: toFlexTemplate(campaignType),
      title: ai.title || CAMPAIGN_TITLE[campaignType],
      intro: ai.intro || '',
      footerText: ai.footerText || '',
      ctaLabel: ai.ctaLabel || 'View product',
      theme: campaignType === 'flash_sale' ? 'amber' : campaignType === 'bestseller' ? 'emerald' : 'rose',
      includeIntroBubble: true,
    }
  )

  const generatedCopy = [
    ai.title || CAMPAIGN_TITLE[campaignType],
    ai.intro || '',
    ai.footerText || '',
  ].filter(Boolean).join('\n\n')

  return {
    campaignType,
    selectedProducts,
    generatedCopy,
    flexJson: {
      type: 'flex',
      altText: ai.title || CAMPAIGN_TITLE[campaignType],
      contents: flexContents,
    },
    proposedScheduledAt: parseScheduledAt(ai.scheduledAt),
    status: errorMessage ? 'needs_review' : 'draft',
    errorMessage,
  }
}

export function assertDraftReadyForApproval(params: {
  flexJson: unknown
  scheduledAt: Date
  targetSegmentId?: number
  targetTagIds?: number[]
  targetCustomerIds?: number[]
}) {
  if (!params.flexJson || typeof params.flexJson !== 'object') {
    throw new Error('Draft has invalid Flex JSON')
  }
  if (!Number.isFinite(params.scheduledAt.getTime()) || params.scheduledAt <= new Date()) {
    throw new Error('Scheduled time must be in the future')
  }
  const hasAudience = Boolean(params.targetSegmentId)
    || Boolean(params.targetTagIds?.length)
    || Boolean(params.targetCustomerIds?.length)
  if (!hasAudience) {
    throw new Error('Choose an audience before approval')
  }
  return buildBroadcastEnvelope({
    content: 'AI promotion broadcast',
    messageType: 'flex',
    flexContent: params.flexJson,
    targetSegmentId: params.targetSegmentId,
    targetTagIds: params.targetTagIds,
    targetCustomerIds: params.targetCustomerIds,
  })
}

