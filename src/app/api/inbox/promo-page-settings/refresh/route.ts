import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { clearCnyNewsPromoCache } from '@/lib/cny-news-promo'

// POST /api/inbox/promo-page-settings/refresh - drop the cached CMS article so the
// next /promo view refetches, instead of waiting out the 5-minute cache.
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    clearCnyNewsPromoCache()
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('[promo-page-settings] refresh failed', error)
    return NextResponse.json({ success: false, error: 'ล้างแคชไม่สำเร็จ' }, { status: 500 })
  }
}
