import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SlipReportClient } from '@/components/inbox/SlipReportClient'

export const metadata = {
  title: 'สรุปสลิปที่ตรวจแล้ว — Inbox',
  description: 'สลิปที่ยืนยันกับธนาคารผ่าน พร้อม BDO ที่จับคู่และแต้มที่ให้ลูกค้า',
}

export default async function SlipReportPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  return <SlipReportClient />
}
