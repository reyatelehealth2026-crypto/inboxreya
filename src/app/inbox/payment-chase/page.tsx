import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PaymentChaseQueue } from '@/components/payment-chase/PaymentChaseQueue'

export const metadata = {
  title: 'ติดตามยอดชำระ — Inbox',
  description: 'บิลที่ยังไม่ชำระ ค้าง 2 / 4 / 7 วัน — ติ๊กเลือกแล้วส่งทีเดียว',
}

// No layout wrapper here: src/app/inbox/layout.tsx already renders the sidebar
// for every /inbox route, and wrapping again nests a second one.
export default async function PaymentChasePage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  return <PaymentChaseQueue />
}
