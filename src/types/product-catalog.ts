import {
  buildFlexPayload,
  buildFlexPayloadChunked,
  buildProductCard,
  type ExportPreviewProduct,
  type FlexMessageTemplate,
} from '@/lib/flex-builder';

// Types for Product Catalog
export interface ProductData {
  id: number;
  sku: string;
  barcode: string;
  name_en: string;
  name: string;
  spec_name: string;
  is_recommend: number;
  is_promotion: number;
  is_bestseller: number;
  is_rx: number;
}

export interface ProductPhoto {
  photo_path: string;
}

export interface ProductUnit {
  id: number;
  target_id: number;
  unit: string;
  unit_num: string;
  contain: string;
}

export interface ProductPriceItem {
  id: number;
  price_level_id: number;
  product_unit_id: number;
  price: string;
  promotion_price: string;
  buy_max: number;
  buy_min: number;
}

export interface ProductPrice {
  product_price: ProductPriceItem[];
}

export interface ProductStock {
  productLotId: number;
  stock_num: string;
  expiry_date: string | null;
}

export interface Product {
  product_data: ProductData[];
  product_photo: ProductPhoto[];
  product_unit: ProductUnit[];
  product_price: ProductPrice[];
  product_stock?: ProductStock[];
  product_wishlists?: number;
  product_related_lists?: any[];
  product_hashtag?: any[];
  product_hashtag_new?: any[];
  customer_buyed: number;
  product_is_flashSale?: number;
  product_is_recommend?: number;
  product_flasSale?: any[];
  is_rx: number;
}

export interface ProductType {
  type: Array<{
    id: number;
    type: string;
    code: string;
  }>;
  sub_type: Array<{
    id: number;
    code: string;
    sub_type: string;
    product_type_id: number;
  }>;
}

export interface Supplier {
  id: number;
  code: string;
  company: string;
}

export interface SelectedProduct {
  product: Product;
  quantity: number;
  selectedUnit: ProductUnit | null;
}

function getSelectedPrice(product: Product, unit?: ProductUnit | null): ProductPriceItem | undefined {
  const allPrices = product.product_price.flatMap((priceGroup) => priceGroup.product_price ?? []);
  if (!unit) {
    return allPrices[0];
  }

  return (
    allPrices.find((price) => price.product_unit_id === unit.id) ||
    allPrices[0]
  );
}

function getRibbonText(product: Product): string {
  if (product.product_is_flashSale === 1) return 'FLASH SALE';
  if (product.product_data[0]?.is_promotion === 1) return 'PROMOTION';
  if (product.product_data[0]?.is_bestseller === 1) return 'BESTSELLER';
  return '';
}

function selectedProductToPreviewProduct(
  product: Product,
  quantity: number = 1,
  unit?: ProductUnit | null
): ExportPreviewProduct {
  const data = product.product_data[0];
  const price = getSelectedPrice(product, unit);
  const photo = product.product_photo[0];
  const basePrice = parseFloat(price?.price || '0');
  const promotionPriceRaw = parseFloat(price?.promotion_price || '0');
  const promotionPrice =
    Number.isFinite(promotionPriceRaw) && promotionPriceRaw > 0 && promotionPriceRaw < basePrice
      ? promotionPriceRaw
      : null;

  return {
    productId: data?.id || 0,
    sku: data?.sku || '',
    name: data?.name || '',
    imageUrl: photo ? `https://www.cnypharmacy.com/${photo.photo_path}` : null,
    basePrice,
    promotionPrice,
    unitLabel: unit?.unit || '',
    quantity,
    productUrl: data?.sku ? `https://www.cnypharmacy.com/product/${data.sku}` : undefined,
    isPrescription: data?.is_rx === 1,
    ribbonText: getRibbonText(product),
  };
}

// Helper functions for Flex Message generation
export function generateProductBubble(product: Product, quantity: number = 1, unit?: ProductUnit): object {
  return buildProductCard(selectedProductToPreviewProduct(product, quantity, unit), {
    template: 'product_catalog',
    title: '',
    intro: '',
    footerText: '',
    ctaLabel: 'ดูรายละเอียด',
    theme: 'emerald',
    includeIntroBubble: false,
  });
}

