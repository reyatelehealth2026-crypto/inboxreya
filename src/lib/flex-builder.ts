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
  /** Optional hero image URL for the promo cover bubble */
  heroImageUrl?: string;
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
    heroImageUrl: config.heroImageUrl || '',
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

// ─────────────────────────────────────────────────────────────────────────────
// Promo Grid Layout
//
// Layout: giga-size carousel bubbles
//   • Bubble 0: Cover / promo header (first carousel only)
//   • Bubble 1…N: Product grid — 2 columns × 3 rows = 6 products per bubble
//
// LINE quota: max 5 message objects per push/broadcast call
//   → up to 3 Flex carousels + 1 optional closing-text = 4 payloads
// ─────────────────────────────────────────────────────────────────────────────

const PROMO_BUBBLE_SIZE = 'giga';
const MAX_PRODUCTS_PER_GRID_BUBBLE = 6;

/** Single mini-card rendered inside a 2-col grid row */
function buildPromoMiniCard(product: ExportPreviewProduct, themeColor: string): object {
  const productUrl = product.productUrl || getProductUrlFromSku(product.sku);
  const salePrice = product.promotionPrice ?? product.basePrice;
  const hasDiscount = product.basePrice > salePrice && product.basePrice > 0;

  return {
    type: 'box',
    layout: 'vertical',
    flex: 1,
    spacing: 'none',
    paddingAll: '3px',
    action: { type: 'uri', uri: productUrl },
    contents: [
      {
        type: 'image',
        url:
          product.imageUrl ||
          'https://manager.cnypharmacy.com/uploads/product_photo/placeholder.jpg',
        size: 'full',
        aspectMode: 'cover',
        aspectRatio: '1:1',
        action: { type: 'uri', uri: productUrl },
      },
      {
        type: 'text',
        text: product.name,
        size: 'xxs',
        maxLines: 1,
        wrap: false,
        color: '#1E293B',
        margin: 'xs',
      },
      {
        type: 'text',
        text: `฿${formatPrice(salePrice)}`,
        size: 'xs',
        weight: 'bold',
        color: '#E53E3E',
        margin: 'xs',
      },
      ...(hasDiscount
        ? [
            {
              type: 'text',
              text: `฿${formatPrice(product.basePrice)}`,
              size: 'xxs',
              color: '#94A3B8',
              decoration: 'line-through',
              margin: 'none',
            },
          ]
        : []),
    ],
  };
}

/** Grid bubble: up to 6 products laid out as 2 cols × 3 rows */
function buildPromoGridBubble(
  products: ExportPreviewProduct[],
  themeColor: string,
  bubbleNum: number
): object {
  const capped = products.slice(0, MAX_PRODUCTS_PER_GRID_BUBBLE);
  const rows: object[] = [];

  for (let i = 0; i < capped.length; i += 2) {
    const pair = capped.slice(i, i + 2);
    const rowContents: object[] = pair.map((p) => buildPromoMiniCard(p, themeColor));

    // Pad odd row so grid stays balanced
    if (rowContents.length < 2) {
      rowContents.push({ type: 'box', layout: 'vertical', flex: 1, contents: [] });
    }

    rows.push({
      type: 'box',
      layout: 'horizontal',
      spacing: 'xs',
      margin: i === 0 ? 'none' : 'xs',
      contents: rowContents,
    });
  }

  return {
    type: 'bubble',
    size: PROMO_BUBBLE_SIZE,
    header: {
      type: 'box',
      layout: 'vertical',
      backgroundColor: '#F1F5F9',
      paddingAll: '5px',
      contents: [
        {
          type: 'text',
          text: `ชุดที่ ${bubbleNum}`,
          size: 'xxs',
          color: '#64748B',
          align: 'center',
        },
      ],
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '6px',
      spacing: 'none',
      contents: rows,
    },
  };
}

