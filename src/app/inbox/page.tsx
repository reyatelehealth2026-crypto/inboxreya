import { Suspense } from 'react'
import InboxPageClient from './InboxPageClient'

export default function InboxPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      }
    >
      <InboxPageClient />
    </Suspense>
  )
}