export function generateFlexCarousel(products: SelectedProduct[]): object {
  return buildFlexPayload(
    products.map((p) => selectedProductToPreviewProduct(p.product, p.quantity, p.selectedUnit)),
    {
      template: 'product_catalog',
      title: '',
      intro: '',
      footerText: '',
      ctaLabel: 'ดูรายละเอียด',
      theme: 'emerald',
      includeIntroBubble: false,
    }
  );
}

/**
 * Generate multiple carousels for broadcast - split by productsPerCarousel
 */
export function generateFlexCarouselsChunked(
  products: SelectedProduct[],
  template: FlexMessageTemplate,
  options: {
    productsPerCarousel?: number;
    title?: string;
    subtitle?: string;
    headerColor?: string;
  } = {}
): object[] {
  const previewProducts = products.map((p) =>
    selectedProductToPreviewProduct(p.product, p.quantity, p.selectedUnit)
  );
  const theme: 'rose' | 'violet' | 'emerald' | 'amber' | 'sky' =
    template === 'promotion' ? 'rose' : template === 'flash_sale' ? 'amber' : 'emerald';
  const config = {
    template,
    title: options.title || '',
    intro: options.subtitle || '',
    footerText: 'แตะปุ่มเพื่อดูรายละเอียดสินค้าเพิ่มเติม',
    ctaLabel: template === 'product_catalog' ? 'ดูรายละเอียด' : 'ดูสินค้า',
    theme,
    accentColor: options.headerColor,
    includeIntroBubble: template !== 'product_catalog',
  };
  return buildFlexPayloadChunked(
    previewProducts,
    config,
    options.productsPerCarousel ?? 6,
    template !== 'product_catalog'
  );
}

export type { FlexMessageTemplate };

export function generateFlexMessageByTemplate(
  products: SelectedProduct[],
  template: FlexMessageTemplate,
  options?: {
    title?: string;
    subtitle?: string;
    headerColor?: string;
  }
): object {
  return buildFlexPayload(
    products.map((p) => selectedProductToPreviewProduct(p.product, p.quantity, p.selectedUnit)),
    {
      template,
      title: options?.title || '',
      intro: options?.subtitle || '',
      footerText: 'แตะปุ่มเพื่อดูรายละเอียดสินค้าเพิ่มเติม',
      ctaLabel: template === 'product_catalog' ? 'ดูรายละเอียด' : 'ดูสินค้า',
      theme:
        template === 'promotion'
          ? 'rose'
          : template === 'flash_sale'
            ? 'amber'
            : template === 'new_arrival'
              ? 'violet'
              : 'emerald',
      accentColor: options?.headerColor,
      includeIntroBubble: template !== 'product_catalog',
    }
  );
}

// Validation helpers
export function validateProductData(product: Product): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  const data = product.product_data[0];

  if (!data) {
    errors.push('ไม่พบข้อมูลสินค้า');
    return { valid: false, errors };
  }

  if (!data.name || data.name.trim() === '') {
    errors.push('ชื่อสินค้าว่างเปล่า');
  }

  if (!data.sku || data.sku.trim() === '') {
    errors.push('SKU ว่างเปล่า');
  }

  const price = product.product_price[0]?.product_price[0];
  if (!price || (price.price === '0.00' && price.promotion_price === '0.00')) {
    errors.push('ไม่พบราคาสินค้า');
  }

  return { valid: errors.length === 0, errors };
}

// Format helpers
export function formatPrice(price: string): string {
  const num = parseFloat(price);
  if (isNaN(num)) return '-';
  return `฿${num.toLocaleString('th-TH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatStock(stock: string): string {
  const num = parseFloat(stock);
  if (isNaN(num)) return '-';
  return num.toLocaleString('th-TH');
}

export function getStockStatus(stockNum: string): { status: 'in_stock' | 'low_stock' | 'out_of_stock'; label: string; color: string } {
  const num = parseFloat(stockNum);
  if (isNaN(num) || num <= 0) {
    return { status: 'out_of_stock', label: 'สินค้าหมด', color: '#DC2626' };
  }
  if (num <= 10) {
    return { status: 'low_stock', label: 'ใกล้หมด', color: '#D97706' };
  }
  return { status: 'in_stock', label: 'มีสินค้า', color: '#15803D' };
}
