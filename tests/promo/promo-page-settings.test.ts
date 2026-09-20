import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PROMO_PAGE_SETTINGS,
  getPromoPageSettings,
  mergePromoPageSettings,
  promoPageSettingsSchema,
} from '@/lib/promo-page-settings';

describe('getPromoPageSettings', () => {
  it('defaults when the account has no settings at all', () => {
    expect(getPromoPageSettings(null)).toEqual({
      newsId: 12,
      colsMobile: 2,
      colsDesktop: 4,
      showTabs: true,
      showChatButton: true,
      chatText: 'สนใจโปร {partner}',
      heroBanners: [],
      sections: [],
    });
    expect(getPromoPageSettings({})).toEqual(DEFAULT_PROMO_PAGE_SETTINGS);
    expect(getPromoPageSettings({ settings: { other: 1 } })).toEqual(DEFAULT_PROMO_PAGE_SETTINGS);
  });

  it('fills missing keys and keeps the ones that are set', () => {
    expect(getPromoPageSettings({ settings: { promoPage: { newsId: 14, colsMobile: 1 } } })).toEqual(
      { ...DEFAULT_PROMO_PAGE_SETTINGS, newsId: 14, colsMobile: 1 }
    );
  });

  it('falls back to defaults rather than throwing on a bad blob', () => {
    expect(getPromoPageSettings({ settings: 'not json' })).toEqual(DEFAULT_PROMO_PAGE_SETTINGS);
    expect(getPromoPageSettings({ settings: { promoPage: { colsDesktop: 9 } } })).toEqual(
      DEFAULT_PROMO_PAGE_SETTINGS
    );
  });
});

describe('mergePromoPageSettings', () => {
  it('leaves the other settings keys alone', () => {
    const next = promoPageSettingsSchema.parse({ newsId: 12, colsDesktop: 5 });
    expect(mergePromoPageSettings({ liff: { id: 'x' }, promoPage: { newsId: 1 } }, next)).toEqual({
      liff: { id: 'x' },
      promoPage: next,
    });
    expect(mergePromoPageSettings(null, next)).toEqual({ promoPage: next });
  });
});
