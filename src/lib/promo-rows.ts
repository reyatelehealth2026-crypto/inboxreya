import type { PromoSection } from '@/lib/cny-news-promo';

/**
 * Row helpers shared by the public /promo page and the admin settings API, so both
 * name and order the CMS sections the same way. Types only — safe in client code.
 */

export function partnerNames(section: PromoSection): Set<string> {
  return new Set(section.cards.flatMap((card) => (card.partner ? [card.partner] : [])));
}

/** Every partner card is a brand deal, so the row is named for the group, not its first brands. */
export function rowTitle(section: PromoSection, index: number): string {
  if (partnerNames(section).size > 0) return 'ดีลแบรนด์พาร์ทเนอร์';
  if (section.cards.some((card) => card.kind === 'product')) return 'สินค้าราคาพิเศษ';
  return `ส่วนที่ ${index + 1}`;
}

/** Items whose id is in `ids` come first in that order; the rest keep their own order. */
export function orderByIds<T extends { id: string }>(items: T[], ids: string[]): T[] {
  const rank = new Map(ids.map((id, i) => [id, i]));
  return [...items].sort((a, b) => (rank.get(a.id) ?? ids.length) - (rank.get(b.id) ?? ids.length));
}
