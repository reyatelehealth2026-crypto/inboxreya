import type { CsvProduct } from './csv-product';

export type ExportThemeKey = 'rose' | 'violet' | 'emerald' | 'amber' | 'sky';
export type FlexMessageTemplate =
  | 'product_catalog'
  | 'promotion'
  | 'flash_sale'
  | 'new_arrival'
  | 'bestseller';

export type ExportGlobalConfig = {
  template: FlexMessageTemplate;
  title: string;
  intro: string;
  footerText: string;
  ctaLabel: string;
  theme: ExportThemeKey;
  accentColor?: string;
  actionUrl?: string;
  includeIntroBubble?: boolean;
};

export type ExportPreviewProduct = {
  productId: number;
  sku: string;
  name: string;
  imageUrl: string | null;
  basePrice: number;
  promotionPrice: number | null;
  unitLabel?: string;
  quantity?: number;
  promoLine1?: string;
  promoLine2?: string;
  offerStart?: string;
  offerEnd?: string;
  productUrl?: string;
  isPrescription?: boolean;
  ribbonText?: string;
  ctaLabel?: string;
};

const MAX_CAROUSEL_BUBBLES = 12;

const THEME_COLORS: Record<ExportThemeKey, string> = {
  rose: '#E53E3E',
  violet: '#805AD5',
  emerald: '#15803D',
  amber: '#D69E2E',
  sky: '#4299E1',
};

const TEMPLATE_DEFAULTS: Record<
  FlexMessageTemplate,
  Pick<ExportGlobalConfig, 'title' | 'intro' | 'footerText' | 'ctaLabel' | 'theme'>
> = {
  product_catalog: {
    title: 'แคตตาล็อคสินค้า',
    intro: 'รวมสินค้าพร้อมรายละเอียดเพื่อใช้ในข้อความ Broadcast',
    footerText: 'แตะปุ่มเพื่อดูรายละเอียดสินค้าเพิ่มเติม',
    ctaLabel: 'ดูรายละเอียด',
    theme: 'emerald',
  },
  promotion: {
    title: 'โปรโมชันพิเศษ',
    intro: 'รวมสินค้าราคาพิเศษ คัดมาให้พร้อมโปรเด่น',
    footerText: 'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย',
    ctaLabel: 'ซื้อเลย',
    theme: 'rose',
  },
  flash_sale: {
    title: 'Flash Sale',
    intro: 'สินค้าจำนวนจำกัด รีบสั่งก่อนหมด',
    footerText: 'ราคาพิเศษเฉพาะช่วงเวลานี้',
    ctaLabel: 'สั่งทันที',
    theme: 'amber',
  },
  new_arrival: {
    title: 'สินค้าใหม่',
    intro: 'อัปเดตสินค้ามาใหม่ล่าสุด',
    footerText: 'เลือกดูรายละเอียดสินค้าใหม่ได้ทันที',
    ctaLabel: 'ดูสินค้าใหม่',
    theme: 'violet',
  },
  bestseller: {
    title: 'สินค้าขายดี',
    intro: 'รวมสินค้ายอดนิยมจากลูกค้า',
    footerText: 'เลือกสินค้าขายดีเพื่อส่งต่อให้ลูกค้าได้เลย',
    ctaLabel: 'ดูสินค้าขายดี',
    theme: 'emerald',
  },
};

export function getTemplateDefaults(template: FlexMessageTemplate) {
  return TEMPLATE_DEFAULTS[template];
}

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

function getResolvedConfig(config: ExportGlobalConfig): Required<ExportGlobalConfig> {
  const defaults = TEMPLATE_DEFAULTS[config.template];
  return {
    template: config.template,
    title: config.title || defaults.title,
    intro: config.intro || defaults.intro,
    footerText: config.footerText || defaults.footerText,
    ctaLabel: config.ctaLabel || defaults.ctaLabel,
    theme: config.theme || defaults.theme,
    accentColor: config.accentColor || '',
    actionUrl: config.actionUrl || 'https://www.cnypharmacy.com',
    includeIntroBubble:
      config.includeIntroBubble ?? config.template !== 'product_catalog',
  };
}

function getTemplateRibbonText(template: FlexMessageTemplate): string {
  switch (template) {
    case 'flash_sale':
      return 'FLASH SALE';
    case 'new_arrival':
      return 'NEW ARRIVAL';
    case 'bestseller':
      return 'BESTSELLER';
    case 'product_catalog':
      return 'CATALOG';
    case 'promotion':
    default:
      return 'SPECIAL OFFER';
  }
}

