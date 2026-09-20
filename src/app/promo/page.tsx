import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import {
  fetchCnyNewsPromo,
  findCardIndexForKeyword,
  type PromoCard as PromoCardData,
} from '@/lib/cny-news-promo';
import {
  getPromoPageSettings,
  type PromoHeroBanner,
  type PromoPageSettings,
} from '@/lib/promo-page-settings';
import { readPreview } from '@/lib/promo-preview';
import { orderByIds, partnerNames, rowTitle } from '@/lib/promo-rows';
import {
  buildOffer,
  fetchCnyCampaigns,
  formatThaiDate,
  getCachedPrices,
  parseOfferSort,
  skuFromCard,
  sortOffers,
  type OfferSort,
  type PromoOffer,
} from '@/lib/cny-promo-offers';
import { PromoFocus } from '@/components/promo-page/PromoFocus';
import { PromoHero, type HeroSlide } from '@/components/promo-page/PromoHero';
import { DealCountdown } from '@/components/promo-page/DealCountdown';
import { PromoCard } from '@/components/promo-page/PromoCard';
import './promo.css';

export const metadata: Metadata = {
  title: 'รวมโปรโมชัน',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

/** Cards shown in a row before "ดูเพิ่มเติม" takes over. */
const RAIL_LIMIT = 10;
const DEAL_LIMIT = 8;
const QUERY_MAX = 100;

const SORTS: { key: OfferSort; label: string }[] = [
  { key: 'off', label: 'ส่วนลดมากสุด' },
  { key: 'price', label: 'ราคาต่ำสุด' },
  { key: 'brand', label: 'ตามแบรนด์' },
];

interface Item {
  id: string;
  card: PromoCardData;
  offer: PromoOffer;
  chatUrl: string | null;
}

interface Row {
  id: string;
  title: string;
  /** Distinct partner brands in the row — every partner card is a brand deal. */
  brands: number;
  headerImageUrl: string | null;
  headerHref: string | null;
  items: Item[];
}

interface PromoSearch {
  /** Broadcast keyword — scroll to and ring that card. */
  k?: string;
  /** Signed draft settings from the admin page's live preview. */
  preview?: string;
  /** Section id — the full grid of one row. */
  s?: string;
  /** Free-text search across every card. */
  q?: string;
  sort?: string;
}

/**
 * The page a customer lands on after tapping a region of the imagemap broadcast.
 *
 * Artwork and links come from the marketing team's CMS article on the main site,
 * prices and campaign dates from the store's product API — a promo change needs
 * no deploy. Layout settings come from the inbox admin page (/inbox/promo-page).
 */
export default async function PromoPage({ searchParams }: { searchParams: Promise<PromoSearch> }) {
  const params = await searchParams;
  const k = params.k ?? '';
  const q = (params.q ?? '').trim().slice(0, QUERY_MAX);
  const sort = parseOfferSort(params.sort);

  const lineAccount = await prisma.lineAccount
    .findFirst({ where: { isDefault: true }, select: { basicId: true, settings: true } })
    .catch((error: unknown) => {
      console.error('[promo] default LINE account lookup failed', error);
      return null;
    });

  const settings = readPreview(params.preview) ?? getPromoPageSettings(lineAccount);
  const basicId = lineAccount?.basicId ?? null;
  const promo = await fetchCnyNewsPromo(settings.newsId);

  if (!promo || promo.sections.length === 0) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-10 text-center">
        <p className="text-sm text-gray-500">ยังไม่มีโปรโมชันในขณะนี้</p>
        <p className="mt-1 text-xs text-gray-400">กรุณาลองใหม่อีกครั้งภายหลัง</p>
      </main>
    );
  }

  const campaigns = await fetchCnyCampaigns();
  const skus = promo.sections.flatMap((section) =>
    section.cards.flatMap((card) => {
      const sku = skuFromCard(card);
      return sku ? [sku] : [];
    })
  );
  const prices = getCachedPrices(skus);

  // Admin overrides per section: listed ones come first in that order, and their banner wins.
  const overrides = new Map(settings.sections.map((section) => [section.id, section]));
  const rows: Row[] = orderByIds(
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
  const cardRows = rows.filter((row) => row.items.length > 0);

  const section = params.s ? cardRows.find((row) => row.id === params.s) : undefined;
  if (section || q) {
    return <SectionView row={section} rows={cardRows} q={q} sort={sort} settings={settings} />;
  }

  const focus = k ? findCardIndexForKeyword(promo.sections, k) : null;
  const focusId = focus ? cardDomId(focus.sectionId, focus.cardIndex) : null;

  const allItems = cardRows.flatMap((row) => row.items);
  const now = Date.now();
  const deals = allItems
    .filter((item) => item.offer.endsAt && item.offer.endsAt.getTime() > now)
    .sort((a, b) => a.offer.endsAt!.getTime() - b.offer.endsAt!.getTime())
    .slice(0, DEAL_LIMIT);
  const dealEnd = deals[0]?.offer.endsAt ?? null;

  return (
    <main className="ph">
      <div className="ph-shell">
        <Header tabs={settings.showTabs && cardRows.length > 1 ? cardRows : []} q="" />
        <PromoHero slides={heroSlides(rows, allItems, settings.heroBanners)} />

        {dealEnd && (
          <section className="ph-deal" id="deals">
            <div className="ph-deal-bar">
              <div>
                <div className="ph-deal-title">ดีลใกล้หมดเวลา</div>
                <div className="ph-deal-sub">หมดแล้วหมดเลย · จบ {formatThaiDate(dealEnd)}</div>
              </div>
              <DealCountdown endsAt={dealEnd.toISOString()} />
            </div>
            <div className="ph-rail scr" style={{ padding: '12px' }}>
              {deals.map((item) => (
                <PromoCard key={item.id} {...item} id={`deal-${item.id}`} />
              ))}
            </div>
          </section>
        )}

        {cardRows.map((row) => {
          // A card the CMS put alone on its row is a wide strip: it goes above the rail at full width.
          const wide = row.items.filter((item) => item.card.wide);
          const rail = row.items.filter((item) => !item.card.wide);
          const focusIndex = focus && focus.sectionId === row.id ? rail.findIndex((item) => item.id === focusId) : -1;
          const limit = Math.max(RAIL_LIMIT, focusIndex + 1);
          const ends = soonestEnd(row.items, now);
          return (
            <section key={row.id} id={row.id} className="ph-row">
              {row.headerImageUrl && (
                <div className="ph-banner">
                  {row.headerHref ? (
                    <a href={row.headerHref}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={row.headerImageUrl} alt="" loading="lazy" decoding="async" />
                    </a>
                  ) : (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={row.headerImageUrl} alt="" loading="lazy" decoding="async" />
                  )}
                </div>
              )}
              <div className="ph-row-head">
                <div>
                  <div className="ph-row-title">{row.title}</div>
                  <div className="ph-row-sub">
                    {row.brands > 0 ? `${row.brands} แบรนด์ · ` : ''}
                    {row.items.length} รายการ{ends ? ` · ถึง ${formatThaiDate(ends)}` : ''}
                  </div>
                </div>
                {rail.length > limit && (
                  <a className="ph-more" href={`/promo?s=${row.id}`}>
                    ดูเพิ่มเติม
                    <Chevron />
                  </a>
                )}
              </div>
              {wide.length > 0 && (
                <div className="ph-wide">
                  {wide.map((item) => (
                    <PromoCard key={item.id} {...item} />
                  ))}
                </div>
              )}
              <div className="ph-rail scr">
                {rail.slice(0, limit).map((item) => (
                  <PromoCard key={item.id} {...item} />
                ))}
              </div>
            </section>
          );
        })}

        <div className="ph-foot">ราคาและเงื่อนไขอ้างอิงจาก cnypharmacy.com ณ เวลาที่เปิดหน้า</div>
        {focusId && <PromoFocus targetId={focusId} />}
      </div>
    </main>
  );
}

