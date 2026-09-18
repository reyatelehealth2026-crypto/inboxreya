// build-flex-2up.cjs — cover bubble + product bubbles, with selectable layout:
//   layout='1up' (default): 1 product per bubble, full-size cards (hero 4:3,
//     SPECIAL OFFER box, in-stock pill, SKU label, name, subline, promo terms,
//     price, CTA — matches the CNY storefront card style).
//   layout='2up': 2 products per bubble, vertically stacked compact cards
//     (smaller hero 16:9 + SKU + name + promo line + price/CTA row), separated
//     by a divider. Last unpaired product shows as a single mini-card.
//
// Carousels are auto-split at 12 bubbles each, capped at 5 LINE messages total
// (LINE broadcast quota per push). Reads promos[] attached by reshapeForFlex.
//
// Usage:
//   echo '<payload>' | node build-flex-2up.cjs > flex.json
//   node build-flex-2up.cjs path/to/payload.json > flex.json
//
// Payload: { cny:{product:[...]}, theme, layout, title, intro, ctaLabel,
//            badgeText, actionUrl, footerText, closingText }
//
// Each product in cny.product may carry a `promos[]` field (from refresh-cache
// snapshot). When present, the promo terms box + date range are rendered from
// it; otherwise both are omitted.
const fs = require('fs');

function readPayload() {
  const argPath = process.argv[2];
  if (argPath && fs.existsSync(argPath)) {
    return JSON.parse(fs.readFileSync(argPath, 'utf8'));
  }
  return JSON.parse(fs.readFileSync(0, 'utf8'));
}

const payload = readPayload();
const CNY_IMG = 'https://manager.cnypharmacy.com';
const CNY_BASE = 'https://www.cnypharmacy.com';
const PLACEHOLDER = `${CNY_IMG}/uploads/product_photo/placeholder.jpg`;

const THEME = {
  promotion:       { color: '#E53E3E', icon: '🔥' },
  flash_sale:      { color: '#D69E2E', icon: '⚡' },
  bestseller:      { color: '#15803D', icon: '🏆' },
  new_arrival:     { color: '#805AD5', icon: '✨' },
  product_catalog: { color: '#4299E1', icon: '🛍️' },
};

const theme       = payload.theme || 'promotion';
const themeColor  = (THEME[theme] || THEME.promotion).color;
const themeIcon   = (THEME[theme] || THEME.promotion).icon;
const layout      = payload.layout === '2up' ? '2up' : '1up';
const title       = payload.title || 'โปรโมชันพิเศษ';
const intro       = payload.intro || '';
const ctaLabel    = payload.ctaLabel || 'ซื้อเลย';
const badgeText   = payload.badgeText || 'SPECIAL OFFER';
const actionUrl   = payload.actionUrl || CNY_BASE;
const footerText  = payload.footerText || 'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย';
const closingText = payload.closingText || '';

