'use client'

import { BroadcastList } from '@/components/broadcasts/BroadcastList'
import { BroadcastWorkspaceCards } from '@/components/broadcasts/BroadcastWorkspaceCards'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Separator } from '@/components/ui/separator'

export default function BroadcastsPage() {
  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          {/* Page Header */}
          <div>
            <h1 className="text-2xl font-bold">Broadcast Center</h1>
            <p className="text-sm text-muted-foreground mt-1">
              ส่งข้อความถึงลูกค้าหลายคนพร้อมกัน ตั้งเวลา และติดตามผล
            </p>
          </div>

          {/* Workspace Cards */}
          <BroadcastWorkspaceCards />

          {/* Separator */}
          <Separator className="my-8" />

          {/* Current Broadcast List */}
          <div>
            <h2 className="text-xl font-semibold mb-4">Broadcast Messages</h2>
            <BroadcastList />
          </div>
        </div>
      </div>
    </InboxLayout>
  )
}
