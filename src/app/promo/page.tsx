import { Metadata } from 'next';
import prisma from '@/lib/prisma';
import { fetchWholesalePromos, sortPromosForKeyword } from '@/lib/wholesale-promos';
import type { ExportPreviewProduct } from '@/lib/flex-builder';

export const metadata: Metadata = {
  title: 'โปรโมชัน',
  robots: { index: false, follow: false },
};

export const dynamic = 'force-dynamic';

export default async function PromoPage({
  searchParams,
}: {
  searchParams: Promise<{ k?: string }>;
}) {
  const { k = '' } = await searchParams;

  const [result, lineAccount] = await Promise.all([
    fetchWholesalePromos(),
    prisma.lineAccount
      .findFirst({ where: { isDefault: true }, select: { basicId: true } })
      .catch(() => null),
  ]);

  const basicId = lineAccount?.basicId ?? null;

  if (!result.success) {
    return (
      <main className="px-4 py-6">
        <p className="text-sm text-gray-500">ไม่มีโปรโมชันในขณะนี้</p>
      </main>
    );
  }

  const now = new Date();
  const allItems: ExportPreviewProduct[] = result.data.groups.flatMap((g) => g.items);
  const items = sortPromosForKeyword(allItems, k, now);

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-6">
      <h1 className="text-lg font-bold text-gray-800 mb-4">โปรโมชัน</h1>
      {items.length === 0 ? (
        <p className="text-sm text-gray-500">ไม่มีโปรโมชันในขณะนี้</p>
      ) : (
        <div className="flex flex-col gap-4">
          {items.map((item) => (
            <PromoCard key={item.productId} item={item} basicId={basicId} />
          ))}
        </div>
      )}
    </main>
  );
}

function formatPrice(n: number) {
  return n.toLocaleString('th-TH', { minimumFractionDigits: 0 });
}

function formatOfferEnd(offerEnd: string | undefined): string | null {
  if (!offerEnd) return null;
  const d = new Date(offerEnd);
  if (!Number.isFinite(d.getTime())) return null;
  return d.toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function PromoCard({
  item,
  basicId,
}: {
  item: ExportPreviewProduct;
  basicId: string | null;
}) {
  const offerEndLabel = formatOfferEnd(item.offerEnd);
  const chatUrl = basicId
    ? `https://line.me/R/oaMessage/@${basicId}/?text=${encodeURIComponent(`สั่ง ${item.name}`)}`
    : null;

  return (
    <div className="bg-white rounded-xl shadow-sm overflow-hidden">
      {item.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.imageUrl} alt={item.name} className="w-full h-48 object-cover" />
      )}
      <div className="p-4">
        <p className="font-semibold text-gray-900 text-base leading-snug">{item.name}</p>
        {item.unitLabel && (
          <p className="text-xs text-gray-500 mt-0.5">หน่วย: {item.unitLabel}</p>
        )}
        <div className="mt-2 flex items-baseline gap-2">
          {item.promotionPrice != null ? (
            <>
              <span className="text-xl font-bold text-red-600">
                ฿{formatPrice(item.promotionPrice)}
              </span>
              <span className="text-sm text-gray-400 line-through">
                ฿{formatPrice(item.basePrice)}
              </span>
            </>
          ) : (
            <span className="text-xl font-bold text-gray-800">
              ฿{formatPrice(item.basePrice)}
            </span>
          )}
        </div>
        {item.promoLine1 && (
          <p className="mt-1 text-sm text-green-700">{item.promoLine1}</p>
        )}
        {item.promoLine2 && (
          <p className="text-sm text-green-700">{item.promoLine2}</p>
        )}
        {offerEndLabel && (
          <p className="mt-1 text-xs text-gray-400">โปรถึง {offerEndLabel}</p>
        )}
        <div className="mt-3 flex gap-2">
          {item.productUrl && (
            <a
              href={item.productUrl}
              className="flex-1 text-center rounded-lg bg-green-600 text-white text-sm font-medium py-2 px-3"
            >
              สั่งซื้อบนเว็บ
            </a>
          )}
          {chatUrl && (
            <a
              href={chatUrl}
              className="flex-1 text-center rounded-lg bg-green-100 text-green-800 text-sm font-medium py-2 px-3"
            >
              สั่งผ่านแชท
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
