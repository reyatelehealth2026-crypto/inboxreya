import { z } from 'zod';
import type { PromoCard } from './cny-news-promo';

/**
 * Price and campaign data for the /promo cards.
 *
 * The CMS article only carries artwork and links. The numbers on a card — price,
 * strike-through, discount, pack price, end date — come from the store's product
 * API. That API answers every request with a ~1MB envelope (it embeds the full
 * campaign list every time), so:
 *
 *  - campaigns (discount, qty/unit, end date per SKU) are read from ONE request
 *    and cached for ten minutes; the page waits for that.
 *  - per-SKU prices are refreshed in the background and served from cache; the
 *    first view after a cold start renders cards without the baht figure and the
 *    next views fill it in.
 *
 * Everything here is tolerant: an unreachable API yields cards with less on them,
 * never a 500 on a public page.
 */

export const CNY_PRODUCT_API_URL = 'https://www.cnypharmacy.com/api/getDataProductIsGroup';

const CAMPAIGN_TTL_MS = 10 * 60 * 1000;
const PRICE_TTL_MS = 30 * 60 * 1000;
const PRICE_CONCURRENCY = 4;

export type OfferType = 'ซื้อครบแถม' | 'ของแถม' | 'ราคายกแพ็ค' | 'ลดราคา' | 'ราคาพิเศษ';

export interface Campaign {
  sku: string;
  /** Thai product name as the campaign lists it. */
  name: string;
  campaignName: string;
  campaignType: 'discount' | 'giveaway';
  endsAt: Date | null;
  /** Percent or baht off, per discountType. */
  discount: number;
  discountType: 'percent' | 'baht';
  qty: number;
  unit: string;
  buyPack: boolean;
}

export interface PriceInfo {
  name: string;
  nameEn: string;
  /** Selling price of the base unit (promotion price when it is lower). */
  price: number;
  /** Regular price when the promotion price undercuts it. */
  oldPrice: number | null;
  unit: string;
  /** 'ยกโหล ฿760' — the next larger priced unit, if any. */
  packLine: string | null;
}

/** Everything a card prints besides its artwork. */
export interface PromoOffer {
  type: OfferType | null;
  brand: string;
  line: string;
  price: string | null;
  off: string | null;
  unitLine: string | null;
  endsAt: Date | null;
  priceValue: number | null;
  offValue: number;
}

// ---------------------------------------------------------------------------
// Parsing

/** SKUs arrive as strings; a number is tolerated, anything missing is dropped. */
const skuSchema = z
  .preprocess((value) => (typeof value === 'number' ? String(value) : value), z.string().trim())
  .catch('');

const campaignItemSchema = z.object({
  sku: skuSchema,
  name: z.string().catch(''),
  campaign_name: z.string().catch(''),
  campaign_type: z.string().catch('discount'),
  end_pro: z.string().nullable().catch(null),
  discount: z.coerce.number().catch(0),
  discount_type: z.string().catch('percent'),
  qty: z.coerce.number().catch(0),
  unit: z.string().catch(''),
  is_giveaway: z.coerce.number().catch(0),
  is_buy_pack: z.coerce.number().catch(0),
});

const campaignPayloadSchema = z.object({
  data_promotion_only: z
    .array(z.object({ data_product: z.array(z.unknown()).catch([]) }))
    .catch([]),
});

const productRowSchema = z.object({
  product_data: z
    .array(
      z.object({
        sku: skuSchema,
        name: z.string().catch(''),
        name_en: z.string().catch(''),
      })
    )
    .catch([]),
  product_unit: z
    .array(
      z.object({
        id: z.coerce.number(),
        unit: z.string().catch(''),
        unit_num: z.coerce.number().catch(1),
      })
    )
    .catch([]),
  product_price: z
    .array(
      z.object({
        product_price: z
          .array(
            z.object({
              product_unit_id: z.coerce.number(),
              price: z.coerce.number().catch(0),
              promotion_price: z.coerce.number().catch(0),
            })
          )
          .catch([]),
      })
    )
    .catch([]),
});

const productPayloadSchema = z.object({ product: z.array(z.unknown()).catch([]) });

/** '2026-09-30 00:00:00' from the store API is Bangkok wall-clock time. */
export function parseBangkokDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.trim().replace(' ', 'T') + '+07:00');
  return Number.isFinite(date.getTime()) ? date : null;
}

/**
 * Campaign per SKU out of the API envelope. A SKU can sit in several campaigns;
 * the one ending soonest wins, since that is the one worth a countdown.
 */
