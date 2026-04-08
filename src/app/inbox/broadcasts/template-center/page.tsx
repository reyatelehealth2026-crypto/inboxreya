'use client'

import Link from 'next/link'
import { ArrowLeft, Boxes, Construction, FileText, ImageIcon, LayoutTemplate } from 'lucide-react'
import { InboxLayout } from '@/components/layout/InboxLayout'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'

export default function TemplateCenterPage() {
  return (
    <InboxLayout>
      <div className="h-full overflow-auto p-6">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <Link href="/inbox/broadcasts">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="w-5 h-5" />
              </Button>
            </Link>
            <div>
              <h1 className="text-2xl font-bold">Template Center</h1>
              <p className="text-sm text-muted-foreground mt-1">
                พื้นที่รวม template สำหรับ broadcast โดยเฉพาะ แยกจาก quick reply เดิม
              </p>
            </div>
          </div>

          <Card className="border-dashed">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                <Construction className="w-12 h-12 text-primary" />
              </div>
              <CardTitle className="text-2xl">กำลังวางโครง Template Center</CardTitle>
              <CardDescription className="text-base mt-2">
                หน้า scaffold นี้เตรียมไว้สำหรับระบบ template กลางของ broadcast
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg bg-muted/50 p-4">
                <p className="text-sm text-muted-foreground text-center">สิ่งที่จะรองรับในเฟสถัดไป:</p>
                <ul className="mt-3 space-y-2 text-sm">
                  <li className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-primary" />
                    <span>Text template พร้อม variables และ preview</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <ImageIcon className="w-4 h-4 text-primary" />
                    <span>Image / media template สำหรับ broadcast</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <LayoutTemplate className="w-4 h-4 text-primary" />
                    <span>Flex template พร้อม thumbnail และ reusable blocks</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <Boxes className="w-4 h-4 text-primary" />
                    <span>Duplicate / archive / publish workflow</span>
                  </li>
                </ul>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link href="/inbox/broadcasts">
                  <Button variant="outline">
                    <ArrowLeft className="w-4 h-4 mr-2" />
                    กลับไปหน้า Broadcast
                  </Button>
                </Link>
                <Link href="/inbox/templates">
                  <Button variant="secondary">
                    เปิดหน้า Quick Reply เดิม
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </InboxLayout>
  )
}
