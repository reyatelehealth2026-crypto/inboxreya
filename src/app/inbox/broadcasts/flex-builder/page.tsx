'use client'

import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Button } from '@/components/ui/button'
import { FlexBuilderWorkspace } from '@/components/broadcasts/FlexBuilderWorkspace'

export default function FlexBuilderPage() {
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
              <h1 className="text-2xl font-bold">Flex Builder</h1>
              <p className="text-sm text-muted-foreground mt-1">
                visual builder ขั้นต้นสำหรับ Flex Message พร้อม preview, raw JSON และ save เป็น template
              </p>
            </div>
          </div>

          <FlexBuilderWorkspace />
        </div>
      </div>
    </InboxLayout>
  )
}
