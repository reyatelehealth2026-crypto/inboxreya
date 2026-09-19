import { z } from 'zod';

/**
 * The marketing team maintains the promo page as a CMS article on the main site:
 * an HTML table of designer-made images, each cell optionally linked to a partner
 * or a product. This module fetches that article and turns the editor HTML into
 * sections of cards the /promo page can render.
 *
 * The HTML is untrusted input, so nothing here throws: bad markup yields empty
 * structures rather than a 500 on a public page.
 */

export const CNY_HOME_API_URL =
  process.env.CNY_HOME_API_URL || 'https://www.cnypharmacy.com/api/home_system_page';

/**
 * Relative image paths in the editor HTML are resolved against this origin.
 * The editor uploads live on the manager host — the www host answers /uploads/...
 * with HTML, which would render every card as a broken image.
 */
export const CNY_NEWS_ASSET_BASE =
  process.env.CNY_NEWS_ASSET_BASE || 'https://manager.cnypharmacy.com';

export type PromoCardKind = 'partner' | 'product' | 'image';

export interface PromoCard {
  kind: PromoCardKind;
  imageUrl: string;
  href: string | null;
  /** Partner name from /auth/partner?name=, URL-decoded. */
  partner?: string;
  /** The editor put this card alone on its row: a full-width strip, not a grid tile. */
  wide?: boolean;
}

export interface PromoSection {
  id: string;
  /** The full-width banner image that opened this section, if it had one. */
  headerImageUrl: string | null;
  cards: PromoCard[];
}

export interface CnyNewsPromo {
  title: string;
  sections: PromoSection[];
  /** Unique partner names in first-seen order. */
  partners: string[];
}

/** Only the fields this page uses; the endpoint sends far more and it may change. */
const homePayloadSchema = z.object({
  news: z
    .array(
      z.object({
        id: z.coerce.number().int(),
        title: z.string().catch(''),
        content: z.string().catch(''),
      })
    )
    .catch([]),
});

/** Minimal entity decode — the editor only ever emits these inside attributes. */
function decodeEntities(value: string): string {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, String.fromCharCode(39))
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Resolve an editor image path to an absolute https url, or null.
 *
 * The editor writes '../../uploads/editor/1.png' (relative to the article page),
 * sometimes '/uploads/...'. http images are dropped: the LINE in-app browser
 * blocks them on an https page, so a kept http image is a broken card.
 */
export function resolveAssetUrl(src: string): string | null {
  const trimmed = decodeEntities(src).trim();
  if (!trimmed) return null;

  const base = CNY_NEWS_ASSET_BASE.replace(/\/$/, '');

  if (/^https:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) || trimmed.startsWith('//')) return null;

  const path = trimmed.replace(/^(?:\.\.\/)+/, '').replace(/^\.\//, '').replace(/^\//, '');
  if (!path) return null;
  return `${base}/${path}`;
}

/** Partner name out of /auth/partner?name=SOS%20PLUS */
function partnerFromHref(href: string): string | null {
  const match = /[?&]name=([^&]*)/.exec(href);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1].replace(/\+/g, ' ')).trim() || null;
  } catch {
    return match[1].trim() || null;
  }
}

interface RawCell {
  imageUrl: string | null;
  href: string | null;
}

function parseCell(html: string): RawCell {
  const img = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/i.exec(html);
  const anchor = /<a\b[^>]*\bhref\s*=\s*["']([^"']+)["'][^>]*>/i.exec(html);
  // The href lands in a public <a href> verbatim, so only absolute https survives:
  // javascript:/data: would be XSS, and a relative path would resolve to our host.
  const href = anchor ? decodeEntities(anchor[1]).trim() : '';
  return {
    imageUrl: img ? resolveAssetUrl(img[1]) : null,
    href: /^https:\/\//i.test(href) ? href : null,
  };
}

function classify(cell: RawCell, isLoneCell: boolean): PromoCard | 'banner' | null {
  const { href, imageUrl } = cell;
  if (!imageUrl) return null;

  if (!href) return isLoneCell ? 'banner' : { kind: 'image', imageUrl, href: null };

  const card = classifyLinked(href, imageUrl);
  return isLoneCell ? { ...card, wide: true } : card;
}

function classifyLinked(href: string, imageUrl: string): PromoCard {
  if (/\/auth\/partner\b/i.test(href)) {
    const partner = partnerFromHref(href);
    if (partner) return { kind: 'partner', imageUrl, href, partner };
  }
  if (/\/auth\/product\b/i.test(href) || /\/product\/\d+/i.test(href)) {
    return { kind: 'product', imageUrl, href };
  }
  // Some other link on an image: still tappable, just not a known kind.
  return { kind: 'image', imageUrl, href };
}

