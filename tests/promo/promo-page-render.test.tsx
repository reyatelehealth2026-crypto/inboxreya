import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// vi.mock is hoisted above the imports, so the mock fn has to be hoisted too.
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock('@/lib/prisma', () => ({
  default: { lineAccount: { findFirst } },
  prisma: { lineAccount: { findFirst } },
}));

import PromoPage from '@/app/promo/page';
import { clearCnyNewsPromoCache } from '@/lib/cny-news-promo';
import { clearCnyPromoOfferCaches, refreshPrices } from '@/lib/cny-promo-offers';
import { DEFAULT_PROMO_PAGE_SETTINGS } from '@/lib/promo-page-settings';
import { signPreview } from '@/lib/promo-preview';

const FIXTURE = readFileSync(path.join(__dirname, 'fixtures', 'news-12.html'), 'utf8');

// The page kicks off background price fetches; none of them may reach the network
// after a test has restored its mocks, so the real fetch is never on the global.
global.fetch = vi.fn(async () => {
  throw new Error('no network in tests');
}) as unknown as typeof fetch;

const ACCOUNT = {
  basicId: 'cnyhealth',
  settings: {
    liff: { id: 'keep-me' },
    promoPage: {
      newsId: 12,
      colsMobile: 2,
      colsDesktop: 4,
      showTabs: true,
      showChatButton: true,
      chatText: 'สนใจโปร {partner}',
    },
  },
};

