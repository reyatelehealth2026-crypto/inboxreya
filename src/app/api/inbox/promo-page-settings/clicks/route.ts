import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { aggregateRegionClicks } from '@/lib/promo-clicks'
import { getPublicOrigin } from '@/lib/broadcast-runtime'

const DEFAULT_DAYS = 30
const MAX_DAYS = 365

// GET /api/inbox/promo-page-settings/clicks?days=30 — imagemap and flex link taps per
// brand for the default account's broadcasts sent in the window (taps counted whenever
// they came), as distinct people and raw taps.
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const requested = Number(req.nextUrl.searchParams.get('days'))
    const days =
      Number.isFinite(requested) && requested > 0 ? Math.min(Math.floor(requested), MAX_DAYS) : DEFAULT_DAYS
    const since = new Date(Date.now() - days * 86_400_000)

    const account = await prisma.lineAccount.findFirst({ where: { isDefault: true }, select: { id: true } })
    if (!account) {
      return NextResponse.json({ success: false, error: 'ไม่พบบัญชี LINE หลัก' }, { status: 404 })
    }

    const sent = await prisma.broadcastMessageV2.findMany({
      where: {
        lineAccountId: account.id,
        sentAt: { gte: since },
        OR: [{ content: { contains: '"imagemapMeta"' } }, { content: { contains: '"flexLinks"' } }],
      },
      select: { id: true, content: true, deliveredCount: true, totalRecipients: true },
    })
    const broadcasts = sent.map((b) => ({
      id: b.id,
      content: b.content,
      recipients: b.deliveredCount || b.totalRecipients,
    }))

    const grouped = broadcasts.length
      ? await prisma.broadcastEngagement.groupBy({
          by: ['broadcastId', 'action', 'lineUserId'],
          where: { broadcastId: { in: broadcasts.map((b) => b.id) }, eventType: 'click' },
          _count: { _all: true },
        })
      : []
    const rows = grouped.map((g) => ({
      broadcastId: g.broadcastId,
      action: g.action,
      lineUserId: g.lineUserId,
      clicks: g._count._all,
    }))

    return NextResponse.json({
      success: true,
      days,
      data: aggregateRegionClicks(rows, broadcasts, getPublicOrigin()),
    })
  } catch (error) {
    console.error('[promo-page-settings] clicks failed', error)
    return NextResponse.json({ success: false, error: 'โหลดสถิติคลิกไม่สำเร็จ' }, { status: 500 })
  }
}
