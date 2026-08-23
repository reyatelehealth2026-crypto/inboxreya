import { describe, expect, test, vi } from 'vitest'
import { assertDraftReadyForApproval, generatePromoDraft } from '@/lib/ai-agent/promo-drafts'
import type { NormalizedCnyProduct } from '@/lib/ai-agent/cny-products'

// promo-drafts → broadcast-runtime → @/lib/prisma; ถ้าไม่ mock จะสร้าง Prisma Client จริง
// แล้วหา query engine ไม่เจอบนเครื่อง dev (schema.prisma ปัก binaryTargets ไว้เฉพาะ linux)
vi.mock('@/lib/prisma', () => ({
  default: {},
  prisma: {},
}))

vi.mock('@/lib/ai', () => ({
  generateAiText: vi.fn(async () => JSON.stringify({
    title: 'Flash Sale CNY',
    intro: 'โปรพิเศษจากข้อมูลสินค้า',
    footerText: 'ตรวจสอบก่อนอนุมัติ',
    ctaLabel: 'ดูสินค้า',
  })),
}))

const products: NormalizedCnyProduct[] = [{
  productId: 1,
  sku: '1001',
  barcode: '1001',
  name: 'Test Product',
  nameEn: '',
  specName: '',
  imageUrl: null,
  unitLabel: 'box',
  basePrice: 100,
  promotionPrice: 80,
  stock: 10,
  isPromotion: true,
  isBestseller: false,
  productUrl: 'https://www.cnypharmacy.com/product/1001',
}]

describe('AI promo draft guardrails', () => {
  test('generates Flex from source products and keeps source prices', async () => {
    const draft = await generatePromoDraft({
      prompt: 'ทำ flash sale',
      products,
      campaignType: 'flash_sale',
    })

    expect(draft.status).toBe('draft')
    expect(draft.selectedProducts[0].sku).toBe('1001')
    expect(draft.selectedProducts[0].promotionPrice).toBe(80)
    expect(draft.flexJson.type).toBe('flex')
  })

  test('approval requires a future schedule and audience', () => {
    expect(() => assertDraftReadyForApproval({
      flexJson: { type: 'flex', contents: { type: 'carousel', contents: [] } },
      scheduledAt: new Date(Date.now() + 60_000),
    })).toThrow('Choose an audience')

    expect(() => assertDraftReadyForApproval({
      flexJson: { type: 'flex', contents: { type: 'carousel', contents: [] } },
      scheduledAt: new Date(Date.now() - 60_000),
      targetTagIds: [1],
    })).toThrow('future')
  })
})

