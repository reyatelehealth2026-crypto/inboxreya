import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { AiControlShell } from './AiControlShell'

export const dynamic = 'force-dynamic'

export default async function AiControlPage() {
  const session = await auth()
  if (!session?.user) redirect('/auth/login')
  const role = session.user.role
  if (role !== 'admin' && role !== 'super_admin') redirect('/inbox')
  return <AiControlShell />
}