function buildIntroBubble(
  config: Required<ExportGlobalConfig>,
  themeColor: string,
  productCount: number
): object {
  return {
    type: 'bubble',
    size: 'mega',
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: themeColor,
      paddingAll: '16px',
      contents: [
        {
          type: 'text',
          text: config.title,
          color: '#FFFFFF',
          weight: 'bold',
          size: 'xl',
          wrap: true,
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      contents: [
        {
          type: 'text',
          text: config.intro,
          size: 'sm',
          color: '#334155',
          wrap: true,
        },
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'sm',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 0,
              backgroundColor: '#F1F5F9',
              cornerRadius: '12px',
              paddingAll: '8px',
              contents: [
                {
                  type: 'text',
                  text: `${productCount} รายการ`,
                  size: 'xs',
                  weight: 'bold',
                  color: themeColor,
                },
              ],
            },
          ],
        },
        {
          type: 'text',
          text: config.footerText,
          size: 'xs',
          color: '#64748B',
          wrap: true,
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: themeColor,
          action: {
            type: 'uri',
            label: config.ctaLabel,
            uri: config.actionUrl,
          },
        },
      ],
    },
  };
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
    unitLabel: p.priceUnit || '',
    promoLine1: p.promoCond1 || '',
    promoLine2: p.promoCond2 || '',
    offerStart: p.offerStart || '',
    offerEnd: p.offerEnd || '',
    productUrl: p.productUrl || '',
    ribbonText: p.offerHeader || '',
    ctaLabel: p.btnLabel || '',
  };
}

export function buildProductCard(
  product: ExportPreviewProduct,
  config: ExportGlobalConfig
): object {
  const resolvedConfig = getResolvedConfig(config);
  const themeColor = resolvedConfig.accentColor || THEME_COLORS[resolvedConfig.theme];
  const productUrl = product.productUrl || getProductUrlFromSku(product.sku);
  const salePrice = product.promotionPrice ?? product.basePrice;
  const originalPrice = product.basePrice;
  const hasDiscount = originalPrice > salePrice;
  const quantity = product.quantity ?? 1;
  const unitLabel = product.unitLabel || '';
  const badgeText = product.ribbonText || getTemplateRibbonText(resolvedConfig.template);
  const ctaLabel = product.ctaLabel || resolvedConfig.ctaLabel;

  const salePriceText = unitLabel
    ? `${formatPrice(salePrice)} / ${unitLabel}`
    : `${formatPrice(salePrice)}`;

  const originalPriceText = unitLabel
    ? `${formatPrice(originalPrice)} / ${unitLabel}`
    : `${formatPrice(originalPrice)}`;

  const promoLines = [product.promoLine1, product.promoLine2].filter(Boolean);

  return {
    type: 'bubble',
    size: 'micro',
    hero: {
      type: 'image',
      url:
        product.imageUrl ||
        'https://manager.cnypharmacy.com/uploads/product_photo/placeholder.jpg',
      size: 'full',
      aspectMode: 'cover',
      aspectRatio: '4:3',
      action: { type: 'uri', uri: productUrl },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      contents: [
        {
          type: 'box',
          layout: 'horizontal',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 0,
              backgroundColor: themeColor,
              cornerRadius: '10px',
              paddingAll: '6px',
              contents: [
                {
                  type: 'text',
                  text: badgeText,
                  size: 'xxs',
                  weight: 'bold',
                  color: '#FFFFFF',
                },
              ],
            },
          ],
        },
        {
          type: 'text',
          text: `SKU ${product.sku}`,
          size: 'xxs',
          color: '#64748B',
          wrap: true,
        },
        {
          type: 'text',
          text: product.name,
          size: 'sm',
          weight: 'bold',
          color: '#0F172A',
          wrap: true,
          maxLines: 3,
        },
        ...(promoLines.length > 0
          ? [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FFF7ED',
                cornerRadius: '10px',
                paddingAll: '8px',
                contents: promoLines.map((line) => ({
                  type: 'text',
                  text: line,
                  size: 'xxs',
                  color: '#C2410C',
                  wrap: true,
                })),
              },
            ]
          : []),
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: salePriceText,
              size: 'md',
              weight: 'bold',
              color: themeColor,
              wrap: true,
            },
            ...(hasDiscount
              ? [
                  {
                    type: 'text',
                    text: originalPriceText,
                    size: 'xs',
                    color: '#94A3B8',
                    decoration: 'line-through',
                    wrap: true,
                  },
                ]
              : []),
            {
              type: 'text',
              text: quantity > 1 ? `จำนวน ${quantity}` : 'พร้อมส่ง',
              size: 'xxs',
              color: '#64748B',
            },
          ],
        },
        ...(product.isPrescription
          ? [
              {
                type: 'box',
                layout: 'vertical',
                backgroundColor: '#FEF2F2',
                cornerRadius: '10px',
                paddingAll: '8px',
                contents: [
                  {
                    type: 'text',
                    text: '⚠️ ยาตามใบสั่งแพทย์',
                    size: 'xxs',
                    color: '#DC2626',
                    weight: 'bold',
                    wrap: true,
                  },
                ],
              },
            ]
          : []),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: themeColor,
          action: { type: 'uri', label: ctaLabel, uri: productUrl },
        },
      ],
    },
  };
}

export function buildFlexPayload(products: ExportPreviewProduct[], config: ExportGlobalConfig) {
  const resolvedConfig = getResolvedConfig(config);
  const themeColor = resolvedConfig.accentColor || THEME_COLORS[resolvedConfig.theme];
  const contents: object[] = [];

  if (resolvedConfig.includeIntroBubble) {
    contents.push(buildIntroBubble(resolvedConfig, themeColor, products.length));
  }

  const remainingSlots = Math.max(MAX_CAROUSEL_BUBBLES - contents.length, 0);
  contents.push(
    ...products.slice(0, remainingSlots).map((product) => buildProductCard(product, resolvedConfig))
  );

  return {
    type: 'carousel',
    contents,
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
