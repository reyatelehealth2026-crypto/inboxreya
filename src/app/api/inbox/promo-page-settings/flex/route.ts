import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { promoPageSettingsSchema } from '@/lib/promo-page-settings'
import { loadPromoData } from '@/lib/promo-data'
import { getCachedPrices, refreshPrices, skuFromCard } from '@/lib/cny-promo-offers'
import {
  buildPromoFlexMessages,
  fetchImageRatios,
  flexImageUrls,
  heroImageUrl,
  selectFlexItems,
} from '@/lib/promo-flex'
import { getPublicOrigin } from '@/lib/broadcast-runtime'

// POST /api/inbox/promo-page-settings/flex[?at=<ISO>] — the /promo page, as rendered with
// these (possibly unsaved) settings, turned into LINE flex messages for a broadcast. `at`
// is a future send time: deals ending before it drop out and "เหลือ N วัน" counts from it.
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const parsed = promoPageSettingsSchema.safeParse(await req.json().catch(() => null))
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ถูกต้อง', issues: parsed.error.issues },
        { status: 400 }
      )
    }
    const settings = parsed.data

    const account = await prisma.lineAccount.findFirst({ where: { isDefault: true }, select: { basicId: true } })
    const basicId = account?.basicId ?? null
    const at = Date.parse(req.nextUrl.searchParams.get('at') ?? '')
    const now = Number.isFinite(at) && at > Date.now() ? at : Date.now()

    // Which cards go in depends on campaigns, not prices — so pick first, then wait for
    // just those prices (≤20 SKUs) instead of the page's background refresh of all of them.
    const draft = await loadPromoData(settings, basicId, false)
    if (!draft) {
      return NextResponse.json({ success: false, error: 'ไม่พบบทความโปรโมชัน' }, { status: 404 })
    }
    const picked = selectFlexItems(draft.rows, now)
    const skus = Array.from(
      new Set(
        [...picked.deals, ...picked.rows.flatMap((r) => r.items)].flatMap((item) => {
          const sku = skuFromCard(item.card)
          return sku ? [sku] : []
        })
      )
    )
    const cached = getCachedPrices(skus, false)
    // ponytail: a SKU already being fetched by a page view is skipped here and may show without a price
    await refreshPrices(skus.filter((sku) => !cached.has(sku)))

    const data = (await loadPromoData(settings, basicId, false)) ?? draft
    const selection = selectFlexItems(data.rows, now)
    const hero = heroImageUrl(settings, data.rows)
    const ratios = await fetchImageRatios(flexImageUrls(selection, hero))
    const messages = buildPromoFlexMessages({ selection, heroImageUrl: hero, origin: getPublicOrigin(), now, ratios })

    return NextResponse.json({ success: true, messages })
  } catch (error) {
    console.error('[promo-page-settings] flex failed', error)
    return NextResponse.json({ success: false, error: 'สร้าง Flex ไม่สำเร็จ' }, { status: 500 })
  }
}