/**
 * Parse editor HTML into sections.
 *
 * Every full-width banner row starts a new section and becomes its header image;
 * the cards that follow belong to it. Cards before the first banner go into a
 * leading section with no header.
 */
export function parsePromoHtml(html: string): Pick<CnyNewsPromo, 'sections' | 'partners'> {
  if (typeof html !== 'string' || !html) return { sections: [], partners: [] };

  const sections: PromoSection[] = [];
  const partners: string[] = [];
  let current: PromoSection | null = null;

  const openSection = (headerImageUrl: string | null): PromoSection => {
    const section: PromoSection = {
      id: `section-${sections.length + 1}`,
      headerImageUrl,
      cards: [],
    };
    sections.push(section);
    return section;
  };

  const rowPattern = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi;
  let row: RegExpExecArray | null;
  while ((row = rowPattern.exec(html)) !== null) {
    const cellPattern = /<(t[dh])\b[^>]*>([\s\S]*?)<\/\1\s*>/gi;
    const cells: RawCell[] = [];
    let cell: RegExpExecArray | null;
    // Counted over every cell, empties included: a tile next to three blank cells
    // is still a tile, only a row with a single cell is a full-width strip.
    let totalCells = 0;
    while ((cell = cellPattern.exec(row[1])) !== null) {
      totalCells += 1;
      const parsed = parseCell(cell[2]);
      if (parsed.imageUrl || parsed.href) cells.push(parsed);
    }

    const isLoneCell = totalCells === 1;
    for (const raw of cells) {
      const result = classify(raw, isLoneCell);
      if (!result) continue;
      if (result === 'banner') {
        current = openSection(raw.imageUrl);
        continue;
      }
      if (!current) current = openSection(null);
      current.cards.push(result);
      if (result.partner && !partners.includes(result.partner)) partners.push(result.partner);
    }
  }

  return {
    sections: sections.filter((section) => section.headerImageUrl || section.cards.length > 0),
    partners,
  };
}

/**
 * Locate the card a broadcast keyword points at, so the page can scroll to it.
 *
 * The imagemap sends the keyword as the chat text 'สนใจ: VISTRA'; that prefix is
 * dropped before matching.
 *
 * // ponytail: case-insensitive substring on the partner name — good enough until
 * // the CMS carries an explicit id per cell
 */
export function findCardIndexForKeyword(
  sections: PromoSection[],
  keyword: string
): { sectionId: string; cardIndex: number } | null {
  const needle = (keyword || '')
    .replace(/^\s*สนใจ\s*:?\s*/u, '')
    .trim()
    .toLowerCase();
  if (!needle) return null;

  for (const section of sections) {
    for (let i = 0; i < section.cards.length; i += 1) {
      const partner = section.cards[i].partner;
      if (partner && partner.toLowerCase().includes(needle)) {
        return { sectionId: section.id, cardIndex: i };
      }
    }
  }
  return null;
}

// ponytail: in-process cache; move to redis if multiple instances
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { at: number; promo: CnyNewsPromo }>();

/** Drop the cached article so the next page view refetches (admin "ดึงข้อมูลใหม่"). */
export function clearCnyNewsPromoCache(): void {
  cache.clear();
}

/**
 * Pick the configured article out of the home payload and parse its HTML.
 * Returns null when the payload is not the shape we expect or has no such article.
 */
export function parseHomePayload(payload: unknown, newsId: number): CnyNewsPromo | null {
  const parsed = homePayloadSchema.safeParse(payload);
  if (!parsed.success) {
    console.error('[cny-news-promo] unexpected payload', parsed.error.issues);
    return null;
  }

  const article = parsed.data.news.find((item) => item.id === newsId);
  if (!article) {
    console.error('[cny-news-promo] article not found', newsId);
    return null;
  }

  return { title: article.title, ...parsePromoHtml(article.content) };
}

/**
 * Fetch + parse the CMS promo article. Returns null when the API is unreachable
 * or sends something unparseable — the public page renders an empty state rather
 * than an error.
 */
export async function fetchCnyNewsPromo(newsId: number): Promise<CnyNewsPromo | null> {
  const cached = cache.get(newsId);
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) return cached.promo;

  try {
    const response = await fetch(CNY_HOME_API_URL, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(15_000),
    });

    if (!response.ok) {
      console.error('[cny-news-promo] upstream error', response.status);
      return null;
    }

    const promo = parseHomePayload(await response.json().catch(() => null), newsId);
    if (promo) cache.set(newsId, { at: Date.now(), promo });
    return promo;
  } catch (error) {
    console.error('[cny-news-promo] fetch failed', error);
    return null;
  }
}
