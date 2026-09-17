import { describe, it, expect } from 'vitest';
import { sortPromosForKeyword } from '@/lib/wholesale-promos';
import type { ExportPreviewProduct } from '@/lib/flex-builder';

const NOW = new Date('2026-09-18T10:00:00Z');

/** Build a minimal ExportPreviewProduct with required fields only. */
function item(
  overrides: Pick<ExportPreviewProduct, 'productId' | 'name' | 'basePrice'> &
    Partial<ExportPreviewProduct>
): ExportPreviewProduct {
  return {
    sku: String(overrides.productId),
    imageUrl: null,
    promotionPrice: null,
    ...overrides,
  };
}

describe('sortPromosForKeyword', () => {
  describe('expiry filter', () => {
    it('keeps items with no offerEnd', () => {
      const items = [item({ productId: 1, name: 'A', basePrice: 100 })];
      expect(sortPromosForKeyword(items, '', NOW)).toHaveLength(1);
    });

    it('drops items whose offerEnd is in the past', () => {
      const items = [
        item({ productId: 1, name: 'Expired', basePrice: 100, offerEnd: '2026-09-17T23:59:00Z' }),
        item({ productId: 2, name: 'Active', basePrice: 100, offerEnd: '2026-09-19T00:00:00Z' }),
      ];
      const result = sortPromosForKeyword(items, '', NOW);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe(2);
    });

    it('keeps items whose offerEnd is one second in the future', () => {
      const future = item({
        productId: 1,
        name: 'Borderline',
        basePrice: 100,
        offerEnd: new Date(NOW.getTime() + 1000).toISOString(),
      });
      expect(sortPromosForKeyword([future], '', NOW)).toHaveLength(1);
    });

    it('silently drops items with an unparseable offerEnd', () => {
      const items = [
        item({ productId: 1, name: 'Bad date', basePrice: 100, offerEnd: 'not-a-date' }),
        item({ productId: 2, name: 'No date', basePrice: 100 }),
      ];
      const result = sortPromosForKeyword(items, '', NOW);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe(2);
    });
  });

  describe('keyword matching', () => {
    it('empty keyword returns active items in original order', () => {
      const items = [
        item({ productId: 1, name: 'Zinc', basePrice: 50 }),
        item({ productId: 2, name: 'Amoxicillin', basePrice: 80 }),
      ];
      expect(sortPromosForKeyword(items, '', NOW).map((i) => i.productId)).toEqual([1, 2]);
    });

    it('whitespace-only keyword returns active items in original order', () => {
      const items = [
        item({ productId: 1, name: 'Zinc', basePrice: 50 }),
        item({ productId: 2, name: 'Amoxicillin', basePrice: 80 }),
      ];
      expect(sortPromosForKeyword(items, '   ', NOW).map((i) => i.productId)).toEqual([1, 2]);
    });

    it('matching items come first, non-matching follow in original order', () => {
      const items = [
        item({ productId: 1, name: 'Vitamin C', basePrice: 50 }),
        item({ productId: 2, name: 'SOS Plus', basePrice: 200 }),
        item({ productId: 3, name: 'SOS Junior', basePrice: 150 }),
        item({ productId: 4, name: 'Zinc', basePrice: 80 }),
      ];
      expect(sortPromosForKeyword(items, 'SOS', NOW).map((i) => i.productId)).toEqual([2, 3, 1, 4]);
    });

    it('keyword match is case-insensitive', () => {
      const items = [
        item({ productId: 1, name: 'Vitamin C', basePrice: 50 }),
        item({ productId: 2, name: 'sos plus', basePrice: 200 }),
      ];
      expect(sortPromosForKeyword(items, 'SOS', NOW)[0].productId).toBe(2);
    });

    it('keyword match is substring (not whole-word)', () => {
      const items = [
        item({ productId: 1, name: 'Paracetamol', basePrice: 30 }),
        item({ productId: 2, name: 'Zinc', basePrice: 80 }),
      ];
      expect(sortPromosForKeyword(items, 'para', NOW)[0].productId).toBe(1);
    });

    it('unmatched keyword returns active items in original order', () => {
      const items = [
        item({ productId: 1, name: 'Zinc', basePrice: 80 }),
        item({ productId: 2, name: 'Vitamin C', basePrice: 50 }),
      ];
      expect(sortPromosForKeyword(items, 'xyz-no-match', NOW).map((i) => i.productId)).toEqual([1, 2]);
    });
  });

  describe('expiry + keyword interaction', () => {
    it('drops expired items even when they match the keyword', () => {
      const items = [
        item({ productId: 1, name: 'SOS Plus', basePrice: 200, offerEnd: '2026-09-17T00:00:00Z' }),
        item({ productId: 2, name: 'SOS Junior', basePrice: 150 }),
      ];
      const result = sortPromosForKeyword(items, 'SOS', NOW);
      expect(result).toHaveLength(1);
      expect(result[0].productId).toBe(2);
    });

    it('empty input list returns empty list', () => {
      expect(sortPromosForKeyword([], 'SOS', NOW)).toEqual([]);
    });
  });
});
