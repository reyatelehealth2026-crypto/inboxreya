import { formatThaiDate } from '@/lib/cny-promo-offers';
import { dealItems, soonestEnd, type PromoItem, type PromoRow } from '@/lib/promo-data';
import type { PromoPageSettings } from '@/lib/promo-page-settings';

/**
 * The /promo page as one LINE broadcast: a hero banner, a "deals ending soon"
 * carousel, then one carousel per card row — each carousel a swipeable rail of the
 * same cards the page shows. Pure: image ratios are looked up by the caller.
 */

type Json = Record<string, unknown>;

export interface FlexMessage {
  type: 'flex';
  altText: string;
  contents: Json;
}

export interface FlexSelection {
  deals: PromoItem[];
  rows: { row: PromoRow; items: PromoItem[] }[];
}

/** LINE: 5 messages per send, 12 bubbles per carousel (title + cards + "see all"). */
const MAX_MESSAGES = 5;
export const FLEX_CARDS = 10;
const LABEL_MAX = 20;
const DAY_MS = 86_400_000;

const INK = '#201E1D';
const ACCENT = '#EC3013';
const ACCENT_700 = '#AE1800';
const N400 = '#BAB6B6';
const N700 = '#605D5D';
const BG = '#F5F4F3';

export function selectFlexItems(rows: PromoRow[], now: number): FlexSelection {
  const cardRows = rows.filter((row) => row.items.length > 0);
  return {
    deals: dealItems(cardRows.flatMap((row) => row.items), now, FLEX_CARDS),
    rows: cardRows.map((row) => ({ row, items: row.items.slice(0, FLEX_CARDS) })),
  };
}

/** The admin's first hero banner, else the first banner-only CMS section — as on the page. */
export function heroImageUrl(settings: PromoPageSettings, rows: PromoRow[]): string | null {
  return (
    settings.heroBanners[0]?.imageUrl ||
    rows.find((row) => row.items.length === 0 && row.headerImageUrl)?.headerImageUrl ||
    null
  );
}

/**
 * Images whose ratio sets a layout: the hero, each carousel's first regular card
 * (the rest of its regular cards share that ratio so they line up), and every wide
 * strip card, which keeps its own.
 */
export function flexImageUrls(selection: FlexSelection, hero: string | null): string[] {
  const carousels = [selection.deals, ...selection.rows.map((r) => r.items)];
  const urls = carousels.flatMap((items) => [
    items.find((item) => !item.card.wide)?.card.imageUrl,
    ...items.filter((item) => item.card.wide).map((item) => item.card.imageUrl),
  ]);
  return Array.from(new Set([hero, ...urls].filter((u): u is string => !!u)));
}

export function buildPromoFlexMessages(input: {
  selection: FlexSelection;
  heroImageUrl: string | null;
  origin: string;
  now: number;
  /** "w:h" per image url (see flexImageUrls). */
  ratios: Map<string, string>;
}): FlexMessage[] {
  const { selection, heroImageUrl: hero, now, ratios } = input;
  const origin = input.origin.replace(/\/+$/, '');
  const messages: FlexMessage[] = [];

  if (hero) {
    messages.push({
      type: 'flex',
      altText: 'รวมโปรโมชัน CNY',
      contents: {
        type: 'bubble',
        size: 'giga',
        hero: {
          type: 'image',
          url: hero,
          size: 'full',
          aspectRatio: ratios.get(hero) ?? '2:1',
          aspectMode: ratios.has(hero) ? 'cover' : 'fit',
          action: uri('ดูโปรทั้งหมด', `${origin}/promo`),
        },
      },
    });
  }

  const { deals } = selection;
  const dealEnd = deals[0]?.offer.endsAt ?? null;
  if (dealEnd) {
    const daysLeft = Math.ceil((dealEnd.getTime() - now) / DAY_MS);
    messages.push(
      carousel({
        altText: `ดีลใกล้หมดเวลา · ${deals.length} รายการ · จบ ${formatThaiDate(dealEnd)}`,
        size: 'micro',
        title: 'ดีลใกล้หมดเวลา',
        sub: `หมดแล้วหมดเลย · จบ ${formatThaiDate(dealEnd)}`,
        chip: daysLeft <= 1 ? 'วันสุดท้าย' : `เหลือ ${daysLeft} วัน`,
        items: deals,
        total: deals.length,
        seeAll: `${origin}/promo#deals`,
        ratios,
      })
    );
  }

  for (const { row, items } of selection.rows) {
    if (messages.length >= MAX_MESSAGES) break;
    const ends = soonestEnd(row.items, now);
    messages.push(
      carousel({
        altText: `${row.title} · ${row.items.length} รายการ`,
        // Partner artwork is a wide strip; product artwork reads fine small.
        size: items.some((item) => item.card.kind === 'partner') ? 'kilo' : 'micro',
        title: row.title,
        sub: [
          row.brands > 0 ? `${row.brands} แบรนด์` : '',
          `${row.items.length} รายการ`,
          ends ? `ถึง ${formatThaiDate(ends)}` : '',
        ]
          .filter(Boolean)
          .join(' · '),
        chip: null,
        items,
        total: row.items.length,
        seeAll: `${origin}/promo?s=${encodeURIComponent(row.id)}`,
        ratios,
      })
    );
  }

  return messages;
}