const toN = v => { if (v == null) return 0; const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

function formatDate(s) {
  if (!s) return '';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return String(s).slice(0, 10);
  const pad = n => String(n).padStart(2, '0');
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}`;
}

function formatPromoLine(promo) {
  const qty = toN(promo.qty);
  const unit = promo.unit || '';
  const disc = toN(promo.discount);
  const isPercent = promo.discountUnit === 'percent';
  const suffix = isPercent ? '%' : 'บาท';
  if (promo.isGiveaway) {
    return `ซื้อ ${qty} ${unit} แถมฟรี`;
  }
  if (promo.isBuyPack) {
    return `ซื้อยกแพ็ค ${qty} ${unit} ลด ${disc} ${suffix}`;
  }
  return `ซื้อ ${qty} ${unit} ขึ้นไป ลด${unit} ละ ${disc} ${suffix}`;
}

function mapProduct(it) {
  const d = it.product_data?.[0] || {};
  const photo = it.product_photo?.[0]?.photo_path || null;
  const pi = it.product_price?.[0]?.product_price?.[0];
  const basePrice = toN(pi?.price);
  const promoRaw  = toN(pi?.promotion_price);
  const promotionPrice = promoRaw > 0 && promoRaw < basePrice ? promoRaw : null;
  const stockTotal = (it.product_stock || []).reduce((s, x) => s + toN(x.stock_num), 0);
  return {
    sku: d.sku,
    name: d.name || '',
    nameEn: (d.name_en || '').trim(),
    specName: (d.spec_name || '').trim(),
    image: photo ? (photo.startsWith('http') ? photo : `${CNY_IMG}/${photo}`) : PLACEHOLDER,
    basePrice,
    promotionPrice,
    unit: it.product_unit?.[0]?.unit || '',
    stock: stockTotal,
    url: d.sku ? `${CNY_BASE}/product/${d.sku}` : actionUrl,
    promos: Array.isArray(it.promos) ? it.promos : [],
  };
}

const products = (payload.cny?.product || []).map(mapProduct);

function buildCover() {
  return {
    type: 'bubble', size: 'mega',
    styles: { body: { backgroundColor: themeColor }, footer: { backgroundColor: themeColor } },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'xl',
      contents: [
        { type: 'text', text: themeIcon, size: 'xxl', align: 'center' },
        { type: 'text', text: title, weight: 'bold', size: 'xl', color: '#FFFFFF', align: 'center', wrap: true },
        { type: 'text', text: intro, size: 'sm', color: '#FFFFFF', align: 'center', wrap: true, margin: 'md' },
        { type: 'box', layout: 'vertical', backgroundColor: '#FFFFFF22', cornerRadius: 'md',
          paddingAll: 'md', margin: 'xl',
          contents: [
            { type: 'text', text: `${products.length} รายการ`, color: '#FFFFFF', weight: 'bold', align: 'center', size: 'lg' },
            { type: 'text', text: 'รายการสินค้าพร้อมรายละเอียด', color: '#FFFFFFcc', align: 'center', size: 'xs', margin: 'sm' },
          ]},
        { type: 'text', text: footerText, color: '#FFFFFFcc', size: 'xs', align: 'center', wrap: true, margin: 'lg' },
      ],
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: 'md',
      contents: [
        { type: 'button', style: 'secondary', height: 'sm', color: '#FFFFFF',
          action: { type: 'uri', label: 'ดูทั้งหมด', uri: actionUrl } },
      ],
    },
  };
}

function specialOfferBox(promos) {
  const first = promos[0];
  const dateRows = [];
  if (first?.startPro) {
    dateRows.push({ type: 'text', text: `เริ่ม ${formatDate(first.startPro)}`, size: 'sm', color: '#E53E3E', align: 'center', weight: 'bold' });
  }
  if (first?.endPro) {
    dateRows.push({ type: 'text', text: `ถึง ${formatDate(first.endPro)}`, size: 'sm', color: '#E53E3E', align: 'center', weight: 'bold' });
  }
  return {
    type: 'box', layout: 'vertical', spacing: 'xs',
    borderColor: '#E53E3E', borderWidth: '2px', cornerRadius: '8px',
    paddingAll: '10px', backgroundColor: '#FFFFFF',
    contents: [
      { type: 'box', layout: 'vertical', flex: 0, alignItems: 'center',
        contents: [
          { type: 'box', layout: 'vertical', flex: 0,
            backgroundColor: '#E53E3E', cornerRadius: '4px',
            paddingTop: '4px', paddingBottom: '4px',
            paddingStart: '12px', paddingEnd: '12px',
            contents: [
              { type: 'text', text: badgeText, color: '#FFFFFF', weight: 'bold', size: 'xs', align: 'center' },
            ],
          },
        ],
      },
      ...dateRows,
    ],
  };
}

function promoTermsBox(promos) {
  if (!promos || promos.length === 0) return null;
  const lines = promos.slice(0, 3).map(p => ({
    type: 'text', text: formatPromoLine(p),
    size: 'xs', color: '#E53E3E', weight: 'bold', wrap: true, align: 'center',
  }));
  return {
    type: 'box', layout: 'vertical', spacing: 'xs',
    borderColor: '#E53E3E', borderWidth: '1px', cornerRadius: '6px',
    paddingAll: '8px', backgroundColor: '#FFFFFF',
    contents: lines,
  };
}

function inStockPill() {
  return {
    type: 'box', layout: 'horizontal', flex: 0, alignItems: 'center',
    contents: [
      { type: 'filler' },
      { type: 'box', layout: 'vertical', flex: 0,
        backgroundColor: '#16A34A', cornerRadius: '999px',
        paddingTop: '2px', paddingBottom: '2px',
        paddingStart: '8px', paddingEnd: '8px',
        contents: [{ type: 'text', text: '✓ มีสินค้า', color: '#FFFFFF', size: 'xxs', weight: 'bold' }] },
      { type: 'filler' },
    ],
  };
}

function buildProductBubble(p) {
  const bodyContents = [];

  bodyContents.push(specialOfferBox(p.promos));

  if (p.stock > 0) bodyContents.push(inStockPill());

  bodyContents.push({
    type: 'text', text: `รหัสสินค้า ${p.sku}`,
    size: 'xs', color: '#64748B', margin: 'md',
  });

  bodyContents.push({
    type: 'text', text: p.name,
    size: 'md', weight: 'bold', color: '#0F172A',
    wrap: true, maxLines: 3,
  });

  const subline = (p.specName || p.nameEn || '').trim();
  if (subline) {
    bodyContents.push({
      type: 'text', text: subline,
      size: 'xs', color: '#64748B', wrap: true, maxLines: 2,
    });
  }

  const termsBox = promoTermsBox(p.promos);
  if (termsBox) bodyContents.push(termsBox);

  const priceText = `${p.basePrice.toFixed(2)} -/ ${p.unit || '-'}`;
  bodyContents.push({
    type: 'text', text: priceText,
    size: 'md', weight: 'bold', color: '#0F172A',
    margin: 'sm',
  });

  return {
    type: 'bubble', size: 'mega',
    hero: {
      type: 'image', url: p.image, size: 'full',
      aspectRatio: '4:3', aspectMode: 'cover',
      action: { type: 'uri', uri: p.url },
    },
    body: {
      type: 'box', layout: 'vertical', spacing: 'md', paddingAll: '16px',
      contents: bodyContents,
    },
    footer: {
      type: 'box', layout: 'vertical', paddingAll: '12px',
      contents: [
        { type: 'button', style: 'primary', color: themeColor, height: 'sm',
          action: { type: 'uri', label: ctaLabel, uri: p.url } },
      ],
    },
  };
}

function buildMiniCard(p) {
  const contents = [];
  contents.push({
    type: 'image', url: p.image, size: 'full',
    aspectRatio: '16:9', aspectMode: 'cover',
    action: { type: 'uri', uri: p.url },
  });

  const first = (p.promos || [])[0];
  if (first && (first.startPro || first.endPro)) {
    const datePart = [
      first.startPro ? `เริ่ม ${formatDate(first.startPro)}` : '',
      first.endPro ? `ถึง ${formatDate(first.endPro)}` : '',
    ].filter(Boolean).join(' · ');
    contents.push({
      type: 'text', text: `${badgeText} · ${datePart}`,
      size: 'xxs', color: '#FFFFFF', align: 'center', weight: 'bold', wrap: false,
      margin: 'sm', backgroundColor: themeColor,
    });
  }

  contents.push({
    type: 'text', text: `รหัสสินค้า ${p.sku}`,
    size: 'xxs', color: '#64748B', margin: 'sm',
  });
  contents.push({
    type: 'text', text: p.name,
    size: 'sm', weight: 'bold', color: '#0F172A',
    wrap: true, maxLines: 2,
  });

  if (first) {
    contents.push({
      type: 'text', text: formatPromoLine(first),
      size: 'xxs', color: themeColor, weight: 'bold', wrap: true, maxLines: 1, margin: 'xs',
    });
  }

  contents.push({
    type: 'box', layout: 'horizontal', margin: 'sm', alignItems: 'center', spacing: 'sm',
    contents: [
      { type: 'text', text: `฿${p.basePrice.toFixed(0)}/${p.unit || '-'}`,
        size: 'sm', weight: 'bold', color: '#0F172A', flex: 5, wrap: false },
      { type: 'button', style: 'primary', color: themeColor, height: 'sm', flex: 4,
        action: { type: 'uri', label: ctaLabel, uri: p.url } },
    ],
  });

  return {
    type: 'box', layout: 'vertical', spacing: 'xs', paddingAll: '8px',
    contents,
  };
}

function buildProductPairBubble(p1, p2) {
  const body = [buildMiniCard(p1)];
  if (p2) {
    body.push({ type: 'separator', margin: 'md', color: '#E2E8F0' });
    body.push(buildMiniCard(p2));
  }
  return {
    type: 'bubble', size: 'mega',
    body: {
      type: 'box', layout: 'vertical', spacing: 'sm', paddingAll: '8px',
      contents: body,
    },
  };
}

let productBubbles;
if (layout === '2up') {
  productBubbles = [];
  for (let i = 0; i < products.length; i += 2) {
    productBubbles.push(buildProductPairBubble(products[i], products[i + 1]));
  }
} else {
  productBubbles = products.map(buildProductBubble);
}
const bubbles = [buildCover(), ...productBubbles];

const MAX_BUBBLES = 12;
const carousels = [];
for (let i = 0; i < bubbles.length; i += MAX_BUBBLES) carousels.push(bubbles.slice(i, i + MAX_BUBBLES));

const messages = carousels.map(b => ({
  type: 'flex', altText: title, contents: { type: 'carousel', contents: b },
}));

if (closingText.trim()) messages.push({ type: 'text', text: closingText.trim() });

const MAX_MESSAGES = 5;
if (messages.length > MAX_MESSAGES) {
  const productsPerBubble = layout === '2up' ? 2 : 1;
  const closingSlots = closingText.trim() ? 1 : 0;
  const maxCarousels = MAX_MESSAGES - closingSlots;
  const maxProducts = (maxCarousels * MAX_BUBBLES - 1) * productsPerBubble; // -1 bubble reserved for cover
  console.error(`build-flex-2up: too many messages: ${messages.length} (layout=${layout}, products=${products.length}). LINE quota=${MAX_MESSAGES}; for layout=${layout} reduce products to ≤${maxProducts}.`);
  process.exit(1);
}

process.stdout.write(JSON.stringify(messages));
