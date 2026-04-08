'use client'

import { InboxLayout } from '@/components/layout/InboxLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Megaphone, ArrowLeft, Construction, Calendar, Target, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default function CampaignsPage() {
  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center gap-4 mb-6">
            <Button asChild variant="ghost" size="icon">
              <Link href="/inbox/broadcasts">
                <ArrowLeft className="w-5 h-5" />
              </Link>
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Broadcast Campaigns</h1>
              <p className="text-sm text-muted-foreground mt-1">
                จัดการแคมเปญ broadcast หลายข้อความ
              </p>
            </div>
          </div>

          {/* Coming Soon Card */}
          <Card className="border-dashed">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                <Construction className="w-12 h-12 text-primary" />
              </div>
              <CardTitle className="text-2xl">กำลังพัฒนา</CardTitle>
              <CardDescription className="text-base mt-2">
                ระบบ Campaigns จะเปิดให้ใช้งานเร็วๆ นี้
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground text-center">
                  ฟีเจอร์ที่กำลังจะเปิดตัว:
                </p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <Megaphone className="w-4 h-4 text-primary" />
                    <span>สร้างแคมเปญ broadcast หลายข้อความ</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-primary" />
                    <span>ตั้งเวลาส่งอัตโนมัติตามช่วงเวลา</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-primary" />
                    <span>กำหนดกลุ่มเป้าหมายแบบละเอียด</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    <span>วิเคราะห์ผลลัพธ์แบบครบวงจร</span>
                  </li>
                </ul>
              </div>

              <div className="flex justify-center">
                <Button asChild variant="outline">
                  <Link href="/inbox/broadcasts">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    กลับไปหน้า Broadcast
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </InboxLayout>
  )
}
