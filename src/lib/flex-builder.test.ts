import {
  buildFlexPayload,
  csvProductToPreviewProduct,
  getTemplateDefaults,
  type ExportPreviewProduct,
} from './flex-builder'
import type { CsvProduct } from './csv-product'

function createPreviewProduct(overrides: Partial<ExportPreviewProduct> = {}): ExportPreviewProduct {
  return {
    productId: 1,
    sku: 'SKU-001',
    name: 'ยาตัวอย่าง',
    imageUrl: 'https://example.com/product.jpg',
    basePrice: 250,
    promotionPrice: 199,
    productUrl: 'https://example.com/p/1',
    ...overrides,
  }
}

describe('flex-builder', () => {
  it('uses template config fields in intro bubble and product CTA', () => {
    const payload = buildFlexPayload([createPreviewProduct()], {
      template: 'promotion',
      title: 'โปรแรงวันนี้',
      intro: 'คัดสินค้าลดราคาส่งให้ลูกค้าได้ทันที',
      footerText: 'แจ้งรหัสสินค้าที่ต้องการกลับมาได้เลย',
      ctaLabel: 'สั่งซื้อทันที',
      theme: 'rose',
    })

    expect(payload.type).toBe('carousel')
    expect(payload.contents).toHaveLength(2)

    const introBubble = payload.contents[0] as any
    const productBubble = payload.contents[1] as any

    expect(introBubble.header.contents[0].text).toBe('โปรแรงวันนี้')
    expect(introBubble.body.contents[0].text).toBe('คัดสินค้าลดราคาส่งให้ลูกค้าได้ทันที')
    expect(introBubble.body.contents[2].text).toBe('แจ้งรหัสสินค้าที่ต้องการกลับมาได้เลย')
    expect(introBubble.footer.contents[0].action.label).toBe('สั่งซื้อทันที')
    expect(productBubble.footer.contents[0].action.label).toBe('สั่งซื้อทันที')
  })

  it('limits the carousel to 12 bubbles including intro bubble', () => {
    const products = Array.from({ length: 20 }, (_, index) =>
      createPreviewProduct({ productId: index + 1, sku: `SKU-${index + 1}` })
    )

    const payload = buildFlexPayload(products, {
      template: 'promotion',
      ...getTemplateDefaults('promotion'),
    })

    expect(payload.contents).toHaveLength(12)
  })

  it('maps CSV products into preview products with parsed pricing', () => {
    const csvProduct: CsvProduct = {
      productUrl: 'https://example.com/p/123',
      imageUrl: 'https://example.com/image.jpg',
      minQtyLabel: '',
      maxQtyLabel: '',
      offerHeader: 'HOT DEAL',
      offerStart: '',
      offerEnd: '',
      skuLabel: 'SKU',
      sku: '123',
      productName: 'สินค้าโปรโมชั่น',
      promoCond1: 'ซื้อ 1 แถม 1',
      promoCond2: '',
      pricePerUnit: '฿299.00',
      btnLabel: 'ซื้อเลย',
      priceNumber: '299',
      priceUnit: 'กล่อง',
      priceAfterDiscount: '฿199.00',
      specName: '',
      bulkPrice: '',
      bulkUnit: '',
    }

    const preview = csvProductToPreviewProduct(csvProduct)

    expect(preview.basePrice).toBe(299)
    expect(preview.promotionPrice).toBe(199)
    expect(preview.ribbonText).toBe('HOT DEAL')
    expect(preview.ctaLabel).toBe('ซื้อเลย')
  })
})
