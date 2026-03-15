'use client'

import { BroadcastList } from '@/components/broadcasts/BroadcastList'
import { InboxLayout } from '@/components/layout/InboxLayout'

export default function BroadcastsPage() {
  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold mb-6">Broadcast Messages</h1>
          <BroadcastList />
        </div>
      </div>
    </InboxLayout>
  )
}
