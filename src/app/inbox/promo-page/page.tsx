import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { PromoPageSettingsForm } from '@/components/promo-page/PromoPageSettingsForm'

export const metadata = {
  title: 'หน้ารวมโปร — Inbox',
  description: 'ตั้งค่าการแสดงผลของหน้า /promo ที่ลูกค้าเห็นเมื่อกดจาก imagemap broadcast',
}

// src/app/inbox/layout.tsx already renders the sidebar for every /inbox route.
export default async function PromoPageSettingsPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  return <PromoPageSettingsForm />
}
