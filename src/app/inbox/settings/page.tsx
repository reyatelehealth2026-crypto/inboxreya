'use client'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GeneralSettings } from '@/components/inbox/GeneralSettings'
import { ShortcutsSettings } from '@/components/inbox/ShortcutsSettings'
import { TextExpansionSettings } from '@/components/inbox/TextExpansionSettings'
import { AccessibilitySettings } from '@/components/inbox/AccessibilitySettings'
import { NotificationSettings } from '@/components/inbox/NotificationSettings'
import { DataPrivacySettings } from '@/components/inbox/DataPrivacySettings'
import { Settings, Keyboard, Zap, Eye, Bell, Shield } from 'lucide-react'

export default function SettingsPage() {
  return (
    <div className="h-screen overflow-auto bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800">
      <div className="container mx-auto py-8 px-4 max-w-7xl">
        {/* Enhanced Header */}
        <div className="mb-8 bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl shadow-lg">
              <Settings className="h-8 w-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                ตั้งค่าอินบ็อกซ์
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                ปรับแต่งประสบการณ์การใช้งานให้ตรงกับความต้องการของคุณ
              </p>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="general" className="space-y-6">
          <div className="sticky top-0 z-10 bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-900 dark:to-gray-800 pb-4">
            <TabsList className="grid w-full grid-cols-2 md:grid-cols-3 lg:grid-cols-6 bg-white dark:bg-gray-800 shadow-md border border-gray-200 dark:border-gray-700 p-1.5 rounded-xl">
              <TabsTrigger value="general" className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Settings className="h-4 w-4" />
                <span className="hidden sm:inline">ทั่วไป</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Bell className="h-4 w-4" />
                <span className="hidden sm:inline">การแจ้งเตือน</span>
              </TabsTrigger>
              <TabsTrigger value="shortcuts" className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Keyboard className="h-4 w-4" />
                <span className="hidden sm:inline">คีย์ลัด</span>
              </TabsTrigger>
              <TabsTrigger value="expansion" className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Zap className="h-4 w-4" />
                <span className="hidden sm:inline">ข้อความอัตโนมัติ</span>
              </TabsTrigger>
              <TabsTrigger value="accessibility" className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Eye className="h-4 w-4" />
                <span className="hidden sm:inline">การเข้าถึง</span>
              </TabsTrigger>
              <TabsTrigger value="data" className="gap-2 data-[state=active]:bg-gradient-to-br data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">ข้อมูล & ความเป็นส่วนตัว</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="general" className="space-y-6">
            <GeneralSettings />
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <NotificationSettings />
          </TabsContent>

          <TabsContent value="shortcuts" className="space-y-6">
            <ShortcutsSettings />
          </TabsContent>

          <TabsContent value="expansion" className="space-y-6">
            <TextExpansionSettings />
          </TabsContent>

          <TabsContent value="accessibility" className="space-y-6">
            <AccessibilitySettings />
          </TabsContent>

          <TabsContent value="data" className="space-y-6">
            <DataPrivacySettings />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
