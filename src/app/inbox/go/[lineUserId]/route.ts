// Deep link จากระบบอื่นที่รู้แค่ LINE userId (เช่นหลังบ้านขายส่ง cny-wholesale-nuxt)
//
//   /inbox/go/U8f3ca91d  →  /inbox?userId=1042
//
// ต้องแปลงเพราะหน้า /inbox รับ ?userId= เป็น users.id ไม่ใช่สตริงของ LINE
// อยู่ใต้ /inbox/ ไม่ใช่ /api/ เพื่อให้ middleware พาไปหน้าล็อกอินแทนการตอบ 401 JSON
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(
  request: Request,
  { params }: { params: Promise<{ lineUserId: string }> }
) {
  const { lineUserId } = await params
  const requestUrl = new URL(request.url)

  const session = await auth()
  if (!session?.user) {
    const login = new URL('/auth/login', requestUrl)
    login.searchParams.set('callbackUrl', requestUrl.pathname)
    return NextResponse.redirect(login)
  }

  const lineAccountId = session.user.lineAccountId

  const user = await prisma.lineUser.findFirst({
    // LINE userId เดียวกันอยู่ได้หลาย OA (schema: @@unique([lineAccountId, lineUserId]))
    // จึงจำกัดด้วย OA ของแอดมินที่ล็อกอิน ไม่งั้นอาจเปิดบทสนทนาข้าม OA
    where: lineAccountId
      ? { lineUserId, lineAccountId }
      : { lineUserId },
    select: { id: true },
  })

  const target = new URL('/inbox', requestUrl)
  if (user) target.searchParams.set('userId', String(user.id))
  else target.searchParams.set('missing', lineUserId)

  return NextResponse.redirect(target)
}