function carousel(input: {
  altText: string;
  size: 'micro' | 'kilo';
  title: string;
  sub: string;
  chip: string | null;
  items: PromoItem[];
  total: number;
  seeAll: string;
  ratios: Map<string, string>;
}): FlexMessage {
  const regular = input.items.find((item) => !item.card.wide);
  const shared = input.ratios.get(regular?.card.imageUrl ?? '') ?? '1:1';
  const ratioOf = (item: PromoItem) => (item.card.wide && input.ratios.get(item.card.imageUrl)) || shared;
  return {
    type: 'flex',
    altText: input.altText.slice(0, 400),
    contents: {
      type: 'carousel',
      contents: [
        titleBubble(input),
        ...input.items.map((item) => cardBubble(item, input.size, ratioOf(item))),
        seeAllBubble(input.size, input.total, input.seeAll),
      ],
    },
  };
}

function titleBubble(input: { size: string; title: string; sub: string; chip: string | null; seeAll: string }): Json {
  return {
    type: 'bubble',
    size: input.size,
    styles: { body: { backgroundColor: INK }, footer: { backgroundColor: INK } },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'sm',
      justifyContent: 'center',
      contents: [
        { type: 'text', text: input.title, weight: 'bold', size: 'lg', color: '#FFFFFF', wrap: true },
        { type: 'text', text: input.sub, size: 'xxs', color: N400, wrap: true },
        ...(input.chip
          ? [
              {
                type: 'box',
                layout: 'horizontal',
                margin: 'md',
                contents: [
                  {
                    type: 'box',
                    layout: 'vertical',
                    flex: 0,
                    backgroundColor: ACCENT,
                    cornerRadius: '4px',
                    paddingAll: '4px',
                    paddingStart: '8px',
                    paddingEnd: '8px',
                    contents: [{ type: 'text', text: input.chip, size: 'sm', weight: 'bold', color: '#FFFFFF' }],
                  },
                ],
              },
            ]
          : []),
      ],
    },
    footer: { type: 'box', layout: 'vertical', contents: [pill('ดูทั้งหมด', input.seeAll, true)] },
  };
}

function cardBubble(item: PromoItem, size: string, ratio: string): Json {
  const { card, offer, chatUrl } = item;
  const action = chatUrl
    ? pill('สั่งผ่านแชท', chatUrl)
    : card.href
      ? pill('ดูโปร', card.href)
      : null;
  return {
    type: 'bubble',
    size,
    hero: {
      type: 'image',
      url: card.imageUrl,
      size: 'full',
      aspectRatio: ratio,
      aspectMode: 'fit',
      backgroundColor: '#FFFFFF',
      ...(card.href ? { action: uri('ดูโปร', card.href) } : {}),
    },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'xs',
      paddingAll: '10px',
      contents: [
        {
          type: 'text',
          text: offer.brand,
          size: size === 'micro' ? 'xs' : 'sm',
          weight: 'bold',
          color: INK,
          wrap: true,
          maxLines: 2,
        },
        ...(offer.price ? [priceLine(offer.price, offer.unitLine, offer.off)] : []),
      ],
    },
    ...(action
      ? { footer: { type: 'box', layout: 'vertical', paddingAll: '10px', paddingTop: '0px', contents: [action] } }
      : {}),
  };
}

