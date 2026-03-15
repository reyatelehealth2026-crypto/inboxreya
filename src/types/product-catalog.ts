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
  product_stock: ProductStock[];
  product_wishlists: number;
  product_related_lists: any[];
  product_hashtag: any[];
  product_hashtag_new: any[];
  customer_buyed: number;
  product_is_flashSale: number;
  product_is_recommend: number;
  product_flasSale: any[];
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

// Helper functions for Flex Message generation
export function generateProductBubble(product: Product, quantity: number = 1, unit?: ProductUnit): object {
  const data = product.product_data[0];
  const price = product.product_price[0]?.product_price[0];
  const photo = product.product_photo[0];
  const displayPrice = price?.promotion_price !== '0.00' 
    ? parseFloat(price.promotion_price) 
    : parseFloat(price?.price || '0');

  return {
    type: 'bubble',
    size: 'micro',
    hero: photo ? {
      type: 'image',
      url: `https://www.cnypharmacy.com/${photo.photo_path}`,
      size: 'full',
      aspectRatio: '1:1',
      aspectMode: 'cover'
    } : undefined,
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: data.name.substring(0, 40) + (data.name.length > 40 ? '...' : ''),
          weight: 'bold',
          size: 'sm',
          wrap: true
        },
        {
          type: 'text',
          text: `SKU: ${data.sku}`,
          size: 'xs',
          color: '#666666',
          margin: 'sm'
        },
        {
          type: 'box',
          layout: 'horizontal',
          margin: 'md',
          contents: [
            {
              type: 'text',
              text: unit ? `${quantity} ${unit.unit}` : `${quantity} ชิ้น`,
              size: 'sm',
              flex: 1
            },
            {
              type: 'text',
              text: `฿${displayPrice.toLocaleString()}`,
              weight: 'bold',
              size: 'sm',
              color: '#15803D',
              align: 'end'
            }
          ]
        }
      ]
    },
    footer: data.is_rx === 1 ? {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'text',
          text: '⚠️ ยาตามใบสั่งแพทย์',
          size: 'xs',
          color: '#DC2626',
          align: 'center'
        }
      ],
      backgroundColor: '#FEF2F2',
      paddingAll: '8px'
    } : undefined
  };
}

export function generateFlexCarousel(products: SelectedProduct[]): object {
  return {
    type: 'carousel',
    contents: products.map(p => generateProductBubble(p.product, p.quantity, p.selectedUnit || undefined))
  };
}

// Flex Message Template Types
export type FlexMessageTemplate = 
  | 'product_catalog' 
  | 'promotion' 
  | 'flash_sale' 
  | 'new_arrival' 
  | 'bestseller';

export function generateFlexMessageByTemplate(
  products: SelectedProduct[], 
  template: FlexMessageTemplate,
  options?: {
    title?: string;
    subtitle?: string;
    headerColor?: string;
  }
): object {
  const bubbles = products.map(p => generateProductBubble(p.product, p.quantity, p.selectedUnit || undefined));
  
  const headerTexts: Record<FlexMessageTemplate, { title: string; subtitle: string; color: string }> = {
    product_catalog: { 
      title: options?.title || '📋 แคตตาล็อคสินค้า', 
      subtitle: options?.subtitle || 'เลือกสินค้าที่ต้องการ',
      color: options?.headerColor || '#15803D'
    },
    promotion: { 
      title: options?.title || '🔥 โปรโมชั่นพิเศษ', 
      subtitle: options?.subtitle || 'จำกัดเวลา!',
      color: options?.headerColor || '#EA580C'
    },
    flash_sale: { 
      title: options?.title || '⚡ Flash Sale', 
      subtitle: options?.subtitle || 'รีบเลยก่อนหมด!',
      color: options?.headerColor || '#DC2626'
    },
    new_arrival: { 
      title: options?.title || '✨ สินค้าใหม่', 
      subtitle: options?.subtitle || 'มาใหม่ล่าสุด',
      color: options?.headerColor || '#7C3AED'
    },
    bestseller: { 
      title: options?.title || '🏆 สินค้าขายดี', 
      subtitle: options?.subtitle || 'ยอดนิยมจากลูกค้า',
      color: options?.headerColor || '#CA8A04'
    }
  };

  const header = headerTexts[template];

  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: header.color,
      paddingAll: '12px',
      alignItems: 'center',
      contents: [
        {
          type: 'text',
          text: header.title,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'lg'
        },
        {
          type: 'text',
          text: header.subtitle,
          color: '#FFFFFF',
          size: 'sm',
          margin: 'sm'
        }
      ]
    },
    body: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'carousel',
          contents: bubbles
        }
      ]
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          action: {
            type: 'uri',
            label: 'ดูสินค้าทั้งหมด',
            uri: 'https://www.cnypharmacy.com'
          },
          style: 'primary',
          color: header.color
        }
      ]
    }
  };
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