export function parseCampaigns(payload: unknown): Map<string, Campaign> {
  const map = new Map<string, Campaign>();
  const parsed = campaignPayloadSchema.safeParse(payload);
  if (!parsed.success) return map;

  for (const group of parsed.data.data_promotion_only) {
    for (const raw of group.data_product) {
      const item = campaignItemSchema.safeParse(raw);
      // The free item of a giveaway is listed too; the card is for what you buy.
      if (!item.success || !item.data.sku || item.data.is_giveaway === 1) continue;
      const campaign: Campaign = {
        sku: item.data.sku,
        name: item.data.name.trim(),
        campaignName: item.data.campaign_name.trim(),
        campaignType: item.data.campaign_type === 'giveaway' ? 'giveaway' : 'discount',
        endsAt: parseBangkokDate(item.data.end_pro),
        discount: item.data.discount,
        discountType: item.data.discount_type === 'baht' ? 'baht' : 'percent',
        qty: item.data.qty,
        unit: item.data.unit.trim(),
        buyPack: item.data.is_buy_pack === 1,
      };
      const current = map.get(campaign.sku);
      if (!current || endsBefore(campaign.endsAt, current.endsAt)) map.set(campaign.sku, campaign);
    }
  }
  return map;
}

function endsBefore(a: Date | null, b: Date | null): boolean {
  if (!a) return false;
  if (!b) return true;
  return a.getTime() < b.getTime();
}

/** Price of the base unit (+ pack line) for one SKU out of a product API page. */
export function parsePriceInfo(payload: unknown, sku: string): PriceInfo | null {
  const parsed = productPayloadSchema.safeParse(payload);
  if (!parsed.success) return null;

  for (const raw of parsed.data.product) {
    const row = productRowSchema.safeParse(raw);
    if (!row.success) continue;
    const data = row.data.product_data[0];
    if (!data || data.sku !== sku) continue;

    const priceByUnit = new Map<number, { price: number; promo: number }>();
    for (const group of row.data.product_price) {
      for (const price of group.product_price) {
        if (price.price > 0) {
          priceByUnit.set(price.product_unit_id, { price: price.price, promo: price.promotion_price });
        }
      }
    }
    const priced = row.data.product_unit
      .filter((unit) => priceByUnit.has(unit.id))
      .sort((a, b) => a.unit_num - b.unit_num);
    const base = priced[0];
    if (!base) return null;

    const sell = (unitId: number) => {
      const entry = priceByUnit.get(unitId)!;
      const promo = entry.promo > 0 && entry.promo < entry.price ? entry.promo : null;
      return { price: promo ?? entry.price, oldPrice: promo ? entry.price : null };
    };
    const baseSell = sell(base.id);
    const pack = priced.find((unit) => unit.unit_num > base.unit_num);

    return {
      name: data.name.trim(),
      nameEn: data.name_en.trim(),
      price: baseSell.price,
      oldPrice: baseSell.oldPrice,
      unit: base.unit,
      packLine: pack ? `ยก${pack.unit.replace(/\[.*?\]/, '')} ${formatBaht(sell(pack.id).price)}` : null,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Formatting

export function formatBaht(value: number): string {
  return '฿' + value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}

const thaiDate = new Intl.DateTimeFormat('th-TH-u-ca-buddhist', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
  timeZone: 'Asia/Bangkok',
});

/** '30 ก.ย. 69' */
export function formatThaiDate(date: Date): string {
  return thaiDate.format(date);
}

export function skuFromCard(card: PromoCard): string | null {
  if (card.kind !== 'product' || !card.href) return null;
  const match = /\/product\/(\d+)/i.exec(card.href);
  return match ? match[1] : null;
}

/** Combine a CMS card with whatever the store API knows about its SKU. */
export function buildOffer(
  card: PromoCard,
  campaigns: Map<string, Campaign>,
  prices: Map<string, PriceInfo>
): PromoOffer {
  const none: PromoOffer = {
    type: null,
    brand: '',
    line: '',
    price: null,
    off: null,
    unitLine: null,
    endsAt: null,
    priceValue: null,
    offValue: 0,
  };

  if (card.kind === 'partner') return { ...none, type: 'ซื้อครบแถม', brand: card.partner ?? '' };

  const sku = skuFromCard(card);
  if (!sku) return none;

  const campaign = campaigns.get(sku) ?? null;
  const price = prices.get(sku) ?? null;

  // Only a real strike-through prints as "-N%": a campaign percent applies to a
  // pack condition the artwork already spells out, so it just feeds the sort.
  let offValue = 0;
  let off: string | null = null;
  if (price?.oldPrice) {
    offValue = Math.round((1 - price.price / price.oldPrice) * 100);
    off = `-${offValue}%`;
  } else if (campaign?.discountType === 'percent') {
    offValue = Math.round(campaign.discount);
  }

  const type: OfferType = campaign
    ? campaign.campaignType === 'giveaway'
      ? 'ของแถม'
      : campaign.buyPack
        ? 'ราคายกแพ็ค'
        : 'ลดราคา'
    : price?.oldPrice
      ? 'ลดราคา'
      : 'ราคาพิเศษ';

  // The artwork already carries the promo condition, so the card prints only the
  // short name and the price per base unit; `line` exists for search matching.
  // A price prints only when the store itself has a price promo (a discount
  // campaign, or a promotion price below list): otherwise the store knows only the
  // list price, and printing it beside artwork that advertises a lower one
  // contradicts it. A "buy X get Y free" card shows just its name — the deal is
  // the freebie, not the price.
  const giveaway = campaign?.campaignType === 'giveaway';
  const shown = !giveaway && (campaign || price?.oldPrice) ? price : null;
  return {
    type,
    brand: price?.name || campaign?.name || `รหัส ${sku}`,
    line: giveaway ? campaign.campaignName : (price?.nameEn ?? ''),
    price: shown ? formatBaht(shown.price) : null,
    off: giveaway ? null : off,
    unitLine: shown ? `ต่อ${shown.unit}` : null,
    endsAt: campaign?.endsAt ?? null,
    priceValue: shown?.price ?? null,
    offValue,
  };
}

export type OfferSort = 'off' | 'price' | 'brand';

export function parseOfferSort(value: string | undefined): OfferSort {
  return value === 'price' || value === 'brand' ? value : 'off';
}

/** Stable sort — ties keep the CMS order, which is the marketing team's order. */
export function sortOffers<T extends { offer: PromoOffer }>(items: T[], sort: OfferSort): T[] {
  const indexed = items.map((item, index) => ({ item, index }));
  indexed.sort((a, b) => {
    let cmp = 0;
    if (sort === 'off') cmp = b.item.offer.offValue - a.item.offer.offValue;
    else if (sort === 'price') {
      const pa = a.item.offer.priceValue ?? Number.POSITIVE_INFINITY;
      const pb = b.item.offer.priceValue ?? Number.POSITIVE_INFINITY;
      cmp = pa - pb;
    } else cmp = a.item.offer.brand.localeCompare(b.item.offer.brand, 'th');
    return cmp || a.index - b.index;
  });
  return indexed.map(({ item }) => item);
}

// ---------------------------------------------------------------------------
// Fetching + caches
// ponytail: in-process caches, same as cny-news-promo; move to redis if the app
// ever runs more than one instance

function productApiUrl(params: Record<string, string>): string {
  const query = new URLSearchParams({
    page: '1',
    sort_product_name: 'asc',
    sort_product_sku: '',
    isPageGroup: '0',
    paginate_num: '1',
    search_barcode: '',
    product_sub_type: '',
    supplier: '0',
    see_query: '0',
    new_sort_type: '0',
    ...params,
  });
  return `${CNY_PRODUCT_API_URL}?${query.toString()}`;
}

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`upstream ${response.status}`);
  return response.json();
}

