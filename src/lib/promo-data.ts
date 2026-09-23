import { fetchCnyNewsPromo, type PromoCard, type PromoSection } from '@/lib/cny-news-promo';
import {
  buildOffer,
  fetchCnyCampaigns,
  getCachedPrices,
  skuFromCard,
  type PromoOffer,
} from '@/lib/cny-promo-offers';
import type { PromoPageSettings } from '@/lib/promo-page-settings';
import { orderByIds, partnerNames, rowTitle } from '@/lib/promo-rows';

/**
 * The /promo content as rows of priced cards, shared by the public page and the
 * Flex builder so a broadcast shows exactly what the page shows.
 */

export interface PromoItem {
  id: string;
  card: PromoCard;
  offer: PromoOffer;
  chatUrl: string | null;
}

export interface PromoRow {
  id: string;
  title: string;
  /** Distinct partner brands in the row — every partner card is a brand deal. */
  brands: number;
  headerImageUrl: string | null;
  headerHref: string | null;
  items: PromoItem[];
}

export interface PromoData {
  sections: PromoSection[];
  /** Every CMS section in admin order, banner-only ones included (items: []). */
  rows: PromoRow[];
}

/**
 * Null when the CMS article is missing or empty. Prices are whatever the cache holds
 * now; stale ones refresh in the background unless `refreshStale` is false.
 */
export async function loadPromoData(
  settings: PromoPageSettings,
  basicId: string | null,
  refreshStale = true
): Promise<PromoData | null> {
  const promo = await fetchCnyNewsPromo(settings.newsId);
  if (!promo || promo.sections.length === 0) return null;

  const campaigns = await fetchCnyCampaigns();
  const prices = getCachedPrices(promoSkus(promo.sections), refreshStale);

  // Admin overrides per section: listed ones come first in that order, and their banner wins.
  const overrides = new Map(settings.sections.map((section) => [section.id, section]));
  const rows: PromoRow[] = orderByIds(
    promo.sections.map((section, index) => {
      const custom = overrides.get(section.id);
      return {
        id: section.id,
        title: rowTitle(section, index),
        brands: partnerNames(section).size,
        headerImageUrl: custom?.imageUrl || section.headerImageUrl,
        headerHref: custom?.href || null,
        items: section.cards.map((card, cardIndex) => ({
          id: cardDomId(section.id, cardIndex),
          card,
          offer: buildOffer(card, campaigns, prices),
          chatUrl:
            settings.showChatButton && card.kind === 'partner'
              ? chatUrl(card, basicId, settings.chatText)
              : null,
        })),
      };
    }),
    settings.sections.map((section) => section.id)
  );
  return { sections: promo.sections, rows };
}

export function promoSkus(sections: PromoSection[]): string[] {
  return sections.flatMap((section) =>
    section.cards.flatMap((card) => {
      const sku = skuFromCard(card);
      return sku ? [sku] : [];
    })
  );
}

/** Items whose campaign is still running, soonest end first. */
export function dealItems(items: PromoItem[], now: number, limit: number): PromoItem[] {
  return items
    .filter((item) => item.offer.endsAt && item.offer.endsAt.getTime() > now)
    .sort((a, b) => a.offer.endsAt!.getTime() - b.offer.endsAt!.getTime())
    .slice(0, limit);
}

export function soonestEnd(items: PromoItem[], now: number): Date | null {
  let soonest: Date | null = null;
  for (const item of items) {
    const end = item.offer.endsAt;
    if (end && end.getTime() > now && (!soonest || end < soonest)) soonest = end;
  }
  return soonest;
}

export function cardDomId(sectionId: string, cardIndex: number): string {
  return `card-${sectionId}-${cardIndex}`;
}

/** The LINE deep link that opens the OA chat with the message pre-filled. */
function chatUrl(card: PromoCard, basicId: string | null, chatText: string): string | null {
  if (!basicId) return null;
  const text = chatText.replace(/\{partner\}/g, card.partner ?? '').trim();
  if (!text) return null;
  // LINE URL scheme: oaMessage/{id}/?{url-encoded message} — the query string IS the text.
  return `https://line.me/R/oaMessage/@${basicId.replace(/^@/, '')}/?${encodeURIComponent(text)}`;
}
