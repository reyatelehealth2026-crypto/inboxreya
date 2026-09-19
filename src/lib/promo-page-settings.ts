import { z } from 'zod';
import { httpsUrl } from '@/lib/wholesale-promos';

/**
 * Display settings for the public /promo page.
 *
 * Stored under the `promoPage` key of the existing LineAccount.settings JSON —
 * no new table, no migration. Anything unreadable falls back to DEFAULTS so a
 * hand-edited settings blob cannot take the public page down.
 */
export const PROMO_PAGE_SETTINGS_KEY = 'promoPage';

export const promoPageSettingsSchema = z.object({
  newsId: z.coerce.number().int().positive().default(12),
  colsMobile: z.union([z.literal(1), z.literal(2)]).default(2),
  colsDesktop: z.union([z.literal(3), z.literal(4), z.literal(5)]).default(4),
  showTabs: z.boolean().default(true),
  showChatButton: z.boolean().default(true),
  chatText: z.string().trim().min(1).max(200).default('สนใจโปร {partner}'),
  /**
   * Slides for the banner at the top of the page. Empty means "use the full-width
   * banners the CMS article opens with". Links land in a public <a href>, so only
   * absolute https survives.
   */
  heroBanners: z
    .array(
      z.object({
        imageUrl: httpsUrl,
        href: z.union([z.literal(''), httpsUrl]).default(''),
      })
    )
    .max(8)
    .default([]),
});

export type PromoHeroBanner = PromoPageSettings['heroBanners'][number];

export type PromoPageSettings = z.infer<typeof promoPageSettingsSchema>;

export const DEFAULT_PROMO_PAGE_SETTINGS: PromoPageSettings =
  promoPageSettingsSchema.parse({});

/** Read the promoPage settings off a LineAccount row, defaults filled in. */
export function getPromoPageSettings(
  lineAccount: { settings?: unknown } | null | undefined
): PromoPageSettings {
  const settings = lineAccount?.settings;
  if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
    return DEFAULT_PROMO_PAGE_SETTINGS;
  }

  const raw = (settings as Record<string, unknown>)[PROMO_PAGE_SETTINGS_KEY];
  const parsed = promoPageSettingsSchema.safeParse(raw ?? {});
  if (!parsed.success) {
    console.error('[promo-page-settings] unusable settings, using defaults', parsed.error.issues);
    return DEFAULT_PROMO_PAGE_SETTINGS;
  }
  return parsed.data;
}

/** Merge new promoPage settings into the account's settings JSON, other keys intact. */
export function mergePromoPageSettings(
  existing: unknown,
  next: PromoPageSettings
): Record<string, unknown> {
  const base =
    existing && typeof existing === 'object' && !Array.isArray(existing)
      ? (existing as Record<string, unknown>)
      : {};
  return { ...base, [PROMO_PAGE_SETTINGS_KEY]: next };
}
