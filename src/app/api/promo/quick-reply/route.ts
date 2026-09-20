import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { fetchCnyNewsPromo } from '@/lib/cny-news-promo'
import { getPromoPageSettings } from '@/lib/promo-page-settings'
import { buildPromoQuickReply } from '@/lib/promo-quick-reply'
import { getPublicOrigin } from '@/lib/broadcast-runtime'

export const dynamic = 'force-dynamic'

// GET /api/promo/quick-reply — public (middleware allows /api/promo/). The PHP
// webhook fetches this (cached 10 min on its side) and attaches the result to
// the last message of every bot reply. Nothing here is secret: the same links
// are on /promo. `quickReply: null` means "attach nothing".
export async function GET() {
  try {
    const account = await prisma.lineAccount
      .findFirst({ where: { isDefault: true }, select: { settings: true } })
      .catch((error: unknown) => {
        console.error('[promo-quick-reply] default LINE account lookup failed', error)
        return null
      })
    const settings = getPromoPageSettings(account)
    if (!settings.showQuickReply) return reply(null)

    const promo = await fetchCnyNewsPromo(settings.newsId)
    return reply(buildPromoQuickReply(promo?.partners ?? [], getPublicOrigin()))
  } catch (error) {
    console.error('[promo-quick-reply] failed', error)
    return NextResponse.json({ success: false, quickReply: null }, { status: 500 })
  }
}

function reply(quickReply: ReturnType<typeof buildPromoQuickReply> | null) {
  return NextResponse.json(
    { success: true, quickReply },
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  )
}
