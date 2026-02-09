'use client'

import { useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import { QuickReplyTemplates } from '@/components/inbox/QuickReplyTemplates'

export default function TemplatesPage() {
  const { data: session, status } = useSession()
  const router = useRouter()

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.push('/auth/login')
    }
  }, [status, router])

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!session) {
    return null
  }

  return (
    <div className="h-screen overflow-auto">
      <div className="container mx-auto py-6">
        <QuickReplyTemplates />
      </div>
    </div>
  )
}
