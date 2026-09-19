import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import {
  parsePromoHtml,
  parseHomePayload,
  findCardIndexForKeyword,
  resolveAssetUrl,
} from '@/lib/cny-news-promo';

/**
 * Fixtures are the real public marketing content: the `content` HTML of article 12
 * ("รวมโปรโมชั่น") and a trimmed home_system_page envelope. Counts below are what
 * that article actually holds, so a parser regression shows up as a count change.
 */
const FIXTURE_DIR = path.join(__dirname, 'fixtures');
const FIXTURE = readFileSync(path.join(FIXTURE_DIR, 'news-12.html'), 'utf8');
const HOME_SAMPLE = JSON.parse(readFileSync(path.join(FIXTURE_DIR, 'home-sample.json'), 'utf8'));

const ASSET_BASE = 'https://manager.cnypharmacy.com';
const SITE = 'https://www.cnypharmacy.com';

function countKinds(cards: { kind: string }[]): Record<string, number> {
  return cards.reduce<Record<string, number>>((acc, card) => {
    acc[card.kind] = (acc[card.kind] || 0) + 1;
    return acc;
  }, {});
}

describe('parsePromoHtml (real article 12)', () => {
  const { sections, partners } = parsePromoHtml(FIXTURE);

  it('starts a new section at every full-width banner', () => {
    expect(sections).toHaveLength(6);
    expect(sections.map((section) => section.id)).toEqual([
      'section-1',
      'section-2',
      'section-3',
      'section-4',
      'section-5',
      'section-6',
    ]);
    // The article opens with four stacked header images that carry no cards.
    expect(sections.slice(0, 4).every((section) => section.cards.length === 0)).toBe(true);
    expect(sections[0].headerImageUrl).toBe(`${ASSET_BASE}/uploads/editor/1236432404.png`);
    expect(sections[5].headerImageUrl).toBe(`${ASSET_BASE}/uploads/editor/797025819.png`);
  });

  it('classifies the partner block and the product grid', () => {
    expect(countKinds(sections[4].cards)).toEqual({ partner: 23, product: 1, image: 4 });
    expect(countKinds(sections[5].cards)).toEqual({ product: 133, image: 2 });
  });

  it('reads a partner cell whole', () => {
    expect(sections[4].cards[0]).toEqual({
      kind: 'partner',
      imageUrl: `${ASSET_BASE}/uploads/editor/1237702276.png`,
      href: `${SITE}/auth/partner?name=VISTRA`,
      partner: 'VISTRA',
      wide: true,
    });
  });

  it('URL-decodes partner names and keeps them unique in first-seen order', () => {
    expect(partners).toHaveLength(18);
    expect(partners.slice(0, 6)).toEqual([
      'VISTRA',
      'SMOOTH E',
      'BKD-01',
      'BIOPHARM',
      'NEXCARE COLD HOT',
      'ZPL-JACKCHIA TIGERPLASTSUPPORT',
    ]);
    expect(partners).toContain('SOS PLUS');
    expect(partners).toContain('MACROPHAR');
    // FUTURO and TAISHO-TEMPRA each appear on two cards but only once here.
    expect(new Set(partners).size).toBe(partners.length);
  });

  it('recognises both product link shapes', () => {
    const hrefs = sections[5].cards.map((card) => card.href);
    expect(hrefs).toContain(`${SITE}/product/6117`);
    expect(
      sections[4].cards.some(
        (card) => card.kind === 'product' && (card.href || '').includes('/auth/product?name=')
      )
    ).toBe(true);
  });

  it('resolves every image to an absolute https url on the asset host', () => {
    const urls = sections.flatMap((section) => [
      ...(section.headerImageUrl ? [section.headerImageUrl] : []),
      ...section.cards.map((card) => card.imageUrl),
    ]);
    expect(urls.length).toBeGreaterThan(150);
    expect(urls.every((url) => url.startsWith(`${ASSET_BASE}/uploads/`))).toBe(true);
  });
});

describe('resolveAssetUrl', () => {
  it('resolves the relative shapes the editor emits', () => {
    expect(resolveAssetUrl('../../uploads/editor/1236432404.png')).toBe(
      `${ASSET_BASE}/uploads/editor/1236432404.png`
    );
    expect(resolveAssetUrl('uploads/brand/amsel.png')).toBe(`${ASSET_BASE}/uploads/brand/amsel.png`);
    expect(resolveAssetUrl('/uploads/editor/1.png')).toBe(`${ASSET_BASE}/uploads/editor/1.png`);
    expect(resolveAssetUrl('https://cdn.example.com/a.png')).toBe('https://cdn.example.com/a.png');
  });

  it('drops anything that is not https', () => {
    expect(resolveAssetUrl('http://manager.cnypharmacy.com/uploads/editor/1.png')).toBeNull();
    expect(resolveAssetUrl('//manager.cnypharmacy.com/uploads/editor/1.png')).toBeNull();
    expect(resolveAssetUrl('data:image/png;base64,AAAA')).toBeNull();
    expect(resolveAssetUrl('   ')).toBeNull();
  });
});

