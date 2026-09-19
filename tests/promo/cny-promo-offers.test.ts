import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  buildOffer,
  clearCnyPromoOfferCaches,
  fetchCnyCampaigns,
  formatThaiDate,
  getCachedPrices,
  parseBangkokDate,
  parseCampaigns,
  parsePriceInfo,
  refreshPrices,
  skuFromCard,
  sortOffers,
  type Campaign,
  type PriceInfo,
} from '@/lib/cny-promo-offers';
import type { PromoCard } from '@/lib/cny-news-promo';

/** Shape of one getDataProductIsGroup response, trimmed to what the lib reads. */
const CAMPAIGN_PAYLOAD = {
  data_promotion_only: [
    {
      discount_type: 'discount',
      data_product: [
        {
          campaign_id: 1,
          is_giveaway: 0,
          start_pro: '2026-04-01 00:00:01',
          end_pro: '2026-12-31 00:00:00',
          discount: '7.97',
          discount_type: 'percent',
          qty: 3,
          unit: 'ขวด[240ML]',
          name: 'ยาระบาย',
          id: 668,
          sku: '0672',
          campaign_type: 'discount',
          is_buy_pack: 1,
          campaign_name: 'CNY-BOOM',
        },
        // Same SKU in a campaign that ends sooner — that one should win.
        {
          campaign_id: 2,
          is_giveaway: 0,
          start_pro: '2026-09-01 00:00:00',
          end_pro: '2026-09-30 23:59:00',
          discount: '6.00',
          discount_type: 'baht',
          qty: 1,
          unit: 'ขวด[240ML]',
          name: 'ยาระบาย',
          id: 668,
          sku: '0672',
          campaign_type: 'discount',
          is_buy_pack: 0,
          campaign_name: 'FLASH',
        },
      ],
    },
    {
      discount_type: 'giveaway',
      data_product: [
        {
          campaign_id: 3,
          is_giveaway: 0,
          end_pro: '2026-09-30 00:00:00',
          discount: '0.00',
          discount_type: 'baht',
          qty: 2,
          unit: 'หลอด[30G]',
          name: 'เพนเนลีฟ คูลเจล 30กรัม',
          sku: '1637',
          campaign_type: 'giveaway',
          is_buy_pack: 0,
          campaign_name: 'ซื้อ 2 หลอด รับฟรี 15G อีก 1 หลอด',
        },
        // The free item itself must not become a card offer.
        {
          campaign_id: 3,
          is_giveaway: 1,
          end_pro: '2026-09-30 00:00:00',
          discount: '0.00',
          discount_type: 'baht',
          qty: 1,
          unit: 'หลอด[15G]',
          name: 'เพนเนลีฟ คูลเจล 15กรัม',
          sku: '7119',
          campaign_type: 'giveaway',
          is_buy_pack: 0,
          campaign_name: 'ซื้อ 2 หลอด รับฟรี 15G อีก 1 หลอด',
        },
      ],
    },
  ],
};

const PRODUCT_PAYLOAD = {
  product: [
    {
      product_data: [{ sku: '0003', name: 'ซาร่า โคลด์ 60มล.', name_en: 'SARACOLD SYRUP 60ML' }],
      product_unit: [
        { id: 6, unit: 'ขวด[60ML]', unit_num: '1.00' },
        { id: 7, unit: 'โหล[12ขวด]', unit_num: '12.00' },
      ],
      product_price: [
        { product_price: [{ product_unit_id: 6, price: '64.00', promotion_price: '59.00' }] },
        { product_price: [{ product_unit_id: 7, price: '760.00', promotion_price: '760.00' }] },
      ],
    },
    {
      // A different SKU that a substring search could also return.
      product_data: [{ sku: '10003', name: 'อื่น', name_en: 'OTHER' }],
      product_unit: [{ id: 9, unit: 'ชิ้น', unit_num: '1.00' }],
      product_price: [{ product_price: [{ product_unit_id: 9, price: '10.00', promotion_price: '10.00' }] }],
    },
  ],
};

const productCard = (sku: string): PromoCard => ({
  kind: 'product',
  imageUrl: 'https://manager.cnypharmacy.com/uploads/editor/1.png',
  href: `https://www.cnypharmacy.com/product/${sku}`,
});

const partnerCard: PromoCard = {
  kind: 'partner',
  imageUrl: 'https://manager.cnypharmacy.com/uploads/editor/2.png',
  href: 'https://www.cnypharmacy.com/auth/partner?name=VISTRA',
  partner: 'VISTRA',
};

beforeEach(() => {
  vi.restoreAllMocks();
  clearCnyPromoOfferCaches();
});

