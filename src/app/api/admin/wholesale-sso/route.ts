/**
 * GET /api/admin/wholesale-sso
 *
 * พาแอดมินที่ล็อกอิน inbox อยู่แล้วข้ามไปหลังบ้านขายส่งโดยไม่ต้องล็อกอินซ้ำ
 * ปั้น token อายุ 60 วินาที แล้ว redirect ไป /admin/sso ของฝั่งโน้น ซึ่งจะแลก
 * เป็น admin token ของระบบตัวเองให้
 *
 * ฝั่งขายส่งสร้างบัญชีให้อัตโนมัติด้วยสิทธิ์ต่ำสุด (staff) ถ้ายังไม่เคยเข้า
 * การเลื่อนสิทธิ์เป็นเรื่องของ super_admin ฝั่งโน้น ไม่ใช่ role ที่ส่งไปจากที่นี่
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { signSSOToken } from '@/lib/ssoSign'

export async function GET(request: NextRequest) {
    const session = await auth()
    if (!session?.user?.id) {
        const login = new URL('/auth/login', request.url)
        login.searchParams.set('callbackUrl', '/api/admin/wholesale-sso')
        return NextResponse.redirect(login)
    }

    const base = (process.env.WHOLESALE_ADMIN_URL ?? '').trim().replace(/\/+$/, '')
    // กุญแจคนละดอกกับ SSO_SECRET_KEY ที่ระบบ PHP ใช้ยิงเข้ามาที่ /api/auth/sso
    // โดยตั้งใจ — ถ้าใช้ดอกเดียวกัน ระบบ PHP จะปั้น token เข้าหลังบ้านขายส่งได้ด้วย
    // ซึ่งไม่ใช่สิทธิ์ที่มันควรมี
    const secret = process.env.WHOLESALE_SSO_SECRET_KEY ?? ''

    // ตั้งค่าไม่ครบให้ตอบชัดๆ ดีกว่า redirect ไปที่ที่ไม่มีอยู่จริง
    if (!base || !/^https?:\/\//.test(base)) {
        return NextResponse.json(
            { error: 'ยังไม่ได้ตั้ง WHOLESALE_ADMIN_URL (ต้องขึ้นต้นด้วย http:// หรือ https://)' },
            { status: 500 }
        )
    }
    if (!secret) {
        return NextResponse.json({ error: 'ยังไม่ได้ตั้ง WHOLESALE_SSO_SECRET_KEY' }, { status: 500 })
    }

    const token = signSSOToken(
        {
            user_id: Number(session.user.id),
            username: session.user.name || String(session.user.id),
            email: session.user.email ?? undefined,
            role: session.user.role ?? undefined,
        },
        secret
    )

    return NextResponse.redirect(`${base}/admin/sso?token=${encodeURIComponent(token)}`)
}
