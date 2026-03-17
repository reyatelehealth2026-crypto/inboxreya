import { auth } from '@/lib/auth'
import { redirect } from 'next/navigation'
import { SlipCenterClient } from '@/components/slip-center/SlipCenterClient'

export default async function SlipCenterPage() {
  const session = await auth()
  if (!session?.user) {
    redirect('/auth/login')
  }

  return <SlipCenterClient />
}
