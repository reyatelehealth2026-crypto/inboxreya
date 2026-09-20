import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-middleware'
import { promoPageSettingsSchema } from '@/lib/promo-page-settings'
import { signPreview } from '@/lib/promo-preview'

// POST /api/inbox/promo-page-settings/preview - a signed /promo token that renders these
// unsaved settings, so the admin page can show a live preview before "บันทึก".
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const body = await req.json().catch(() => null)
    const parsed = promoPageSettingsSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'ข้อมูลไม่ถูกต้อง', issues: parsed.error.issues },
        { status: 400 }
      )
    }

    const token = signPreview(parsed.data)
    if (!token) {
      return NextResponse.json({ success: false, error: 'ยังไม่ได้ตั้งค่า NEXTAUTH_SECRET' }, { status: 503 })
    }

    return NextResponse.json({ success: true, token })
  } catch (error) {
    console.error('[promo-page-settings] preview failed', error)
    return NextResponse.json({ success: false, error: 'สร้างตัวอย่างไม่สำเร็จ' }, { status: 500 })
  }
}
