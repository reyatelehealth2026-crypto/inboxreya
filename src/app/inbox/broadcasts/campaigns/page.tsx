'use client'

import Link from 'next/link'
import { ArrowLeft, Megaphone } from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Button } from '@/components/ui/button'
import { CampaignStats } from '@/components/broadcasts/campaigns/CampaignStats'
import { CampaignList } from '@/components/broadcasts/campaigns/CampaignList'

export default function CampaignsPage() {
  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-4 sm:p-6">
        <div className="mx-auto max-w-6xl space-y-6">
          {/* Header */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <Button asChild variant="ghost" size="icon">
                <Link href="/inbox/broadcasts">
                  <ArrowLeft className="h-5 w-5" />
                </Link>
              </Button>
              <div className="flex items-start gap-3">
                <div className="hidden h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary sm:flex">
                  <Megaphone className="h-5 w-5" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold">Broadcast Campaigns</h1>
                  <p className="text-sm text-muted-foreground">
                    จัดการแคมเปญ broadcast หลายข้อความ พร้อม target, schedule และ analytics
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <CampaignStats />

          {/* List + Filters + Create + Detail */}
          <CampaignList />
        </div>
      </div>
    </InboxLayout>
  )
}
