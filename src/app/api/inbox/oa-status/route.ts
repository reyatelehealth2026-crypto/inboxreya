/**
 * GET /api/inbox/oa-status
 * สรุปข้อมูลบัญชี LINE OA (read-only) สำหรับหน้า /oa-status
 * cache 5 นาที — LINE สรุป insight วันละครั้ง ไม่ต้องยิงถี่
 */
import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'
import { getOaSnapshot } from '@/lib/line-api'
import { logger } from '@/lib/logger'

export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }
    const { user: sessionUser } = authResult
    const lineAccountId = sessionUser.lineAccountId ?? null

    const snapshot = await cacheQuery(
      `oa-status:${lineAccountId ?? 'default'}`,
      () => getOaSnapshot(lineAccountId),
      CACHE_TTL.ANALYTICS
    )

    return NextResponse.json({ success: true, data: snapshot })
  } catch (error) {
    logger.error(error, { scope: 'api:inbox/oa-status' })
    return NextResponse.json(
      { success: false, error: 'ดึงข้อมูล OA ไม่สำเร็จ' },
      { status: 500 }
    )
  }
}
