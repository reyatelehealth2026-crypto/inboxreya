import { describe, it, expect, beforeAll, vi } from 'vitest';
import { render } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

vi.mock('@/lib/prisma', () => ({ default: {}, prisma: {} }));

import { clearCnyNewsPromoCache } from '@/lib/cny-news-promo';
import { clearCnyPromoOfferCaches, refreshPrices } from '@/lib/cny-promo-offers';
import { DEFAULT_PROMO_PAGE_SETTINGS } from '@/lib/promo-page-settings';
import { loadPromoData, type PromoRow } from '@/lib/promo-data';
import {
  buildPromoFlexMessages,
  flexImageUrls,
  heroImageUrl,
  imageSize,
  lineUri,
  selectFlexItems,
  toAspectRatio,
  type FlexMessage,
} from '@/lib/promo-flex';
import { collectFlexLinks } from '@/lib/broadcast-runtime';
import { FlexPreview } from '@/components/inbox/FlexPreview';

const FIXTURE = readFileSync(path.join(__dirname, 'fixtures', 'news-12.html'), 'utf8');
const ORIGIN = 'https://inbox.example.com';
const NOW = Date.UTC(2026, 8, 21);

/** SKU 6117 (first product card in the fixture): priced, discounted, in a campaign. */
const STORE = {
  product: [
    {
      product_data: [{ sku: '6117', name: 'ดีเดย์ ไนท์ สตอรี่ 30เม็ด', name_en: 'DEEDAY NIGHT STORY 30S' }],
      product_unit: [{ id: 1, unit: 'กล่อง[30เม็ด]', unit_num: '1.00' }],
      product_price: [{ product_price: [{ product_unit_id: 1, price: '428.00', promotion_price: '399.00' }] }],
    },
  ],
  data_promotion_only: [
    {
      discount_type: 'discount',
      data_product: [
        {
          sku: '6117',
          name: 'ดีเดย์ ไนท์ สตอรี่ 30เม็ด',
          campaign_name: 'CNY-BOOM',
          campaign_type: 'discount',
          end_pro: '2026-09-30 23:59:00',
          discount: '6.78',
          discount_type: 'percent',
          qty: 3,
          unit: 'กล่อง[30เม็ด]',
          is_giveaway: 0,
          is_buy_pack: 1,
        },
      ],
    },
  ],
};

const ok = (body: unknown) => ({ ok: true, status: 200, json: async () => body }) as Response;

let rows: PromoRow[];
let messages: FlexMessage[];

beforeAll(async () => {
  clearCnyNewsPromoCache();
  clearCnyPromoOfferCaches();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  global.fetch = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes('home_system_page')) return ok({ news: [{ id: 12, title: 'รวมโปรโมชั่น', content: FIXTURE }] });
    if (url.includes('getDataProductIsGroup')) return ok(STORE);
    throw new Error(`no network: ${url}`);
  }) as unknown as typeof fetch;

  const settings = { ...DEFAULT_PROMO_PAGE_SETTINGS };
  await refreshPrices(['6117']);
  rows = (await loadPromoData(settings, 'cnyhealth', false))!.rows;
  const selection = selectFlexItems(rows, NOW);
  const hero = heroImageUrl(settings, rows);
  messages = buildPromoFlexMessages({
    selection,
    heroImageUrl: hero,
    origin: ORIGIN,
    now: NOW,
    ratios: new Map(flexImageUrls(selection, hero).map((url) => [url, '1040:700'])),
  });
});

type Node = Record<string, unknown>;
function walk(node: unknown, visit: (n: Node) => void): void {
  if (!node || typeof node !== 'object') return;
  if (Array.isArray(node)) return node.forEach((child) => walk(child, visit));
  visit(node as Node);
  Object.values(node as Node).forEach((child) => walk(child, visit));
}
const texts = (message: FlexMessage) => {
  const out: string[] = [];
  walk(message.contents, (n) => {
    if (n.type === 'text') out.push(String(n.text));
  });
  return out;
};