function priceLine(price: string, unit: string | null, off: string | null): Json {
  return {
    type: 'box',
    layout: 'baseline',
    spacing: 'xs',
    contents: [
      { type: 'text', text: price, size: 'md', weight: 'bold', color: ACCENT_700, flex: 0 },
      ...(unit ? [{ type: 'text', text: unit, size: 'xxs', color: N700, flex: 0 }] : []),
      ...(off ? [{ type: 'text', text: off, size: 'xxs', weight: 'bold', color: ACCENT, align: 'end' }] : []),
    ],
  };
}

function seeAllBubble(size: string, total: number, link: string): Json {
  return {
    type: 'bubble',
    size,
    styles: { body: { backgroundColor: BG } },
    body: {
      type: 'box',
      layout: 'vertical',
      spacing: 'md',
      justifyContent: 'center',
      action: uri('ดูทั้งหมด', link),
      contents: [
        { type: 'text', text: 'ดูทั้งหมด', weight: 'bold', size: 'md', color: INK, align: 'center' },
        { type: 'text', text: `${total} รายการ`, size: 'xs', color: N700, align: 'center' },
        pill('เปิดหน้าโปร', link),
      ],
    },
  };
}

/** Outlined pill, as on the page: quiet border, ink text. */
function pill(label: string, link: string, onDark = false): Json {
  return {
    type: 'box',
    layout: 'vertical',
    cornerRadius: '20px',
    borderWidth: '1px',
    borderColor: onDark ? '#FFFFFF' : N400,
    paddingTop: '6px',
    paddingBottom: '6px',
    action: uri(label, link),
    contents: [{ type: 'text', text: label, size: 'xs', weight: 'bold', align: 'center', color: onDark ? '#FFFFFF' : INK }],
  };
}

function uri(label: string, link: string): Json {
  return { type: 'uri', label: label.slice(0, LABEL_MAX), uri: link };
}

/* ---------- image ratios (server only: fetches the artwork) ---------- */

// ponytail: in-process cache, fine for one instance; artwork URLs never change content
const ratioCache = new Map<string, string>();

/** Width and height from a PNG, GIF or JPEG header; null for anything else. */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  const b = Buffer.from(bytes);
  if (b.length >= 24 && b.readUInt32BE(0) === 0x89504e47) return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  if (b.length >= 10 && b.toString('ascii', 0, 3) === 'GIF') return { width: b.readUInt16LE(6), height: b.readUInt16LE(8) };
  if (b[0] === 0xff && b[1] === 0xd8) {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i += 1;
        continue;
      }
      const marker = b[i + 1];
      const isFrame = marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { height: b.readUInt16BE(i + 5), width: b.readUInt16BE(i + 7) };
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}

/** LINE caps an image's height at three times its width. */
export function toAspectRatio(size: { width: number; height: number }): string | null {
  if (size.width < 1 || size.height < 1) return null;
  return `${size.width}:${Math.min(size.height, size.width * 3)}`;
}

export async function fetchImageRatios(urls: string[]): Promise<Map<string, string>> {
  await Promise.all(
    urls
      .filter((url) => !ratioCache.has(url))
      .map(async (url) => {
        try {
          const response = await fetch(url, { signal: AbortSignal.timeout(8000) });
          if (!response.ok) return;
          const size = imageSize(new Uint8Array(await response.arrayBuffer()));
          const ratio = size ? toAspectRatio(size) : null;
          if (ratio) ratioCache.set(url, ratio);
        } catch (error) {
          console.error('[promo-flex] image size lookup failed', url, error);
        }
      })
  );
  return new Map(urls.flatMap((url) => (ratioCache.has(url) ? [[url, ratioCache.get(url)!] as const] : [])));
}
