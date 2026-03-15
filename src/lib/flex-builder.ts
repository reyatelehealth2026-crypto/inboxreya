// src/lib/flex-builder.ts
import type { CsvProduct } from './csv-product';

export type ExportThemeKey = 'rose' | 'violet' | 'emerald' | 'amber' | 'sky';

export type ExportGlobalConfig = {
  template: string;
  title: string;
  intro: string;
  footerText: string;
  ctaLabel: string;
  theme: ExportThemeKey;
};

export type ExportPreviewProduct = {
  productId: number;
  sku: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  promotionPrice: number | null;
  promoLine1?: string;
  promoLine2?: string;
  offerStart?: string;
  offerEnd?: string;
  productUrl?: string;
};

const THEME_COLORS: Record<ExportThemeKey, string> = {
  rose: '#E53E3E',
  violet: '#805AD5',
  emerald: '#38A169',
  amber: '#D69E2E',
  sky: '#4299E1',
};

function formatPrice(value: number | string | null | undefined): string {
  if (value == null || value === '') return '0.00';
  const num = typeof value === 'string' ? parseFloat(value) : Number(value);
  if (!Number.isFinite(num)) return '0.00';
  const rounded = Math.round(num * 100) / 100;
  const parts = rounded.toFixed(2).split('.');
  const wholePart = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `${wholePart}.${parts[1]}`;
}

function getProductUrlFromSku(sku: string): string {
  const numeric = (sku || '').replace(/\D+/g, '');
  const padded = numeric.padStart(4, '0');
  return `https://www.cnypharmacy.com/product/${padded}`;
}

export function csvProductToPreviewProduct(p: CsvProduct): ExportPreviewProduct {
  const rawPrice = parseFloat((p.pricePerUnit || '').replace(/[^\d.]/g, '')) || 0;
  const rawAfter = parseFloat((p.priceAfterDiscount || '').replace(/[^\d.]/g, '')) || 0;
  const promoPrice = rawAfter > 0 && rawAfter < rawPrice ? rawAfter : null;

  return {
    productId: parseInt((p.sku || '0').replace(/\D/g, ''), 10) || 0,
    sku: p.sku,
    name: p.productName,
    imageUrl: p.imageUrl || null,
    basePrice: rawPrice,
    promotionPrice: promoPrice,
    promoLine1: p.promoCond1 || '',
    promoLine2: p.promoCond2 || '',
    offerStart: p.offerStart || '',
    offerEnd: p.offerEnd || '',
    productUrl: p.productUrl || '',
  };
}

export function buildProductCard(product: ExportPreviewProduct, themeColor: string): object {
  const productUrl = product.productUrl || getProductUrlFromSku(product.sku);
  const salePrice = product.promotionPrice ?? product.basePrice;
  const originalPrice = product.basePrice;
  const hasDiscount = originalPrice > salePrice;

  const unitLabel = (() => {
    const match = (product.name || '').match(/\[([^\]]+)\]/);
    return match ? match[1] : '';
  })();

  const salePriceText = unitLabel
    ? `${formatPrice(salePrice)} -/ ${unitLabel}`
    : `${formatPrice(salePrice)}`;

  const discountedText = unitLabel
    ? `ลดเหลือ ${formatPrice(originalPrice)} / ${unitLabel}`
    : `ลดเหลือ ${formatPrice(originalPrice)}`;

  return {
    type: 'bubble',
    size: 'nano',
    styles: { body: { backgroundColor: '#FFFFFF' } },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'none',
      paddingTop: '0px',
      paddingBottom: '0px',
      borderColor: themeColor,
      borderWidth: '2px',
      cornerRadius: '16px',
      contents: [
        // SPECIAL OFFER ribbon
        {
          type: 'box',
          layout: 'horizontal',
          paddingTop: '0px',
          paddingBottom: '0px',
          contents: [
            { type: 'filler' },
            {
              type: 'box',
              layout: 'vertical',
              flex: 0,
              backgroundColor: themeColor,
              cornerRadius: '12px',
              paddingTop: '6px',
              paddingBottom: '6px',
              paddingStart: '14px',
              paddingEnd: '14px',
              contents: [
                {
                  type: 'text',
                  text: 'SPECIAL OFFER',
                  size: 'xxs',
                  weight: 'bold',
                  color: '#FFFFFF',
                },
              ],
            },
            { type: 'filler' },
          ],
        },
        // Product image
        {
          type: 'image',
          url: product.imageUrl || 'https://manager.cnypharmacy.com/uploads/product_photo/placeholder.jpg',
          size: 'full',
          aspectMode: 'fit',
          aspectRatio: '4:3',
          gravity: 'center',
          margin: '8px',
          action: { type: 'uri', uri: productUrl },
        },
        // Product name
        {
          type: 'box',
          layout: 'vertical',
          margin: '6px',
          paddingStart: '8px',
          paddingEnd: '8px',
          action: { type: 'uri', uri: productUrl },
          contents: [
            {
              type: 'text',
              text: product.name,
              size: 'xxs',
              color: '#1A5276',
              wrap: true,
              maxLines: 3,
              decoration: 'underline',
            },
          ],
        },
        // Sale price
        {
          type: 'box',
          layout: 'vertical',
          margin: '6px',
          paddingStart: '8px',
          paddingEnd: '8px',
          contents: [
            {
              type: 'text',
              text: salePriceText,
              size: 'sm',
              weight: 'bold',
              color: themeColor,
              wrap: true,
            },
          ],
        },
        // Original price (if discounted)
        ...(hasDiscount
          ? [
              {
                type: 'box',
                layout: 'vertical',
                paddingStart: '8px',
                paddingEnd: '8px',
                contents: [
                  {
                    type: 'text',
                    text: discountedText,
                    size: 'xxs',
                    color: '#718096',
                  },
                ],
              },
            ]
          : []),
        // Buy button
        {
          type: 'button',
          style: 'primary',
          color: themeColor,
          margin: '8px',
          height: 'sm',
          action: { type: 'uri', label: 'ซื้อเลย', uri: productUrl },
        },
      ],
    },
  };
}

export function buildFlexPayload(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig
) {
  const themeColor = THEME_COLORS[config.theme] || THEME_COLORS.rose;
  
  return {
    type: 'carousel',
    contents: products.map((product) => buildProductCard(product, themeColor)),
  };
}

export function buildFlexPayloadMinified(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig
): string {
  return JSON.stringify(buildFlexPayload(products, config));
}

export function buildFlexPayloadPretty(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig
): string {
  return JSON.stringify(buildFlexPayload(products, config), null, 2);
}