/** The full grid of one row, or of every card matching a search — sortable. */
function SectionView({
  row,
  rows,
  q,
  sort,
  settings,
}: {
  row: Row | undefined;
  rows: Row[];
  q: string;
  sort: OfferSort;
  settings: PromoPageSettings;
}) {
  const needle = q.toLowerCase();
  const pool = row ? row.items : rows.flatMap((r) => r.items);
  const matched = needle
    ? pool.filter((item) =>
        `${item.offer.brand} ${item.offer.line} ${item.card.partner ?? ''} ${skuFromCard(item.card) ?? ''}`
          .toLowerCase()
          .includes(needle)
      )
    : pool;
  const items = sortOffers(matched, sort);
  const title = q ? `ผลการค้นหา "${q}"` : row!.title;
  const ends = soonestEnd(items, Date.now());
  const linkTo = (key: OfferSort) =>
    `/promo?${new URLSearchParams({ ...(row ? { s: row.id } : {}), ...(q ? { q } : {}), sort: key })}`;

  return (
    <main className="ph">
      <div className="ph-shell">
        <Header tabs={[]} q={q} />
        <div className="ph-cat-head">
          <a href="/promo" className="ph-back" aria-label="ย้อนกลับ">
            <ArrowLeft />
          </a>
          <div>
            <div className="ph-cat-title">{title}</div>
            <div className="ph-cat-sub">
              {items.length} รายการ{ends ? ` · ถึง ${formatThaiDate(ends)}` : ''}
            </div>
          </div>
        </div>
        <nav className="ph-sort" aria-label="เรียงลำดับ">
          {SORTS.map((option) => (
            <a key={option.key} href={linkTo(option.key)} className={option.key === sort ? 'on' : undefined}>
              {option.label}
            </a>
          ))}
        </nav>
        {items.length === 0 ? (
          <div className="ph-empty">ไม่พบโปรที่ตรงกับคำค้น</div>
        ) : (
          <div
            className="ph-grid"
            style={
              {
                '--promo-cols': settings.colsMobile,
                '--promo-cols-lg': settings.colsDesktop,
              } as React.CSSProperties
            }
          >
            {items.map((item) => (
              <PromoCard key={item.id} {...item} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}

function Header({ tabs, q }: { tabs: Row[]; q: string }) {
  return (
    <header className="ph-top">
      <div className="ph-top-row">
        <a href="/promo" className="ph-mark" aria-label="รวมโปรโมชัน">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/promo/cny-logo.png" alt="CNY Health Care" width="168" height="81" />
        </a>
        <form action="/promo" method="get" className="ph-search" role="search">
          <SearchIcon />
          <input
            name="q"
            defaultValue={q}
            maxLength={QUERY_MAX}
            placeholder="ค้นหาสินค้าหรือแบรนด์"
            aria-label="ค้นหา"
          />
        </form>
      </div>
      {tabs.length > 0 && (
        <nav className="ph-tabs scr">
          {tabs.map((row) => (
            <a key={row.id} href={`#${row.id}`}>
              {row.title}
            </a>
          ))}
        </nav>
      )}
    </header>
  );
}

/** Admin banners when set, else the CMS's banner-only sections; the partner statement goes second. */
function heroSlides(rows: Row[], items: Item[], custom: PromoHeroBanner[]): HeroSlide[] {
  const banners: HeroSlide[] =
    custom.length > 0
      ? custom.map((banner, i) => ({
          kind: 'image',
          src: banner.imageUrl,
          alt: `แบนเนอร์ ${i + 1}`,
          href: banner.href || undefined,
        }))
      : rows
          .filter((row) => row.headerImageUrl && row.items.length === 0)
          .map((row) => ({ kind: 'image', src: row.headerImageUrl!, alt: row.title }));
  const partners = new Set(items.flatMap((item) => (item.card.partner ? [item.card.partner] : [])));
  if (partners.size === 0) return banners;
  const statement: HeroSlide = {
    kind: 'statement',
    kicker: `PARTNER DEALS · ${partners.size} แบรนด์`,
    title: `ซื้อครบ รับของแถม\n${items.filter((item) => item.card.kind === 'partner').length} รายการ`,
    note: 'ของมีจำนวนจำกัด จนกว่าของจะหมด',
  };
  return [...banners.slice(0, 1), statement, ...banners.slice(1)];
}

function soonestEnd(items: Item[], now: number): Date | null {
  let soonest: Date | null = null;
  for (const item of items) {
    const end = item.offer.endsAt;
    if (end && end.getTime() > now && (!soonest || end < soonest)) soonest = end;
  }
  return soonest;
}

function cardDomId(sectionId: string, cardIndex: number): string {
  return `card-${sectionId}-${cardIndex}`;
}

/** The LINE deep link that opens the OA chat with the message pre-filled. */
function chatUrl(card: PromoCardData, basicId: string | null, chatText: string): string | null {
  if (!basicId) return null;
  const text = chatText.replace(/\{partner\}/g, card.partner ?? '').trim();
  if (!text) return null;
  // LINE URL scheme: oaMessage/{id}/?{url-encoded message} — the query string IS the text.
  return `https://line.me/R/oaMessage/@${basicId.replace(/^@/, '')}/?${encodeURIComponent(text)}`;
}

function Chevron() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m12 19-7-7 7-7" />
      <path d="M19 12H5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}
