import { z } from 'zod';
import type { ExportPreviewProduct, FlexMessageTemplate } from '@/lib/flex-builder';

/**
 * Where a product link in a LINE broadcast should land.
 *
 * The feed publishes links on the wholesale app's own domain, which is correct
 * for the feed. Broadcasts are different: the shop owner asked on 2026-08-25 for
 * links sent from the inbox to go to the legacy storefront instead.
 *
 * Only the host is swapped — the path still comes from the feed, so the SKU stays
 * encoded the way the wholesale app encodes it. Rebuilding the path from the SKU here
 * is what produced /product/0000 and mapped '90' and 'A-90' onto the same page.
 */
export const BROADCAST_LINK_HOST =
  process.env.WHOLESALE_PROMO_LINK_HOST || 'https://www.cnypharmacy.com';

/** Move a feed link onto the host broadcasts should point at, path intact. */
export function toBroadcastLink(url: string): string {
  if (!url) return '';
  try {
    const source = new URL(url);
    return `${BROADCAST_LINK_HOST.replace(/\/$/, '')}${source.pathname}${source.search}`;
  } catch {
    return '';
  }
}

const TEMPLATES = [
  'product_catalog',
  'promotion',
  'flash_sale',
  'new_arrival',
  'bestseller',
] as const;

/**
 * https, not merely a valid URL. LINE will not load an http image on many phones,
 * and an http link passes every check between here and the customer's screen while
 * failing on it.
 */
export const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'must be https' });

export const itemSchema = z.object({
  productId: z.number(),
  sku: z.string(),
  // A nameless bubble tells the customer nothing, so it is dropped and counted
  // rather than sent. Every other missing field degrades to something readable.
  name: z.string().min(1),
  imageUrl: httpsUrl.nullable().catch(null),
  basePrice: z.number().nonnegative(),
  promotionPrice: z.number().nonnegative().nullable().catch(null),
  unitLabel: z.string().optional(),
  promoLine1: z.string().optional(),
  promoLine2: z.string().optional(),
  offerStart: z.string().optional(),
  offerEnd: z.string().optional(),
  // The feed sends '' for a product whose SKU is null in the wholesale database,
  // and the flex builder now renders that as a card with no button. Dropping the
  // product instead would lose a real promotion over a missing link. Anything that
  // is neither empty nor https becomes '' for the same reason.
  productUrl: z.union([z.literal(''), httpsUrl]).catch(''),
  ribbonText: z.string().optional(),
});

export const feedSchema = z.object({
  generatedAt: z.string(),
  siteUrl: z.string().url(),
  groups: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      template: z.enum(TEMPLATES),
      endsAt: z.string().nullable(),
      // How many promotions the group actually holds, when the feed says so.
      totalCount: z.number().int().nonnegative().optional(),
      items: z.array(z.unknown()),
    })
  ),
});

export interface WholesalePromoGroup {
  key: string;
  label: string;
  template: FlexMessageTemplate;
  endsAt: string | null;
  items: ExportPreviewProduct[];
  /** Items the feed sent that failed validation and were left out. */
  droppedCount: number;
  /** What the group holds upstream, when the feed reports it — items is a capped slice. */
  totalCount?: number;
}

export interface WholesalePromoFeed {
  generatedAt: string;
  siteUrl: string;
  linkHost: string;
  groups: WholesalePromoGroup[];
}

export type FetchWholesalePromosResult =
  | { success: true; data: WholesalePromoFeed }
  | { success: false; reason: 'no_env' }
  | { success: false; reason: 'upstream_error'; message: string }
  | { success: false; reason: 'schema_error'; issues: z.ZodIssue[] }
  | { success: false; reason: 'network_error'; message: string };

/** Normalise a parsed feed into validated, link-rehosted groups. */
function normaliseGroups(feed: z.infer<typeof feedSchema>): WholesalePromoGroup[] {
  return feed.groups.map((group) => {
    const parsed = group.items.map((item) => itemSchema.safeParse(item));
    return {
      key: group.key,
      label: group.label,
      template: group.template,
      endsAt: group.endsAt,
      items: parsed.flatMap((result) =>
        result.success
          ? [{ ...result.data, productUrl: toBroadcastLink(result.data.productUrl) }]
          : []
      ),
      droppedCount: parsed.filter((result) => !result.success).length,
      totalCount: group.totalCount,
    };
  });
}

/**
 * Fetch and normalise the wholesale promo feed.
 *
 * Returns a discriminated result so callers can produce accurate error messages.
 * The authenticated route maps each reason to a specific HTTP status; the public
 * promo page treats any non-success as an empty state.
 *
 * Requires WHOLESALE_PROMO_FEED_URL.
 */
export async function fetchWholesalePromos(): Promise<FetchWholesalePromosResult> {
  const feedUrl = process.env.WHOLESALE_PROMO_FEED_URL;
  if (!feedUrl) {
    return { success: false, reason: 'no_env' };
  }

  try {
    const response = await fetch(feedUrl, {
      cache: 'no-store',
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(20_000),
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      // The feed answers 503 with the reason when its own domain is unconfigured;
      // passing that through is the difference between a fixable message and
      // "something went wrong".
      const message =
        (payload as { statusMessage?: string; message?: string } | null)?.statusMessage ||
        (payload as { message?: string } | null)?.message ||
        `HTTP ${response.status}`;
      return { success: false, reason: 'upstream_error', message };
    }

    const feed = feedSchema.parse(payload);
    const groups = normaliseGroups(feed);

    return {
      success: true,
      data: {
        generatedAt: feed.generatedAt,
        siteUrl: feed.siteUrl,
        linkHost: BROADCAST_LINK_HOST,
        groups,
      },
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, reason: 'schema_error', issues: error.issues };
    }
    return { success: false, reason: 'network_error', message: (error as Error).message };
  }
}

/**
 * Filter out expired promos and promote items whose name contains the keyword.
 *
 * Items without offerEnd are always kept. Items whose offerEnd is before `now`
 * are dropped. Of the remaining active items, those whose name contains `keyword`
 * (case-insensitive trimmed substring) are moved to the front; original order
 * is preserved within each group.
 *
 * // ponytail: substring match; switch to a brand field if the CNY feed adds one
 */
export function sortPromosForKeyword(
  items: ExportPreviewProduct[],
  keyword: string,
  now: Date
): ExportPreviewProduct[] {
  const active = items.filter((item) => {
    if (!item.offerEnd) return true;
    const end = new Date(item.offerEnd);
    return Number.isFinite(end.getTime()) && end > now;
  });

  const trimmed = keyword.trim().toLowerCase();
  if (!trimmed) return active;

  const matching: ExportPreviewProduct[] = [];
  const rest: ExportPreviewProduct[] = [];
  for (const item of active) {
    if (item.name.toLowerCase().includes(trimmed)) {
      matching.push(item);
    } else {
      rest.push(item);
    }
  }
  return [...matching, ...rest];
}
