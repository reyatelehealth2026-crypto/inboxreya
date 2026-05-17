// Custom Flex builder: 2 products per bubble (1 cover + N 2-up product bubbles).
//
// Usage:
//   echo '<payload>' | node build-flex-2up.cjs > flex.json
//   node build-flex-2up.cjs path/to/payload.json > flex.json
//
// Payload shape: { cny:{product:[...]}, theme, title, intro, ctaLabel,
//   badgeText, actionUrl, footerText, closingText }
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
const themeColor  = THEME[theme].color;
const themeIcon   = THEME[theme].icon;
const title       = payload.title || 'โปรโมชันพิเศษ';
const intro       = payload.intro || '';
const ctaLabel    = payload.ctaLabel || 'ซื้อเลย';
const badgeText   = payload.badgeText || 'PROMOTION';
const actionUrl   = payload.actionUrl || CNY_BASE;
const footerText  = payload.footerText || 'สนใจตัวไหน แจ้งรหัสส่งกลับมาได้เลย';
const closingText = payload.closingText || '';

const toN = v => { if (v == null) return 0; const n = typeof v === 'number' ? v : Number(v); return Number.isFinite(n) ? n : 0; };

function mapProduct(it) {
  const d = it.product_data?.[0] || {};
  const photo = it.product_photo?.[0]?.photo_path || null;
  const pi = it.product_price?.[0]?.product_price?.[0];
  const basePrice = toN(pi?.price);
  const promoRaw  = toN(pi?.promotion_price);
  const promotionPrice = promoRaw > 0 && promoRaw < basePrice ? promoRaw : null;
  return {
    sku: d.sku,
    name: d.name || '',
    image: photo ? `${CNY_IMG}/${photo}` : PLACEHOLDER,
    basePrice,
    promotionPrice,
    unit: it.product_unit?.[0]?.unit || '',
    url: d.sku ? `${CNY_BASE}/product/${d.sku}` : actionUrl,
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
            { type: 'text', text: 'รายการวิตามินซีพร้อมรายละเอียด', color: '#FFFFFFcc', align: 'center', size: 'xs', margin: 'sm' },
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

function buildHalf(p, isFirst) {
  return {
    type: 'box', layout: 'vertical', spacing: 'sm',
    paddingTop: isFirst ? 'none' : 'lg',
    contents: [
      { type: 'image', url: p.image, aspectRatio: '20:13', aspectMode: 'cover', size: 'full' },
      { type: 'box', layout: 'vertical', spacing: 'xs', paddingTop: 'sm', contents: [
        { type: 'text', text: `SKU ${p.sku}`, size: 'xxs', color: themeColor, weight: 'bold' },
        { type: 'text', text: p.name, size: 'sm', weight: 'bold', wrap: true, maxLines: 2, color: '#1A202C' },
      ]},
      { type: 'box', layout: 'horizontal', alignItems: 'center', paddingTop: 'xs', contents: [
        ...(p.promotionPrice != null ? [
          { type: 'text', text: `฿${p.promotionPrice.toFixed(0)}`, size: 'lg', weight: 'bold', color: themeColor, flex: 0 },
          { type: 'text', text: `฿${p.basePrice.toFixed(0)}`, size: 'sm', color: '#A0AEC0', decoration: 'line-through', margin: 'sm', flex: 0 },
        ] : [
          { type: 'text', text: `฿${p.basePrice.toFixed(0)}`, size: 'lg', weight: 'bold', color: themeColor, flex: 0 },
        ]),
        { type: 'filler' },
        { type: 'text', text: p.unit || ' ', size: 'xs', color: '#718096', align: 'end', flex: 0 },
      ]},
      { type: 'button', style: 'primary', color: themeColor, height: 'sm', margin: 'sm',
        action: { type: 'uri', label: ctaLabel, uri: p.url } },
    ],
  };
}

function build2UpBubble(pair) {
  const contents = [
    { type: 'box', layout: 'horizontal', backgroundColor: themeColor, paddingAll: 'sm', cornerRadius: 'md',
      contents: [{ type: 'text', text: badgeText, color: '#FFFFFF', weight: 'bold', size: 'sm', align: 'center' }] },
    buildHalf(pair[0], true),
  ];
  if (pair.length === 2) {
    contents.push({ type: 'separator', margin: 'lg', color: '#E2E8F0' });
    contents.push(buildHalf(pair[1], false));
  }
  return {
    type: 'bubble', size: 'mega',
    body: { type: 'box', layout: 'vertical', spacing: 'md', paddingAll: 'lg', contents },
  };
}

const pairs = [];
for (let i = 0; i < products.length; i += 2) pairs.push(products.slice(i, i + 2));

const bubbles = [buildCover(), ...pairs.map(build2UpBubble)];

const MAX_BUBBLES = 12;
const carousels = [];
for (let i = 0; i < bubbles.length; i += MAX_BUBBLES) carousels.push(bubbles.slice(i, i + MAX_BUBBLES));

const messages = carousels.map(b => ({
  type: 'flex', altText: title, contents: { type: 'carousel', contents: b },
}));

if (closingText.trim()) messages.push({ type: 'text', text: closingText.trim() });

if (messages.length > 5) {
  console.error('build-flex-2up: too many messages:', messages.length);
  process.exit(1);
}

process.stdout.write(JSON.stringify(messages));
