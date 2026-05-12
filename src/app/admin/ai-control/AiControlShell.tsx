'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PromptsTab } from './PromptsTab'
import { FlagsTab } from './FlagsTab'
import { UsageTab } from './UsageTab'

export function AiControlShell() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">ตั้งค่า AI</h1>
        <p className="text-sm text-muted-foreground">
          เปิดหรือปิดฟีเจอร์ AI, ปรับคำสั่งที่ใช้ตอบ, และดูการใช้งานล่าสุด
        </p>
      </header>

      <Tabs defaultValue="flags" className="w-full">
        <TabsList>
          <TabsTrigger value="flags">เปิดฟีเจอร์</TabsTrigger>
          <TabsTrigger value="prompts">คำสั่ง AI</TabsTrigger>
          <TabsTrigger value="usage">การใช้งาน</TabsTrigger>
        </TabsList>

        <TabsContent value="flags" className="pt-4">
          <FlagsTab />
        </TabsContent>
        <TabsContent value="prompts" className="pt-4">
          <PromptsTab />
        </TabsContent>
        <TabsContent value="usage" className="pt-4">
          <UsageTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
