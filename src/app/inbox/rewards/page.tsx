import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { RewardsAdmin } from '@/components/rewards/RewardsAdmin'

export const metadata = {
  title: 'รางวัลแลกแต้ม — Inbox',
  description: 'เพิ่ม/แก้ของรางวัล และอนุมัติคำขอแลกแต้ม — ช่องทางเดียวกับหน้า membership บน PHP',
}

// src/app/inbox/layout.tsx already renders the sidebar for every /inbox route.
export default async function RewardsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  return <RewardsAdmin />
}
