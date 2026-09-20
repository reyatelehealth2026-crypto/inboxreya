import { describe, it, expect } from 'vitest';
import { orderByIds, rowTitle } from '@/lib/promo-rows';
import type { PromoSection } from '@/lib/cny-news-promo';

const items = ['a', 'b', 'c', 'd'].map((id) => ({ id }));

describe('orderByIds', () => {
  it('puts the listed ids first in that order and keeps the rest in place', () => {
    expect(orderByIds(items, ['c', 'a']).map((item) => item.id)).toEqual(['c', 'a', 'b', 'd']);
  });

  it('ignores ids that no longer exist and leaves the order alone when nothing is listed', () => {
    expect(orderByIds(items, ['gone', 'd']).map((item) => item.id)).toEqual(['d', 'a', 'b', 'c']);
    expect(orderByIds(items, []).map((item) => item.id)).toEqual(['a', 'b', 'c', 'd']);
  });
});

describe('rowTitle', () => {
  const section = (cards: PromoSection['cards']): PromoSection => ({ id: 's', headerImageUrl: null, cards });
  const card = (extra: Partial<PromoSection['cards'][number]>) =>
    ({ kind: 'image', imageUrl: 'https://x/y.png', href: null, partner: null, ...extra }) as PromoSection['cards'][number];

  it('names partner rows for the group and product rows for the deal', () => {
    expect(rowTitle(section([card({ kind: 'partner', partner: 'VISTRA' })]), 0)).toBe('ดีลแบรนด์พาร์ทเนอร์');
    expect(rowTitle(section([card({ kind: 'product' })]), 0)).toBe('สินค้าราคาพิเศษ');
    expect(rowTitle(section([card({})]), 2)).toBe('ส่วนที่ 3');
  });
});