/** One store API answer: SKU 6117 (first product card in the fixture) priced and in a campaign. */
const STORE = {
  product: [
    {
      product_data: [{ sku: '6117', name: 'ดีเดย์ ไนท์ สตอรี่ 30เม็ด', name_en: "DEEDAY NIGHT'S STORY 30'S" }],
      product_unit: [
        { id: 1, unit: 'กล่อง[30เม็ด]', unit_num: '1.00' },
        { id: 2, unit: 'โหล', unit_num: '12.00' },
      ],
      product_price: [
        { product_price: [{ product_unit_id: 1, price: '428.00', promotion_price: '399.00' }] },
        { product_price: [{ product_unit_id: 2, price: '4800.00', promotion_price: '4800.00' }] },
      ],
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
          end_pro: '2099-12-31 00:00:00',
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

function mockApis({ store = true }: { store?: boolean } = {}) {
  vi.spyOn(global, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes('home_system_page')) {
      return ok({ news: [{ id: 12, title: 'รวมโปรโมชั่น', content: FIXTURE }] });
    }
    if (url.includes('getDataProductIsGroup') && store) return ok(STORE);
    throw new Error(`ECONNREFUSED ${url}`);
  });
}

/** Render the server component's resolved tree. */
async function renderPromoPage(params: { k?: string; s?: string; q?: string; sort?: string } = {}) {
  const tree = await PromoPage({ searchParams: Promise.resolve(params) });
  return render(tree);
}

beforeEach(() => {
  vi.restoreAllMocks();
  clearCnyNewsPromoCache();
  clearCnyPromoOfferCaches();
  findFirst.mockResolvedValue(ACCOUNT);
  vi.spyOn(console, 'error').mockImplementation(() => {});
  // jsdom has no scrollIntoView; the focus island calls it.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('/promo home', () => {
  it('turns the CMS article into a hero, a deal rail and one row per card section', async () => {
    mockApis();
    const { container } = await renderPromoPage();

    // Four stacked banners + the partner statement slide.
    expect(container.querySelectorAll('.ph-hero-slide')).toHaveLength(5);
    expect(container.querySelector('.ph-hero-stmt')?.textContent).toContain('ซื้อครบ รับของแถม');
    expect(container.querySelectorAll('section.ph-row')).toHaveLength(2);
    expect(
      container.querySelector('img[src="https://manager.cnypharmacy.com/uploads/editor/1237702276.png"]')
    ).not.toBeNull();
    // Every card image is lazy — the product grid alone is 133 cards.
    expect(
      [...container.querySelectorAll('img.ph-card-img')].every((img) => img.getAttribute('loading') === 'lazy')
    ).toBe(true);
    // The campaign end date drives the countdown block.
    expect(container.querySelector('.ph-deal-title')?.textContent).toBe('ดีลใกล้หมดเวลา');
    expect(container.querySelector('#deal-card-section-6-0')).not.toBeNull();
  });

  it('caps each row and links the rest to the section grid', async () => {
    mockApis();
    const { container } = await renderPromoPage();

    const rows = container.querySelectorAll('section.ph-row');
    expect(rows[0].querySelectorAll('.ph-rail .ph-card')).toHaveLength(10);
    expect(rows[1].querySelector('a.ph-more')?.getAttribute('href')).toBe('/promo?s=section-6');
    // The three partner strips the CMS puts alone on a row sit above the rail at full width.
    expect(rows[0].querySelectorAll('.ph-wide .ph-card-wide')).toHaveLength(3);
    expect(rows[0].querySelector('.ph-wide #card-section-5-0')).not.toBeNull();
  });

  it('shows one tab per section that has cards', async () => {
    mockApis();
    const { container } = await renderPromoPage();

    const tabs = [...container.querySelectorAll('nav.ph-tabs a')];
    expect(tabs).toHaveLength(2);
    expect(tabs[0].getAttribute('href')).toBe('#section-5');
    // Every partner card is a brand deal — the row is named for the group.
    expect(tabs[0].textContent).toBe('ดีลแบรนด์พาร์ทเนอร์');
    expect(tabs[1].textContent).toBe('สินค้าราคาพิเศษ');
    expect(container.querySelector('#section-5 .ph-row-sub')?.textContent).toBe('18 แบรนด์ · 28 รายการ');
  });

  it('uses the admin hero banners instead of the CMS banners when set', async () => {
    mockApis();
    findFirst.mockResolvedValue({
      ...ACCOUNT,
      settings: {
        ...ACCOUNT.settings,
        promoPage: {
          ...ACCOUNT.settings.promoPage,
          heroBanners: [{ imageUrl: 'https://cdn.example.com/a.png', href: 'https://www.cnypharmacy.com/promo' }],
        },
      },
    });
    const { container } = await renderPromoPage();

    expect(container.querySelectorAll('.ph-hero-slide')).toHaveLength(2);
    expect(
      container.querySelector('.ph-hero a[href="https://www.cnypharmacy.com/promo"] img[src="https://cdn.example.com/a.png"]')
    ).not.toBeNull();
    expect(container.querySelector('.ph-hero img[src*="1236432404"]')).toBeNull();
  });

  it('shows the real logo and a quiet outlined chat pill', async () => {
    mockApis();
    const { container } = await renderPromoPage();

    expect(container.querySelector('.ph-mark img[src="/promo/cny-logo.png"]')).not.toBeNull();
    expect(container.querySelector('#card-section-5-0 .ph-chat svg')).not.toBeNull();
  });

  it('orders the rows and swaps a section banner from the admin settings', async () => {
    mockApis();
    findFirst.mockResolvedValue({
      ...ACCOUNT,
      settings: {
        ...ACCOUNT.settings,
        promoPage: {
          ...ACCOUNT.settings.promoPage,
          sections: [{ id: 'section-6', imageUrl: 'https://cdn.example.com/b.png', href: 'https://www.cnypharmacy.com/b' }],
        },
      },
    });
    const { container } = await renderPromoPage();

    const rows = container.querySelectorAll('section.ph-row');
    expect([...rows].map((row) => row.id)).toEqual(['section-6', 'section-5']);
    expect(
      rows[0].querySelector('.ph-banner a[href="https://www.cnypharmacy.com/b"] img[src="https://cdn.example.com/b.png"]')
    ).not.toBeNull();
    // The untouched row keeps the banner the CMS gave it.
    expect(rows[1].querySelector('.ph-banner img[src*="1115835357"]')).not.toBeNull();
  });

  it('renders the draft a signed ?preview= token carries, and ignores a forged one', async () => {
    vi.stubEnv('NEXTAUTH_SECRET', 'test-secret');
    mockApis();
    const draft = {
      ...DEFAULT_PROMO_PAGE_SETTINGS,
      heroBanners: [{ imageUrl: 'https://cdn.example.com/draft.png', href: '' }],
    };
    const token = signPreview(draft)!;

    const { container, unmount } = await renderPromoPage({ preview: token });
    expect(container.querySelector('.ph-hero img[src="https://cdn.example.com/draft.png"]')).not.toBeNull();
    unmount();

    const forged = await renderPromoPage({ preview: `${token.split('.')[0]}.forged` });
    expect(forged.container.querySelector('.ph-hero img[src="https://cdn.example.com/draft.png"]')).toBeNull();
    expect(forged.container.querySelectorAll('.ph-hero-slide')).toHaveLength(5);
  });

  it('links each partner card to the OA chat with the configured message', async () => {
    mockApis();
    const { container } = await renderPromoPage();

    const card = container.querySelector('#card-section-5-0') as HTMLElement;
    expect(card.querySelector('.ph-card-brand')?.textContent).toBe('VISTRA');
    expect(card.querySelector('a[href="https://www.cnypharmacy.com/auth/partner?name=VISTRA"]')).not.toBeNull();
    expect(
      card.querySelector(
        `a[href="https://line.me/R/oaMessage/@cnyhealth/?${encodeURIComponent('สนใจโปร VISTRA')}"]`
      )
    ).not.toBeNull();
  });

  it('shows only the campaign name before the store price is cached', async () => {
    mockApis();
    const { container } = await renderPromoPage();

    const card = container.querySelector('#card-section-6-0') as HTMLElement;
    expect(card.querySelector('.ph-card-brand')?.textContent).toBe('ดีเดย์ ไนท์ สตอรี่ 30เม็ด');
    expect(card.querySelector('.ph-price')).toBeNull();
    // The artwork states the promo; the card does not repeat it.
    expect(card.textContent).not.toContain('ซื้อ 3');
  });

  it('prints the price line once the store price is cached', async () => {
    mockApis();
    await refreshPrices(['6117']);
    const { container } = await renderPromoPage();

    const card = container.querySelector('#card-section-6-0') as HTMLElement;
    expect(card.querySelector('.ph-card-brand')?.textContent).toBe('ดีเดย์ ไนท์ สตอรี่ 30เม็ด');
    expect(card.querySelector('.ph-price-big')?.textContent).toBe('฿399');
    expect(card.querySelector('.ph-price-off')?.textContent).toBe('-7%');
    expect(card.querySelector('.ph-price-unit')?.textContent).toBe('ต่อกล่อง[30เม็ด]');
  });

  it('renders cards without figures when the store API is down', async () => {
    mockApis({ store: false });
    const { container } = await renderPromoPage();

    expect(container.querySelectorAll('section.ph-row')).toHaveLength(2);
    expect(container.querySelector('.ph-deal')).toBeNull();
    expect(container.querySelector('#card-section-6-0 .ph-price')).toBeNull();
    expect(container.querySelector('#card-section-6-0 .ph-card-brand')?.textContent).toBe('รหัส 6117');
  });

  it('scrolls to and rings the card ?k= points at', async () => {
    mockApis();
    const { container } = await renderPromoPage({ k: 'สนใจ: SMOOTH E' });

    await waitFor(() => {
      expect(container.querySelector('#card-section-5-1')?.className).toContain('ring-4');
    });
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('extends the row so a ?k= card past the cap is on the page', async () => {
    mockApis();
    const { container } = await renderPromoPage({ k: 'MACROPHAR' });

    const card = container.querySelector('#card-section-5-25');
    expect(card).not.toBeNull();
    await waitFor(() => expect(card?.className).toContain('ring-4'));
  });

  it('rings nothing when ?k= matches no partner', async () => {
    mockApis();
    const { container } = await renderPromoPage({ k: 'NOT-A-PARTNER' });

    expect(container.querySelector('.ring-4')).toBeNull();
    expect(Element.prototype.scrollIntoView).not.toHaveBeenCalled();
  });

  it('shows a Thai empty state instead of throwing when the CMS is down', async () => {
    vi.spyOn(global, 'fetch').mockRejectedValue(new Error('ECONNREFUSED'));
    await renderPromoPage();

    expect(screen.getByText('ยังไม่มีโปรโมชันในขณะนี้')).toBeTruthy();
  });

  it('still renders when there is no default LINE account', async () => {
    mockApis();
    findFirst.mockResolvedValue(null);
    const { container } = await renderPromoPage();

    expect(container.querySelectorAll('section.ph-row')).toHaveLength(2);
    // No basicId means no chat deep links at all.
    expect(container.querySelector('a[href^="https://line.me"]')).toBeNull();
  });
});

describe('/promo section grid', () => {
  it('lays every card of ?s= out in the configured columns, sorted by discount', async () => {
    mockApis();
    const { container } = await renderPromoPage({ s: 'section-6' });

    expect(container.querySelector('.ph-hero')).toBeNull();
    expect(container.querySelector('.ph-cat-title')?.textContent).toBe('สินค้าราคาพิเศษ');
    const grid = container.querySelector('.ph-grid') as HTMLElement | null;
    expect(grid?.style.getPropertyValue('--promo-cols')).toBe('2');
    expect(grid?.style.getPropertyValue('--promo-cols-lg')).toBe('4');
    // Must not carry Tailwind's `grid` class: a global `.grid` rule overrides it.
    expect(grid?.classList.contains('grid')).toBe(false);
    expect(grid?.querySelectorAll('.ph-card')).toHaveLength(135);
    expect(container.querySelector('nav.ph-sort a.on')?.textContent).toBe('ส่วนลดมากสุด');
    // The one card with a campaign discount comes first.
    expect(grid?.querySelector('.ph-card')?.id).toBe('card-section-6-0');
  });

  it('sorts by brand through the ?sort= links', async () => {
    mockApis();
    const { container } = await renderPromoPage({ s: 'section-5', sort: 'brand' });

    expect(container.querySelector('nav.ph-sort a.on')?.textContent).toBe('ตามแบรนด์');
    expect(container.querySelector('nav.ph-sort a')?.getAttribute('href')).toBe(
      '/promo?s=section-5&sort=off'
    );
    const brands = [...container.querySelectorAll('.ph-card-brand')].map((el) => el.textContent ?? '');
    expect(brands).toEqual([...brands].sort((a, b) => a.localeCompare(b, 'th')));
  });

  it('searches every card for ?q= and falls back to an empty state', async () => {
    mockApis();
    const hit = await renderPromoPage({ q: 'vistra' });
    expect(hit.container.querySelector('.ph-cat-title')?.textContent).toBe('ผลการค้นหา "vistra"');
    expect(hit.container.querySelectorAll('.ph-card')).toHaveLength(2);
    hit.unmount();

    const miss = await renderPromoPage({ q: 'zzz-nothing' });
    expect(miss.container.querySelector('.ph-empty')?.textContent).toBe('ไม่พบโปรที่ตรงกับคำค้น');
  });

  it('falls back to the home page for an unknown section id', async () => {
    mockApis();
    const { container } = await renderPromoPage({ s: 'section-99' });

    expect(container.querySelector('.ph-hero')).not.toBeNull();
  });
});
