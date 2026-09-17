import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth-middleware';
import type { ExportPreviewProduct, FlexMessageTemplate } from '@/lib/flex-builder';

/**
 * GET /api/inbox/catalog/wholesale-promos
 *
 * The wholesale shop's promotions, already grouped by promo type, for the promo
 * composer to pick from. The other two tabs read another shop entirely
 * (/api/inbox/catalog/cny-products and public/data/cnypharmacyz.csv), so a wholesale
 * promotion is not reachable from them at all, and the CSV needs a redeploy before a
 * price change shows up.
 *
 * The feed publishes items in ExportPreviewProduct shape, so nothing is remapped
 * here — but it is still an external source whose output is copied into a message
 * sent to every follower, so the payload is validated before it is handed on. A
 * malformed item is dropped rather than allowed to build a broken bubble.
 *
 * Requires WHOLESALE_PROMO_FEED_URL (e.g. https://<wholesale-domain>/api/promo-feed).
 * The feed itself refuses to answer unless its own public domain is configured,
 * because every link it returns is published to LINE.
 */

export const dynamic = 'force-dynamic';

/**
 * Where a product link in a LINE broadcast should land.
 *
 * The feed publishes links on the wholesale app's own domain (wholesale.re-ya.com),
 * which is correct for the feed. Broadcasts are different: the shop owner asked on
 * 2026-08-25 for links sent from the inbox to go to the legacy storefront instead.
 *
 * Only the host is swapped — the path still comes from the feed, so the SKU stays
 * encoded the way the wholesale app encodes it. Rebuilding the path from the SKU here
 * is what produced /product/0000 and mapped '90' and 'A-90' onto the same page.
 *
 * Worth knowing when changing this: the legacy storefront answers 200 for every
 * /product/<sku> path, serving a blank page for one that does not exist. A link that
 * goes nowhere is indistinguishable from a working one by status code alone.
 */
const BROADCAST_LINK_HOST =
  process.env.WHOLESALE_PROMO_LINK_HOST || 'https://www.cnypharmacy.com';

/** Move a feed link onto the host broadcasts should point at, path intact. */
function toBroadcastLink(url: string): string {
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
const httpsUrl = z
  .string()
  .url()
  .refine((value) => value.startsWith('https://'), { message: 'must be https' });

const itemSchema = z.object({
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
  // is neither empty nor https becomes '' for the same reason: no button beats a
  // button that goes nowhere, and it beats losing the product entirely.
  productUrl: z.union([z.literal(''), httpsUrl]).catch(''),
  ribbonText: z.string().optional(),
});

const feedSchema = z.object({
  generatedAt: z.string(),
  siteUrl: z.string().url(),
  groups: z.array(
    z.object({
      key: z.string(),
      label: z.string(),
      template: z.enum(TEMPLATES),
      endsAt: z.string().nullable(),
      // How many promotions the group actually holds, when the feed says so. It caps
      // what it sends, and a shelf of 60 out of 1324 that does not admit it is the
      // same silent truncation this tab warns about everywhere else.
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

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) return authResult;

  const feedUrl = process.env.WHOLESALE_PROMO_FEED_URL;
  if (!feedUrl) {
    return NextResponse.json(
      { success: false, error: 'ยังไม่ได้ตั้งค่า WHOLESALE_PROMO_FEED_URL สำหรับดึงโปรโมชันขายส่ง' },
      { status: 503 }
    );
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
      const upstream =
        (payload as { statusMessage?: string; message?: string } | null)?.statusMessage ||
        (payload as { message?: string } | null)?.message ||
        `HTTP ${response.status}`;
      return NextResponse.json(
        { success: false, error: `ดึงโปรโมชันขายส่งไม่สำเร็จ: ${upstream}` },
        { status: 502 }
      );
    }

    const feed = feedSchema.parse(payload);

    const groups: WholesalePromoGroup[] = feed.groups.map((group) => {
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

    return NextResponse.json({
      success: true,
      data: {
        generatedAt: feed.generatedAt,
        // Where the products come from, and where their links are sent — not the
        // same host, deliberately.
        siteUrl: feed.siteUrl,
        linkHost: BROADCAST_LINK_HOST,
        groups,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { success: false, error: 'รูปแบบข้อมูลโปรโมชันขายส่งไม่ถูกต้อง', details: error.issues },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { success: false, error: `ดึงโปรโมชันขายส่งไม่สำเร็จ: ${(error as Error).message}` },
      { status: 502 }
    );
  }
}
