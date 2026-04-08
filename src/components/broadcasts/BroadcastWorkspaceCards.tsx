'use client'

import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { 
  Megaphone, 
  FileText, 
  Layout, 
  ArrowRight,
  Sparkles
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface WorkspaceCardProps {
  title: string
  description: string
  icon: React.ReactNode
  href?: string
  onClick?: () => void
  badge?: string
  disabled?: boolean
  className?: string
}

function WorkspaceCard({ 
  title, 
  description, 
  icon, 
  href, 
  onClick, 
  badge,
  disabled = false,
  className 
}: WorkspaceCardProps) {
  const content = (
    <Card className={cn(
      "group relative overflow-hidden transition-all hover:shadow-lg",
      disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer hover:border-primary/50",
      className
    )}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 text-primary">
              {icon}
            </div>
            <div className="flex-1">
              <CardTitle className="text-lg flex items-center gap-2">
                {title}
                {badge && (
                  <span className="text-xs bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 px-2 py-0.5 rounded-full">
                    {badge}
                  </span>
                )}
              </CardTitle>
            </div>
          </div>
          {!disabled && (
            <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          )}
        </div>
      </CardHeader>
      <CardContent>
        <CardDescription className="text-sm">
          {description}
        </CardDescription>
      </CardContent>
    </Card>
  )

  if (disabled) {
    return content
  }

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  if (onClick) {
    return (
      <div onClick={onClick} role="button" tabIndex={0}>
        {content}
      </div>
    )
  }

  return content
}

export function BroadcastWorkspaceCards() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="w-5 h-5 text-primary" />
        <h2 className="text-lg font-semibold">Broadcast Workspace</h2>
      </div>

      {/* Workspace Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Broadcast Campaigns */}
        <WorkspaceCard
          title="Campaigns"
          description="ศูนย์ควบคุมแคมเปญ broadcast หลายข้อความ พร้อม target, schedule และ analytics"
          icon={<Megaphone className="w-5 h-5" />}
          href="/inbox/broadcasts/campaigns"
          badge="scaffold"
        />

        {/* Template Center */}
        <WorkspaceCard
          title="Template Center"
          description="ศูนย์รวม template สำหรับ text, image และ flex แยกจาก quick reply เดิม"
          icon={<FileText className="w-5 h-5" />}
          href="/inbox/broadcasts/template-center"
          badge="scaffold"
        />

        {/* Flex Builder */}
        <WorkspaceCard
          title="Flex Builder"
          description="พื้นที่สำหรับ visual builder, preview แบบ LINE และ advanced JSON mode"
          icon={<Layout className="w-5 h-5" />}
          href="/inbox/broadcasts/flex-builder"
          badge="scaffold"
        />
      </div>

      {/* Quick Stats or Info */}
      <div className="rounded-lg border bg-muted/50 p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400">
            <Megaphone className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium mb-1">เคล็ดลับ</p>
            <p className="text-xs text-muted-foreground">
              ตอนนี้หน้า workspace นี้ใช้เป็นจุดรวมทางเข้าและ roadmap ก่อน ส่วน quick reply เดิมยังอยู่ได้ตามปกติ
              และจะค่อย ๆ แยก Broadcast Campaigns / Template Center / Flex Builder ออกเป็นระบบเดียวกัน
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
