import type { CsvProduct } from './csv-product';
import type { Product } from '@/types/product-catalog';

const CNY_BASE_URL = 'https://www.cnypharmacy.com';

function parsePrice(value: string | number | null | undefined): number {
  const parsed = typeof value === 'number' ? value : parseFloat(value || '0');
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatBaht(value: number, unit?: string): string {
  const amount = value.toLocaleString('th-TH', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  return unit ? `${amount} / ${unit}` : amount;
}

function normalizePhotoUrl(photoPath?: string): string {
  if (!photoPath) return '';
  if (/^https?:\/\//i.test(photoPath)) return photoPath;
  return `${CNY_BASE_URL}/${photoPath.replace(/^\/+/, '')}`;
}

export function cnyProductToCsvProduct(product: Product): CsvProduct | null {
  const data = product.product_data?.[0];
  if (!data?.sku || !data?.name) return null;

  const unit = product.product_unit?.[0];
  const price = product.product_price?.[0]?.product_price?.[0];
  const basePrice = parsePrice(price?.price);
  const promoPriceRaw = parsePrice(price?.promotion_price);
  const hasPromotionPrice = promoPriceRaw > 0 && promoPriceRaw < basePrice;
  const salePrice = hasPromotionPrice ? promoPriceRaw : basePrice;
  const photo = product.product_photo?.[0];
  const isPromotion = data.is_promotion === 1 || hasPromotionPrice;
  const isFlashSale = product.product_is_flashSale === 1;

  return {
    productUrl: `${CNY_BASE_URL}/product/${data.sku}`,
    imageUrl: normalizePhotoUrl(photo?.photo_path),
    minQtyLabel: '',
    maxQtyLabel: '',
    offerHeader: isFlashSale ? 'FLASH SALE' : isPromotion ? 'SPECIAL OFFER' : '',
    offerStart: '',
    offerEnd: '',
    skuLabel: 'รหัสสินค้า',
    sku: data.sku,
    productName: data.name,
    promoCond1: data.spec_name || '',
    promoCond2: '',
    pricePerUnit: salePrice > 0 ? formatBaht(salePrice, unit?.unit) : '',
    btnLabel: 'ดูรายละเอียด',
    priceNumber: salePrice > 0 ? String(salePrice) : '',
    priceUnit: unit?.unit || '',
    priceAfterDiscount: hasPromotionPrice ? `ราคาปกติ ${formatBaht(basePrice, unit?.unit)}` : '',
    specName: data.spec_name || '',
    bulkPrice: '',
    bulkUnit: '',
  };
}

export function cnyProductsToCsvProducts(products: Product[]): CsvProduct[] {
  return products
    .map(cnyProductToCsvProduct)
    .filter((product): product is CsvProduct => product !== null);
}