describe('parseBangkokDate / formatThaiDate', () => {
  it('reads the API wall-clock time as Bangkok and prints a Thai short date', () => {
    const date = parseBangkokDate('2026-09-30 23:59:00');
    expect(date?.toISOString()).toBe('2026-09-30T16:59:00.000Z');
    expect(formatThaiDate(date!)).toBe('30 ก.ย. 69');
    expect(parseBangkokDate('')).toBeNull();
    expect(parseBangkokDate('not a date')).toBeNull();
  });
});

describe('parseCampaigns', () => {
  it('keeps the soonest-ending campaign per SKU and drops the free items', () => {
    const campaigns = parseCampaigns(CAMPAIGN_PAYLOAD);
    expect([...campaigns.keys()].sort()).toEqual(['0672', '1637']);

    const flash = campaigns.get('0672')!;
    expect(flash.campaignName).toBe('FLASH');
    expect(flash.discountType).toBe('baht');
    expect(flash.endsAt?.toISOString()).toBe('2026-09-30T16:59:00.000Z');

    const gift = campaigns.get('1637')!;
    expect(gift.campaignType).toBe('giveaway');
    expect(gift.qty).toBe(2);
  });

  it('yields an empty map for garbage', () => {
    expect(parseCampaigns(null).size).toBe(0);
    expect(parseCampaigns({ data_promotion_only: 'nope' }).size).toBe(0);
    expect(parseCampaigns({ data_promotion_only: [{ data_product: [{}, 42] }] }).size).toBe(0);
  });
});

describe('parsePriceInfo', () => {
  it('prices the smallest unit, strikes the regular price, and adds the pack line', () => {
    expect(parsePriceInfo(PRODUCT_PAYLOAD, '0003')).toEqual({
      name: 'ซาร่า โคลด์ 60มล.',
      nameEn: 'SARACOLD SYRUP 60ML',
      price: 59,
      oldPrice: 64,
      unit: 'ขวด[60ML]',
      packLine: 'ยกโหล ฿760',
    });
  });

  it('matches the SKU exactly, not as a substring', () => {
    expect(parsePriceInfo(PRODUCT_PAYLOAD, '10003')?.price).toBe(10);
    expect(parsePriceInfo(PRODUCT_PAYLOAD, '0004')).toBeNull();
  });

  it('returns null when no unit carries a price', () => {
    const payload = {
      product: [
        {
          product_data: [{ sku: '1', name: 'x', name_en: '' }],
          product_unit: [{ id: 1, unit: 'ชิ้น', unit_num: '1' }],
          product_price: [{ product_price: [] }],
        },
      ],
    };
    expect(parsePriceInfo(payload, '1')).toBeNull();
    expect(parsePriceInfo('garbage', '1')).toBeNull();
  });
});

