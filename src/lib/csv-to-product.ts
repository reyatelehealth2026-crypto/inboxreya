/**
 * Convert CsvProduct to Product format for catalog/ProductSelector
 */
import type { CsvProduct } from './csv-product';
import type { Product } from '@/types/product-catalog';

function extractPhotoPath(imageUrl: string): string {
  if (!imageUrl) return '';
  try {
    const url = new URL(imageUrl);
    const path = url.pathname.startsWith('/') ? url.pathname.slice(1) : url.pathname;
    return path || imageUrl.replace(/^https?:\/\/[^/]+\//, '');
  } catch {
    const match = imageUrl.match(/\/uploads\/.+$/);
    return match ? match[0].replace(/^\//, '') : imageUrl;
  }
}

function parsePrice(str: string): string {
  const num = parseFloat((str || '').replace(/[^\d.]/g, ''));
  return Number.isFinite(num) ? num.toFixed(2) : '0.00';
}

export function csvProductToProduct(csv: CsvProduct, index: number): Product {
  const skuNum = parseInt((csv.sku || '0').replace(/\D/g, ''), 10) || index + 1;
  const basePrice = parsePrice(csv.pricePerUnit || csv.priceNumber);
  const promoPrice = parsePrice(csv.priceAfterDiscount);
  const hasPromo = promoPrice !== '0.00' && parseFloat(promoPrice) < parseFloat(basePrice);

  return {
    product_data: [
      {
        id: skuNum,
        sku: csv.sku || String(skuNum),
        barcode: csv.sku || '',
        name_en: csv.productName || '',
        name: csv.productName || '',
        spec_name: csv.specName || '',
        is_recommend: 0,
        is_promotion: csv.offerHeader ? 1 : 0,
        is_bestseller: 0,
        is_rx: 0,
      },
    ],
    product_photo: [
      { photo_path: extractPhotoPath(csv.imageUrl) || `uploads/product_photo/placeholder.jpg` },
    ],
    product_unit: [
      {
        id: skuNum * 10,
        target_id: skuNum,
        unit: csv.priceUnit || 'ชิ้น',
        unit_num: '1.00',
        contain: '1.00',
      },
    ],
    product_price: [
      {
        product_price: [
          {
            id: skuNum * 100,
            price_level_id: 1,
            product_unit_id: skuNum * 10,
            price: basePrice,
            promotion_price: hasPromo ? promoPrice : basePrice,
            buy_max: 0,
            buy_min: 0,
          },
        ],
      },
    ],
    product_stock: [{ productLotId: skuNum * 10, stock_num: '999', expiry_date: null }],
    product_wishlists: 0,
    product_related_lists: [],
    product_hashtag: [],
    product_hashtag_new: [],
    customer_buyed: 0,
    product_is_flashSale: hasPromo ? 1 : 0,
    product_is_recommend: 0,
    product_flasSale: [],
    is_rx: 0,
  };
}