describe('buildPromoFlexMessages', () => {
  it('mirrors the page: hero, deals ending soon, then each card row — within LINE limits', () => {
    expect(messages.length).toBeLessThanOrEqual(5);
    expect(messages.map((m) => m.altText.split(' · ')[0])).toEqual([
      'รวมโปรโมชัน CNY',
      'ดีลใกล้หมดเวลา',
      'ดีลแบรนด์พาร์ทเนอร์',
      'สินค้าราคาพิเศษ',
    ]);

    const hero = messages[0].contents as Node;
    expect(hero).toMatchObject({
      type: 'bubble',
      size: 'giga',
      hero: { aspectRatio: '1040:700', action: { uri: `${ORIGIN}/promo` } },
    });

    for (const message of messages.slice(1)) {
      const bubbles = (message.contents as { contents: Node[] }).contents;
      expect(bubbles.length).toBeLessThanOrEqual(12);
      expect(new Set(bubbles.map((b) => b.size)).size).toBe(1);
      expect(JSON.stringify(message.contents).length).toBeLessThan(50_000);
    }
  });

  it('prices the deal card like the page, with the days-left chip on the title card', () => {
    const deal = texts(messages[1]);
    expect(deal).toContain('เหลือ 10 วัน');
    expect(deal).toContain('ดีเดย์ ไนท์ สตอรี่ 30เม็ด');
    expect(deal).toEqual(expect.arrayContaining(['฿399', 'ต่อกล่อง[30เม็ด]', '-7%']));
  });

  it('gives partner cards the wide size and the chat pill; every link is https with a short label', () => {
    const partners = messages[2].contents as { contents: Node[] };
    expect(partners.contents[0].size).toBe('kilo');
    expect(texts(messages[2])).toContain('สั่งผ่านแชท');

    const actions: Node[] = [];
    messages.forEach((m) =>
      walk(m.contents, (n) => {
        if (n.type === 'uri') actions.push(n);
      })
    );
    expect(actions.every((a) => String(a.uri).startsWith('https://'))).toBe(true);
    expect(actions.every((a) => String(a.label).length <= 20)).toBe(true);
    expect(actions.some((a) => String(a.uri).startsWith('https://line.me/R/oaMessage/@cnyhealth/'))).toBe(true);
  });

  it('stacks the wide partner strips three to a bubble, each with its name and chat pill', () => {
    const bubbles = (messages[2].contents as { contents: Node[] }).contents;
    const stacked = bubbles[1];
    const images: Node[] = [];
    walk(stacked, (n) => {
      if (n.type === 'image') images.push(n);
    });
    expect(images).toHaveLength(3);
    expect(images.every((img) => img.aspectRatio === '1040:700')).toBe(true);
    const stackedTexts = texts({ type: 'flex', altText: '', contents: stacked });
    expect(stackedTexts.filter((t) => t === 'สั่งผ่านแชท')).toHaveLength(3);
    expect(stackedTexts).toEqual(expect.arrayContaining(['VISTRA']));
    // The regular cards follow, one per bubble, each with a hero image.
    expect(bubbles[2].hero).toBeDefined();
  });

  it('sends LINE only encoded links and non-empty texts (what the test push tripped on)', () => {
    const problems: string[] = [];
    messages.forEach((m, i) =>
      walk(m.contents, (n) => {
        if (n.type === 'text' && !String(n.text ?? '').trim()) problems.push(`message ${i}: empty text`);
        if (n.type === 'uri' && new URL(String(n.uri)).href !== n.uri) problems.push(`message ${i}: ${n.uri}`);
      })
    );
    expect(problems).toEqual([]);
    expect(lineUri('https://www.cnypharmacy.com/auth/partner?name=SMOOTH E')).toBe(
      'https://www.cnypharmacy.com/auth/partner?name=SMOOTH%20E'
    );
  });

  it('tracks every link except the LINE chat links', () => {
    const links = collectFlexLinks(messages as unknown as Record<string, unknown>[]);
    expect(links.length).toBeGreaterThan(10);
    expect(links).toContain(`${ORIGIN}/promo?s=section-6`);
    expect(links.some((l) => l.includes('line.me'))).toBe(false);
  });

  it('renders in the inbox FlexPreview', () => {
    for (const message of messages) {
      const { container, unmount } = render(<FlexPreview flex={message} />);
      expect(container.textContent).not.toContain('ไม่สามารถแสดง');
      unmount();
    }
  });
});

describe('image ratio helpers', () => {
  it('reads PNG, GIF and JPEG headers', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47], 0);
    png.set([0, 0, 4, 16, 0, 0, 2, 188], 16);
    expect(imageSize(png)).toEqual({ width: 1040, height: 700 });

    const gif = new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x10, 0x04, 0xbc, 0x02]);
    expect(imageSize(gif)).toEqual({ width: 1040, height: 700 });

    // SOI, APP0 (length 16), SOF0 with height 700, width 1040
    const jpeg = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, ...new Array(14).fill(0),
      0xff, 0xc0, 0x00, 0x11, 0x08, 0x02, 0xbc, 0x04, 0x10, 0x03,
    ]);
    expect(imageSize(jpeg)).toEqual({ width: 1040, height: 700 });
    expect(imageSize(new Uint8Array([1, 2, 3]))).toBeNull();
  });

  it('caps height at three times the width', () => {
    expect(toAspectRatio({ width: 1040, height: 700 })).toBe('1040:700');
    expect(toAspectRatio({ width: 100, height: 900 })).toBe('100:300');
    expect(toAspectRatio({ width: 0, height: 10 })).toBeNull();
  });
});