describe('buildOffer', () => {
  const campaigns = parseCampaigns(CAMPAIGN_PAYLOAD);
  const prices = new Map<string, PriceInfo>([['0003', parsePriceInfo(PRODUCT_PAYLOAD, '0003')!]]);

  it('tags partner cards as ซื้อครบแถม with no price', () => {
    const offer = buildOffer(partnerCard, campaigns, prices);
    expect(offer.type).toBe('ซื้อครบแถม');
    expect(offer.brand).toBe('VISTRA');
    expect(offer.price).toBeNull();
  });

  it('prints price, discount and unit line from a cached price', () => {
    const offer = buildOffer(productCard('0003'), campaigns, prices);
    expect(offer).toMatchObject({
      type: 'ลดราคา',
      brand: 'ซาร่า โคลด์ 60มล.',
      line: 'SARACOLD SYRUP 60ML',
      price: '฿59',
      off: '-8%',
      unitLine: 'ต่อขวด[60ML]',
      priceValue: 59,
      offValue: 8,
    });
  });

  it('falls back to the campaign when the price is not cached yet', () => {
    const offer = buildOffer(productCard('1637'), campaigns, prices);
    expect(offer.type).toBe('ของแถม');
    expect(offer.brand).toBe('เพนเนลีฟ คูลเจล 30กรัม');
    expect(offer.line).toBe('ซื้อ 2 หลอด รับฟรี 15G อีก 1 หลอด');
    expect(offer.price).toBeNull();
    expect(offer.unitLine).toBeNull();
    expect(offer.endsAt?.toISOString()).toBe('2026-09-29T17:00:00.000Z');
  });

  it('keeps the card to the short name and unit once the price is known', () => {
    const priced = new Map<string, PriceInfo>([
      ['1637', { name: 'เพนเนลีฟ', nameEn: 'PAINELIFE 30G', price: 134, oldPrice: null, unit: 'หลอด[30G]', packLine: 'ยกโหล ฿1,500' }],
      ['0672', { name: 'ยาระบาย', nameEn: 'MILK OF MAGNESIA', price: 90, oldPrice: null, unit: 'ขวด[240ML]', packLine: null }],
    ]);
    const gift = buildOffer(productCard('1637'), campaigns, priced);
    expect(gift.brand).toBe('เพนเนลีฟ');
    expect(gift.line).toBe('ซื้อ 2 หลอด รับฟรี 15G อีก 1 หลอด');
    expect(gift.unitLine).toBe('ต่อหลอด[30G]');

    const discount = buildOffer(productCard('0672'), campaigns, priced);
    expect(discount.line).toBe('MILK OF MAGNESIA');
    expect(discount.unitLine).toBe('ต่อขวด[240ML]');
  });

  it('feeds a campaign percent to the sort without printing it as a discount', () => {
    const packOnly = new Map<string, Campaign>([
      ['0672', { ...campaigns.get('0672')!, buyPack: true, discount: 7.97, discountType: 'percent' }],
    ]);
    expect(buildOffer(productCard('0672'), packOnly, new Map())).toMatchObject({
      type: 'ราคายกแพ็ค',
      off: null,
      offValue: 8,
    });
    // A baht campaign cannot be compared, so it neither prints nor sorts.
    expect(buildOffer(productCard('0672'), campaigns, new Map())).toMatchObject({ off: null, offValue: 0 });
  });

  it('labels an unknown product ราคาพิเศษ by its SKU and leaves plain images bare', () => {
    expect(buildOffer(productCard('9999'), campaigns, prices)).toMatchObject({
      type: 'ราคาพิเศษ',
      brand: 'รหัส 9999',
      price: null,
    });
    const image: PromoCard = { kind: 'image', imageUrl: 'https://x/y.png', href: null };
    expect(buildOffer(image, campaigns, prices).type).toBeNull();
    expect(skuFromCard(image)).toBeNull();
  });
});

describe('sortOffers', () => {
  const campaigns = parseCampaigns(CAMPAIGN_PAYLOAD);
  const prices = new Map<string, PriceInfo>([['0003', parsePriceInfo(PRODUCT_PAYLOAD, '0003')!]]);
  const items = [partnerCard, productCard('1637'), productCard('0003'), productCard('0672')].map(
    (card, index) => ({ index, offer: buildOffer(card, campaigns, prices) })
  );

  it('puts the biggest discount first and keeps CMS order on ties', () => {
    expect(sortOffers(items, 'off').map((item) => item.index)).toEqual([2, 0, 1, 3]);
  });

  it('puts unknown prices last when sorting by price', () => {
    expect(sortOffers(items, 'price').map((item) => item.index)).toEqual([2, 0, 1, 3]);
  });

  it('sorts by brand and does not mutate the input', () => {
    const sorted = sortOffers(items, 'brand');
    expect(sorted.map((item) => item.offer.brand)).toEqual(
      [...items.map((item) => item.offer.brand)].sort((a, b) => a.localeCompare(b, 'th'))
    );
    expect(items.map((item) => item.index)).toEqual([0, 1, 2, 3]);
  });
});

describe('caches', () => {
  it('fetches campaigns once and survives an outage with the last answer', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => CAMPAIGN_PAYLOAD } as Response);
    expect((await fetchCnyCampaigns()).size).toBe(2);
    expect((await fetchCnyCampaigns()).size).toBe(2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('returns an empty map when the API is down and nothing is cached', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    vi.spyOn(console, 'error').mockImplementation(() => {});
    expect((await fetchCnyCampaigns()).size).toBe(0);
  });

  it('serves prices from cache and fills misses in the background', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => PRODUCT_PAYLOAD } as Response);

    // A miss returns nothing but starts the fetch right away.
    expect(getCachedPrices(['0003']).size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(String(fetchMock.mock.calls[0][0])).toContain('search_barcode=0003');
    await vi.waitFor(() => expect(getCachedPrices(['0003']).get('0003')?.price).toBe(59));
    // A fresh hit does not refetch.
    getCachedPrices(['0003']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('caches a miss instead of retrying every render', async () => {
    const fetchMock = vi
      .spyOn(global, 'fetch')
      .mockResolvedValue({ ok: true, status: 200, json: async () => PRODUCT_PAYLOAD } as Response);
    await refreshPrices(['0004']);
    expect(getCachedPrices(['0004']).size).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
