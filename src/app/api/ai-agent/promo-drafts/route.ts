import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

function parseDraft(row: any) {
  return {
    ...row,
    proposedScheduledAt: row.proposedScheduledAt?.toISOString?.() || null,
    approvedAt: row.approvedAt?.toISOString?.() || null,
    createdAt: row.createdAt?.toISOString?.() || null,
    updatedAt: row.updatedAt?.toISOString?.() || null,
  }
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || undefined

    const drafts = await prisma.aiPromoDraft.findMany({
      where: {
        lineAccountId: user.lineAccountId as number,
        ...(status ? { status } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    return NextResponse.json({ success: true, data: drafts.map(parseDraft) })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to load promo drafts'
    return NextResponse.json({ success: false, error: message }, { status: 500 })
  }
}