/**
 * Cover / promo-header bubble (first bubble of the first carousel).
 *
 * When `config.heroImageUrl` is set the bubble uses a full-bleed hero image
 * with light body styling.  Without it the body background is the theme
 * colour with white text.
 *
 * ALL bubbles in the carousel MUST share the same `size` value (LINE spec).
 * This bubble is explicitly sized `PROMO_BUBBLE_SIZE` ("giga").
 */
function buildPromoCoverBubble(
  config: Required<ExportGlobalConfig>,
  themeColor: string,
  totalProductCount: number
): object {
  const hasHero = Boolean(config.heroImageUrl);
  const bodyTextColor = hasHero ? themeColor : '#FFFFFF';
  const bodySubTextColor = hasHero ? '#475569' : '#FFFFFF';
  const badgeBg = hasHero ? themeColor + '22' : 'rgba(255,255,255,0.25)';
  const badgeTextColor = hasHero ? themeColor : '#FFFFFF';
  const footerTextColor = hasHero ? '#64748B' : '#FFFFFF';

  return {
    type: 'bubble',
    size: PROMO_BUBBLE_SIZE,
    // hero image (optional — requires a public HTTPS URL)
    ...(hasHero
      ? {
          hero: {
            type: 'image',
            url: config.heroImageUrl,
            size: 'full',
            aspectMode: 'cover',
            aspectRatio: '20:13',
            action: { type: 'uri', uri: config.actionUrl },
          },
        }
      : {}),
    styles: {
      body: { backgroundColor: hasHero ? '#FFFFFF' : themeColor },
      footer: { backgroundColor: hasHero ? '#FFFFFF' : themeColor },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        ...(!hasHero ? [{ type: 'text', text: '🔥', size: '3xl', align: 'center' }] : []),
        {
          type: 'text',
          text: config.title,
          size: 'xl',
          weight: 'bold',
          color: bodyTextColor,
          align: 'center',
          wrap: true,
        },
        {
          type: 'text',
          text: config.intro,
          size: 'sm',
          color: bodySubTextColor,
          align: 'center',
          wrap: true,
          margin: 'md',
        },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: badgeBg,
          cornerRadius: '12px',
          paddingAll: '12px',
          margin: 'lg',
          contents: [
            {
              type: 'text',
              text: String(totalProductCount),
              size: '3xl',
              weight: 'bold',
              color: badgeTextColor,
              align: 'center',
            },
            {
              type: 'text',
              text: 'รายการสินค้าพิเศษ',
              size: 'sm',
              color: badgeTextColor,
              align: 'center',
            },
          ],
        },
        {
          type: 'text',
          text: config.footerText,
          size: 'xs',
          color: footerTextColor,
          align: 'center',
          wrap: true,
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
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

/**
 * Build the carousel `contents` object for one promo carousel.
 * Used for UI preview in the wizard.
 */
export function buildPromoCarouselContents(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig,
  options: {
    includeCover?: boolean;
    productsPerBubble?: number;
    startBubbleNum?: number;
    totalProducts?: number;
    /** Override hero image URL (takes precedence over config.heroImageUrl) */
    heroImageUrl?: string;
  } = {}
): object {
  const resolvedConfig = getResolvedConfig(config);
  // Allow per-call heroImageUrl override (used in preview when URL changes live)
  if (options.heroImageUrl !== undefined) resolvedConfig.heroImageUrl = options.heroImageUrl;
  const themeColor = resolvedConfig.accentColor || THEME_COLORS[resolvedConfig.theme];
  const { includeCover = true, productsPerBubble = 6, startBubbleNum = 1, totalProducts } = options;

  const perBubble = Math.min(Math.max(1, productsPerBubble), MAX_PRODUCTS_PER_GRID_BUBBLE);
  const maxGridSlots = MAX_CAROUSEL_BUBBLES - (includeCover ? 1 : 0);
  const capped = products.slice(0, maxGridSlots * perBubble);

  const bubbles: object[] = [];

  if (includeCover) {
    bubbles.push(buildPromoCoverBubble(resolvedConfig, themeColor, totalProducts ?? products.length));
  }

  let bubbleNum = startBubbleNum;
  for (let i = 0; i < capped.length; i += perBubble) {
    const chunk = capped.slice(i, i + perBubble);
    bubbles.push(buildPromoGridBubble(chunk, themeColor, bubbleNum++));
  }

  return { type: 'carousel', contents: bubbles };
}

/**
 * Build ALL LINE message objects ready to send in a single `pushLineMessage` call.
 *
 * Returns up to 5 objects (LINE API limit):
 *   - up to 3 Flex carousel messages (or 4 if no closingText)
 *   - optional closing text message
 */
export function buildPromoMessages(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig,
  options: {
    productsPerBubble?: number;
    closingText?: string;
    maxCarousels?: number;
  } = {}
): object[] {
  const resolvedConfig = getResolvedConfig(config);
  const { productsPerBubble = 6, closingText, maxCarousels = 3 } = options;

  const perBubble = Math.min(Math.max(1, productsPerBubble), MAX_PRODUCTS_PER_GRID_BUBBLE);
  // Reserve 1 slot for closing text if provided; total max = 5
  const maxFlexMessages = closingText?.trim() ? Math.min(maxCarousels, 4) : Math.min(maxCarousels, 5);

  const messages: object[] = [];
  let productIndex = 0;
  let carouselIdx = 0;
  let bubbleNum = 1;

  while (carouselIdx < maxFlexMessages && productIndex < products.length) {
    const isFirst = carouselIdx === 0;
    const maxGridSlots = MAX_CAROUSEL_BUBBLES - (isFirst ? 1 : 0);
    const maxProductsThisCarousel = maxGridSlots * perBubble;
    const chunk = products.slice(productIndex, productIndex + maxProductsThisCarousel);

    const carouselContents = buildPromoCarouselContents(chunk, resolvedConfig, {
      includeCover: isFirst,
      productsPerBubble: perBubble,
      startBubbleNum: bubbleNum,
      totalProducts: products.length,
    });

    messages.push({
      type: 'flex',
      altText: resolvedConfig.title,
      contents: carouselContents,
    });

    bubbleNum += Math.ceil(chunk.length / perBubble);
    productIndex += chunk.length;
    carouselIdx++;
  }

  if (closingText?.trim() && messages.length < 5) {
    messages.push({ type: 'text', text: closingText.trim() });
  }

  return messages;
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail Layout  (1 product per bubble · size: kilo · maximum information)
//
// • Cover bubble (kilo) — same size as product bubbles (LINE spec)
// • Product bubble: hero image 4:3 + badge + SKU + name + promo box + price +
//   discount + offer dates + CTA button
//
// Capacity: up to 11 products in first carousel (1 slot used by cover)
//           up to 12 products in subsequent carousels
//           up to 5 carousels = 11 + 12×4 = 59 products max (no closing text)
// ─────────────────────────────────────────────────────────────────────────────

export const DETAIL_BUBBLE_SIZE = 'kilo';

/** Full-detail product card for the detail layout (1 product / bubble) */
function buildDetailProductBubble(
  product: ExportPreviewProduct,
  config: Required<ExportGlobalConfig>,
  themeColor: string
): object {
  const productUrl = product.productUrl || getProductUrlFromSku(product.sku);
  const salePrice = product.promotionPrice ?? product.basePrice;
  const hasDiscount = product.basePrice > salePrice && product.basePrice > 0;
  const badgeText = product.ribbonText || getTemplateRibbonText(config.template);
  const ctaLabel = product.ctaLabel || config.ctaLabel;
  const promoLines = [product.promoLine1, product.promoLine2].filter(Boolean);
  const unitSuffix = product.unitLabel ? ` / ${product.unitLabel}` : '';

  return {
    type: 'bubble',
    size: DETAIL_BUBBLE_SIZE,
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
      paddingAll: '12px',
      contents: [
        // Badge + prescription warning row
        {
          type: 'box',
          layout: 'horizontal',
          spacing: 'xs',
          contents: [
            {
              type: 'box',
              layout: 'vertical',
              flex: 0,
              backgroundColor: themeColor,
              cornerRadius: '10px',
              paddingAll: '5px',
              contents: [
                { type: 'text', text: badgeText, size: 'xxs', weight: 'bold', color: '#FFFFFF' },
              ],
            },
            ...(product.isPrescription
              ? [
                  {
                    type: 'box',
                    layout: 'vertical',
                    flex: 0,
                    backgroundColor: '#FEF2F2',
                    cornerRadius: '10px',
                    paddingAll: '5px',
                    contents: [
                      { type: 'text', text: '⚠️ ยาตามใบสั่ง', size: 'xxs', color: '#DC2626', weight: 'bold' },
                    ],
                  },
                ]
              : []),
          ],
        },
        // SKU
        { type: 'text', text: `SKU ${product.sku}`, size: 'xxs', color: '#64748B' },
        // Product name
        {
          type: 'text',
          text: product.name,
          size: 'sm',
          weight: 'bold',
          color: '#0F172A',
          wrap: true,
          maxLines: 3,
        },
        // Promo conditions
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
        // Price section
        {
          type: 'box',
          layout: 'vertical',
          spacing: 'xs',
          contents: [
            {
              type: 'text',
              text: `฿${formatPrice(salePrice)}${unitSuffix}`,
              size: 'lg',
              weight: 'bold',
              color: themeColor,
              wrap: true,
            },
            ...(hasDiscount
              ? [
                  {
                    type: 'text',
                    text: `฿${formatPrice(product.basePrice)}${unitSuffix}`,
                    size: 'xs',
                    color: '#94A3B8',
                    decoration: 'line-through',
                  },
                ]
              : []),
          ],
        },
        // Offer dates
        ...(product.offerStart || product.offerEnd
          ? [
              {
                type: 'text',
                text: [
                  product.offerStart ? `เริ่ม ${product.offerStart}` : '',
                  product.offerEnd ? `ถึง ${product.offerEnd}` : '',
                ]
                  .filter(Boolean)
                  .join(' — '),
                size: 'xxs',
                color: '#94A3B8',
                wrap: true,
              },
            ]
          : []),
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '12px',
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

/** Cover bubble for the detail layout (same size: kilo) */
function buildDetailCoverBubble(
  config: Required<ExportGlobalConfig>,
  themeColor: string,
  totalProductCount: number
): object {
  const hasHero = Boolean(config.heroImageUrl);
  const bodyTextColor = hasHero ? themeColor : '#FFFFFF';
  const badgeBg = hasHero ? themeColor + '22' : 'rgba(255,255,255,0.25)';
  const badgeTextColor = hasHero ? themeColor : '#FFFFFF';

  return {
    type: 'bubble',
    size: DETAIL_BUBBLE_SIZE,
    ...(hasHero
      ? {
          hero: {
            type: 'image',
            url: config.heroImageUrl,
            size: 'full',
            aspectMode: 'cover',
            aspectRatio: '20:13',
            action: { type: 'uri', uri: config.actionUrl },
          },
        }
      : {}),
    styles: {
      body: { backgroundColor: hasHero ? '#FFFFFF' : themeColor },
      footer: { backgroundColor: hasHero ? '#FFFFFF' : themeColor },
    },
    body: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '20px',
      spacing: 'md',
      contents: [
        ...(!hasHero ? [{ type: 'text', text: '🔥', size: '3xl', align: 'center' }] : []),
        {
          type: 'text',
          text: config.title,
          size: 'xl',
          weight: 'bold',
          color: bodyTextColor,
          align: 'center',
          wrap: true,
        },
        {
          type: 'text',
          text: config.intro,
          size: 'sm',
          color: hasHero ? '#475569' : '#FFFFFF',
          align: 'center',
          wrap: true,
          margin: 'md',
        },
        {
          type: 'box',
          layout: 'vertical',
          backgroundColor: badgeBg,
          cornerRadius: '12px',
          paddingAll: '12px',
          margin: 'lg',
          contents: [
            {
              type: 'text',
              text: String(totalProductCount),
              size: '3xl',
              weight: 'bold',
              color: badgeTextColor,
              align: 'center',
            },
            { type: 'text', text: 'รายการสินค้าพร้อมรายละเอียด', size: 'xs', color: badgeTextColor, align: 'center' },
          ],
        },
        {
          type: 'text',
          text: config.footerText,
          size: 'xs',
          color: hasHero ? '#64748B' : '#FFFFFF',
          align: 'center',
          wrap: true,
          margin: 'md',
        },
      ],
    },
    footer: {
      type: 'box',
      layout: 'vertical',
      paddingAll: '16px',
      contents: [
        {
          type: 'button',
          style: 'primary',
          color: themeColor,
          action: { type: 'uri', label: config.ctaLabel, uri: config.actionUrl },
        },
      ],
    },
  };
}

/**
 * Build the carousel `contents` object for one detail-layout carousel.
 * Used for UI preview.
 */
export function buildDetailCarouselContents(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig,
  options: {
    includeCover?: boolean;
    totalProducts?: number;
    heroImageUrl?: string;
  } = {}
): object {
  const resolvedConfig = getResolvedConfig(config);
  if (options.heroImageUrl !== undefined) resolvedConfig.heroImageUrl = options.heroImageUrl;
  const themeColor = resolvedConfig.accentColor || THEME_COLORS[resolvedConfig.theme];
  const { includeCover = true, totalProducts } = options;

  const maxSlots = MAX_CAROUSEL_BUBBLES - (includeCover ? 1 : 0);
  const capped = products.slice(0, maxSlots);

  const bubbles: object[] = [];
  if (includeCover) {
    bubbles.push(buildDetailCoverBubble(resolvedConfig, themeColor, totalProducts ?? products.length));
  }
  capped.forEach((p) => bubbles.push(buildDetailProductBubble(p, resolvedConfig, themeColor)));

  return { type: 'carousel', contents: bubbles };
}

/**
 * Build ALL LINE message objects for the detail layout (1 product / bubble).
 * Returns up to 5 objects (LINE quota): up to 4 Flex carousels + optional text.
 */
export function buildDetailMessages(
  products: ExportPreviewProduct[],
  config: ExportGlobalConfig,
  options: {
    closingText?: string;
    maxCarousels?: number;
  } = {}
): object[] {
  const resolvedConfig = getResolvedConfig(config);
  const { closingText, maxCarousels = 4 } = options;

  const maxFlexMessages = closingText?.trim()
    ? Math.min(maxCarousels, 4)
    : Math.min(maxCarousels, 5);

  const messages: object[] = [];
  let productIndex = 0;
  let carouselIdx = 0;

  while (carouselIdx < maxFlexMessages && productIndex < products.length) {
    const isFirst = carouselIdx === 0;
    const maxSlots = MAX_CAROUSEL_BUBBLES - (isFirst ? 1 : 0);
    const chunk = products.slice(productIndex, productIndex + maxSlots);

    const carouselContents = buildDetailCarouselContents(chunk, resolvedConfig, {
      includeCover: isFirst,
      totalProducts: products.length,
      heroImageUrl: resolvedConfig.heroImageUrl || undefined,
    });

    messages.push({
      type: 'flex',
      altText: resolvedConfig.title,
      contents: carouselContents,
    });

    productIndex += chunk.length;
    carouselIdx++;
  }

  if (closingText?.trim() && messages.length < 5) {
    messages.push({ type: 'text', text: closingText.trim() });
  }

  return messages;
}
