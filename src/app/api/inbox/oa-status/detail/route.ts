/**
 * GET /api/inbox/oa-status/detail
 * Insight เชิงลึก (แนวโน้มเพื่อน 7 วัน + ข้อความที่ส่งแยกประเภท) และรายการ Audience
 * แยกจาก /api/inbox/oa-status เพราะยิง LINE หลายครั้ง — โหลดตอนเปิดแท็บเท่านั้น
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'
import { getOaDetail } from '@/lib/line-api'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user: sessionUser } = authResult
    const lineAccountId = sessionUser.lineAccountId ?? null

    const detail = await cacheQuery(
      `oa-status-detail:${lineAccountId ?? 'default'}`,
      () => getOaDetail(lineAccountId),
      CACHE_TTL.ANALYTICS
    )

    return NextResponse.json({ success: true, data: detail })
  } catch (error) {
    logger.error(error, { scope: 'api:inbox/oa-status/detail' })
    return NextResponse.json(
      { success: false, error: 'ดึงข้อมูล Insight/Audience ไม่สำเร็จ' },
      { status: 500 }
    )
  }
}
