'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Button } from '@/components/ui/button'
import { BroadcastTemplateCenter } from '@/components/broadcasts/BroadcastTemplateCenter'

export default function TemplateCenterPage() {
  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-6">
        <div className="mx-auto max-w-7xl space-y-6">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link href="/inbox/broadcasts">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Template Center</h1>
              <p className="text-sm text-muted-foreground mt-1">
                หน้าใช้งานจริงของ template library สำหรับ broadcast — ตอนนี้รองรับ list, filter, preview และ create flow ขั้นต้นแล้ว
              </p>
            </div>
          </div>

          <BroadcastTemplateCenter />
        </div>
      </div>
    </InboxLayout>
  )
}