let campaignCache: { at: number; campaigns: Map<string, Campaign> } | null = null;

/** Campaign per SKU, ten-minute cache; the last good answer survives an outage. */
export async function fetchCnyCampaigns(): Promise<Map<string, Campaign>> {
  if (campaignCache && Date.now() - campaignCache.at < CAMPAIGN_TTL_MS) {
    return campaignCache.campaigns;
  }
  try {
    const campaigns = parseCampaigns(await fetchJson(productApiUrl({})));
    campaignCache = { at: Date.now(), campaigns };
    return campaigns;
  } catch (error) {
    console.error('[cny-promo-offers] campaign fetch failed', error);
    return campaignCache?.campaigns ?? new Map();
  }
}

const priceCache = new Map<string, { at: number; info: PriceInfo | null }>();
const priceInFlight = new Set<string>();
/** Bumped by clearCnyPromoOfferCaches so a worker from before the clear stops writing. */
let priceGeneration = 0;

/**
 * Prices already in cache for these SKUs. Missing or stale ones are refreshed
 * in the background — the page never waits on a hundred 1MB responses — unless
 * `refreshStale` is false (the Flex builder awaits its own short list instead).
 */
export function getCachedPrices(skus: string[], refreshStale = true): Map<string, PriceInfo> {
  const found = new Map<string, PriceInfo>();
  const stale: string[] = [];
  for (const sku of new Set(skus)) {
    const hit = priceCache.get(sku);
    if (hit?.info) found.set(sku, hit.info);
    if (!hit || Date.now() - hit.at > PRICE_TTL_MS) stale.push(sku);
  }
  if (refreshStale && stale.length > 0) void refreshPrices(stale);
  return found;
}

/** Fetch each SKU's price into the cache. Exported so tests can await the fill. */
export async function refreshPrices(skus: string[]): Promise<void> {
  const queue = skus.filter((sku) => !priceInFlight.has(sku));
  queue.forEach((sku) => priceInFlight.add(sku));

  const generation = priceGeneration;
  const worker = async () => {
    for (let sku = queue.shift(); sku !== undefined; sku = queue.shift()) {
      if (generation !== priceGeneration) return;
      let info: PriceInfo | null = priceCache.get(sku)?.info ?? null;
      try {
        const payload = await fetchJson(productApiUrl({ search_barcode: sku, paginate_num: '5' }));
        info = parsePriceInfo(payload, sku);
      } catch (error) {
        console.error('[cny-promo-offers] price fetch failed', sku, error);
      }
      priceCache.set(sku, { at: Date.now(), info });
      priceInFlight.delete(sku);
    }
  };
  await Promise.all(Array.from({ length: PRICE_CONCURRENCY }, worker));
}

/** Test hook: forget every cached campaign and price. */
export function clearCnyPromoOfferCaches(): void {
  campaignCache = null;
  priceCache.clear();
  priceInFlight.clear();
  priceGeneration += 1;
}
