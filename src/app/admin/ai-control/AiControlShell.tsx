'use client'

import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { PromptsTab } from './PromptsTab'
import { FlagsTab } from './FlagsTab'
import { UsageTab } from './UsageTab'

export function AiControlShell() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">AI Control</h1>
        <p className="text-sm text-muted-foreground">
          Manage prompts, feature flags, and inspect AI usage telemetry.
        </p>
      </header>

      <Tabs defaultValue="prompts" className="w-full">
        <TabsList>
          <TabsTrigger value="prompts">Prompts</TabsTrigger>
          <TabsTrigger value="flags">Flags</TabsTrigger>
          <TabsTrigger value="usage">Usage</TabsTrigger>
        </TabsList>

        <TabsContent value="prompts" className="pt-4">
          <PromptsTab />
        </TabsContent>
        <TabsContent value="flags" className="pt-4">
          <FlagsTab />
        </TabsContent>
        <TabsContent value="usage" className="pt-4">
          <UsageTab />
        </TabsContent>
      </Tabs>
    </div>
  )
}
