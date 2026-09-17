import { describe, expect, test } from 'vitest'
import { normalizeCnyProducts, selectProductsForCampaign } from '@/lib/ai-agent/cny-products'

const samplePayload = {
  product: [
    {
      product_data: [{
        id: 2511,
        sku: '2570',
        barcode: '2570',
        name: 'MYSOVEN 200MG',
        name_en: 'MYSOVEN GRANULE 200MG',
        spec_name: 'ACETYLCYSTEINE',
        is_promotion: 1,
        is_bestseller: 0,
      }],
      product_photo: [{ photo_path: 'uploads/product_photo/2570.jpg' }],
      product_unit: [{ id: 3839, unit: 'box[60]' }],
      product_price: [{ product_price: [{ product_unit_id: 3839, price: '397.00', promotion_price: '350.00' }] }],
      product_stock: [{ stock_num: '4260.00' }],
    },
    {
      product_data: [{
        id: 100,
        sku: '0100',
        barcode: '0100',
        name: 'NORMAL PRODUCT',
        is_promotion: 0,
        is_bestseller: 1,
      }],
      product_photo: [{ photo_path: 'https://example.com/p.jpg' }],
      product_unit: [{ id: 1, unit: 'piece' }],
      product_price: [{ product_price: [{ product_unit_id: 1, price: '20.00', promotion_price: '20.00' }] }],
      product_stock: [{ stock_num: '8.00' }],
    },
  ],
}

describe('CNY product normalizer', () => {
  test('maps nested CNY API payload into stable promotion products', () => {
    const products = normalizeCnyProducts(samplePayload)

    expect(products).toHaveLength(2)
    expect(products[0]).toMatchObject({
      productId: 2511,
      sku: '2570',
      name: 'MYSOVEN 200MG',
      basePrice: 397,
      promotionPrice: 350,
      stock: 4260,
      isPromotion: true,
    })
    expect(products[0].imageUrl).toBe('https://manager.cnypharmacy.com/uploads/product_photo/2570.jpg')
  })

  test('uses rule-based campaign selection instead of AI choosing facts', () => {
    const products = normalizeCnyProducts(samplePayload)

    expect(selectProductsForCampaign(products, 'flash_sale', 6).map((p) => p.sku)).toEqual(['2570', '0100'])
    expect(selectProductsForCampaign(products, 'bestseller', 6).map((p) => p.sku)).toEqual(['0100', '2570'])
  })
})