describe('parsePromoHtml (edge cases)', () => {
  it('drops a cell whose image is http, keeping the rest of the row', () => {
    const { sections } = parsePromoHtml(
      '<table><tr><td><img src="/uploads/banner.png" /></td></tr><tr>' +
        `<td><a href="${SITE}/product/1"><img src="/uploads/a.png" /></a></td>` +
        `<td><a href="${SITE}/product/2"><img src="http://manager.cnypharmacy.com/uploads/b.png" /></a></td>` +
        '</tr></table>'
    );
    expect(sections[0].cards).toEqual([
      { kind: 'product', imageUrl: `${ASSET_BASE}/uploads/a.png`, href: `${SITE}/product/1` },
    ]);
  });

  it('drops any href that is not absolute https (it is rendered into a public <a>)', () => {
    const { sections } = parsePromoHtml(
      '<table><tr>' +
        '<td><a href="javascript:alert(1)"><img src="/uploads/a.png" /></a></td>' +
        '<td><a href="/product/5"><img src="/uploads/b.png" /></a></td>' +
        `<td><a href="${SITE}/product/6"><img src="/uploads/c.png" /></a></td>` +
        '</tr></table>'
    );
    expect(sections[0].cards).toEqual([
      { kind: 'image', imageUrl: `${ASSET_BASE}/uploads/a.png`, href: null },
      { kind: 'image', imageUrl: `${ASSET_BASE}/uploads/b.png`, href: null },
      { kind: 'product', imageUrl: `${ASSET_BASE}/uploads/c.png`, href: `${SITE}/product/6` },
    ]);
  });

  it('puts cards before the first banner into a headerless section', () => {
    const { sections } = parsePromoHtml(
      '<table><tr>' +
        `<td><a href="${SITE}/product/1"><img src="/uploads/a.png" /></a></td>` +
        `<td><a href="${SITE}/product/2"><img src="/uploads/b.png" /></a></td>` +
        '</tr><tr><td><img src="/uploads/banner.png" /></td></tr><tr>' +
        `<td><a href="${SITE}/product/3"><img src="/uploads/c.png" /></a></td>` +
        '</tr></table>'
    );
    expect(sections).toHaveLength(2);
    expect(sections[0].headerImageUrl).toBeNull();
    expect(sections[0].cards).toHaveLength(2);
    expect(sections[1].headerImageUrl).toBe(`${ASSET_BASE}/uploads/banner.png`);
    expect(sections[1].cards).toHaveLength(1);
  });

  it('returns empty structures for garbage input', () => {
    for (const garbage of ['', '<<<>>>', 'not html at all', '<table><tr><td>&nbsp;</td></tr>']) {
      expect(parsePromoHtml(garbage)).toEqual({ sections: [], partners: [] });
    }
    // The CMS may hand us anything at all.
    expect(parsePromoHtml(null as unknown as string)).toEqual({ sections: [], partners: [] });
    expect(parsePromoHtml({} as unknown as string)).toEqual({ sections: [], partners: [] });
  });
});

describe('parseHomePayload', () => {
  const payload = {
    ...HOME_SAMPLE,
    news: HOME_SAMPLE.news.map((item: { id: number }) =>
      item.id === 12 ? { ...item, content: FIXTURE } : item
    ),
  };

  it('picks the configured article and parses it', () => {
    const promo = parseHomePayload(payload, 12);
    expect(promo?.title).toBe('รวมโปรโมชั่น');
    expect(promo?.sections).toHaveLength(6);
    expect(promo?.partners).toContain('VISTRA');
  });

  it('ignores the unknown keys the endpoint also sends', () => {
    expect(parseHomePayload({ ...payload, product_type: [{ id: 1 }], slide_mid: [] }, 12)).not.toBeNull();
  });

  it('returns null for a missing article or an unusable payload', () => {
    expect(parseHomePayload(payload, 999)).toBeNull();
    expect(parseHomePayload({ news: 'nope' }, 12)).toBeNull();
    expect(parseHomePayload(null, 12)).toBeNull();
    expect(parseHomePayload('<html>error page</html>', 12)).toBeNull();
  });
});

describe('findCardIndexForKeyword', () => {
  const { sections } = parsePromoHtml(FIXTURE);

  it('matches a partner name case-insensitively', () => {
    expect(findCardIndexForKeyword(sections, 'vistra')).toEqual({
      sectionId: 'section-5',
      cardIndex: 0,
    });
    expect(findCardIndexForKeyword(sections, 'SMOOTH E')).toEqual({
      sectionId: 'section-5',
      cardIndex: 1,
    });
  });

  it('matches on a substring and ignores the สนใจ: prefix', () => {
    expect(findCardIndexForKeyword(sections, 'สนใจ: SOS PLUS')?.sectionId).toBe('section-5');
    expect(findCardIndexForKeyword(sections, 'tigerplast')).toEqual(
      findCardIndexForKeyword(sections, 'ZPL-JACKCHIA TIGERPLASTSUPPORT')
    );
  });

  it('returns null with no keyword or no match', () => {
    expect(findCardIndexForKeyword(sections, '')).toBeNull();
    expect(findCardIndexForKeyword(sections, '   ')).toBeNull();
    expect(findCardIndexForKeyword(sections, 'สนใจ:')).toBeNull();
    expect(findCardIndexForKeyword(sections, 'NOT-A-PARTNER')).toBeNull();
    expect(findCardIndexForKeyword([], 'VISTRA')).toBeNull();
  });
});
