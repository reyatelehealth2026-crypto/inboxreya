import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import {
  getPromoPageSettings,
  mergePromoPageSettings,
  promoPageSettingsSchema,
} from '@/lib/promo-page-settings'
import type { Prisma } from '@prisma/client'

// /promo is one public page served from the default LINE account, so its settings
// live there — not on whichever account the editing user happens to belong to.
function defaultAccount() {
  return prisma.lineAccount.findFirst({
    where: { isDefault: true },
    select: { id: true, settings: true },
  })
}

// GET /api/inbox/promo-page-settings - display settings for the public /promo page
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) {
      return authResult
    }

    const account = await defaultAccount()

    return NextResponse.json({ success: true, data: getPromoPageSettings(account) })
  } catch (error) {
    console.error('[promo-page-settings] GET failed', error)
    return NextResponse.json({ success: false, error: 'โหลดการตั้งค่าไม่สำเร็จ' }, { status: 500 })
  }
}

// PUT /api/inbox/promo-page-settings - replace the promoPage key, other settings intact
export async function PUT(req: NextRequest) {
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

    const account = await defaultAccount()
    if (!account) {
      return NextResponse.json({ success: false, error: 'ไม่พบบัญชี LINE หลัก' }, { status: 404 })
    }

    const settings = mergePromoPageSettings(account.settings, parsed.data)
    await prisma.lineAccount.update({
      where: { id: account.id },
      data: { settings: settings as Prisma.InputJsonValue },
    })

    return NextResponse.json({ success: true, data: parsed.data })
  } catch (error) {
    console.error('[promo-page-settings] PUT failed', error)
    return NextResponse.json({ success: false, error: 'บันทึกการตั้งค่าไม่สำเร็จ' }, { status: 500 })
  }
}
