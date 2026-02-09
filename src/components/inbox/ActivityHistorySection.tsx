"use client"

import { Clock, Tag, User, Edit, Trash2, Plus, RefreshCw } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Button } from '@/components/ui/button'
import { useActivityHistory } from '@/hooks/use-activity-history'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'
import type { ActivityLog } from '@/types'

interface ActivityHistorySectionProps {
  userId: string
}

// Action icons and colors
const actionConfig: Record<string, { icon: typeof Edit; color: string; bgColor: string }> = {
  create: { icon: Plus, color: 'text-green-600', bgColor: 'bg-green-100' },
  update: { icon: Edit, color: 'text-blue-600', bgColor: 'bg-blue-100' },
  delete: { icon: Trash2, color: 'text-red-600', bgColor: 'bg-red-100' },
  default: { icon: Clock, color: 'text-gray-600', bgColor: 'bg-gray-100' },
}

// Thai labels for actions
const actionLabels: Record<string, string> = {
  create: 'สร้าง',
  update: 'แก้ไข',
  delete: 'ลบ',
  login: 'เข้าสู่ระบบ',
  logout: 'ออกจากระบบ',
  export: 'ส่งออก',
  send: 'ส่ง',
  approve: 'อนุมัติ',
  reject: 'ปฏิเสธ',
}

// Thai labels for entity types
const entityLabels: Record<string, string> = {
  tag: 'แท็ก',
  user: 'ข้อมูลลูกค้า',
  user_profile: 'โปรไฟล์',
  points: 'แต้ม',
  order: 'คำสั่งซื้อ',
  note: 'โน้ต',
}

function ActivityItem({ activity }: { activity: ActivityLog }) {
  const config = actionConfig[activity.action] || actionConfig.default
  const Icon = config.icon

  return (
    <div className="flex gap-3 py-2 border-b border-gray-100 last:border-0">
      <div className={cn('w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0', config.bgColor)}>
        <Icon className={cn('h-3.5 w-3.5', config.color)} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-800 leading-snug">
              {activity.description || `${actionLabels[activity.action] || activity.action} ${entityLabels[activity.entityType || ''] || activity.entityType || ''}`}
            </p>
            {activity.adminName && (
              <p className="text-xs text-gray-500 mt-0.5">
                โดย {activity.adminName}
              </p>
            )}
          </div>
          <Badge variant="outline" className="text-[10px] h-5 flex-shrink-0">
            {actionLabels[activity.action] || activity.action}
          </Badge>
        </div>

        {/* Show old/new values for updates */}
        {activity.action === 'update' && (activity.oldValue || activity.newValue) && (
          <div className="mt-1.5 text-xs bg-gray-50 rounded p-2 space-y-1">
            {activity.oldValue && (
              <div className="flex items-start gap-2">
                <span className="text-gray-500 flex-shrink-0">เดิม:</span>
                <span className="text-gray-600 break-all">
                  {typeof activity.oldValue === 'object'
                    ? Object.entries(activity.oldValue).map(([k, v]) => `${k}: ${v}`).join(', ')
                    : String(activity.oldValue)
                  }
                </span>
              </div>
            )}
            {activity.newValue && (
              <div className="flex items-start gap-2">
                <span className="text-green-500 flex-shrink-0">ใหม่:</span>
                <span className="text-gray-800 break-all">
                  {typeof activity.newValue === 'object'
                    ? Object.entries(activity.newValue).map(([k, v]) => `${k}: ${v}`).join(', ')
                    : String(activity.newValue)
                  }
                </span>
              </div>
            )}
          </div>
        )}

        <p className="text-[10px] text-gray-500 mt-1">
          {formatDate(activity.createdAt)}
        </p>
      </div>
    </div>
  )
}

export function ActivityHistorySection({ userId }: ActivityHistorySectionProps) {
  const { data: activities, isLoading, refetch, isRefetching } = useActivityHistory(userId)

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex gap-3">
            <Skeleton className="w-7 h-7 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (!activities || activities.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
        <p className="text-sm">ยังไม่มีประวัติการแก้ไข</p>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-gray-500">{activities.length} รายการ</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          <RefreshCw className={cn('h-3 w-3', isRefetching && 'animate-spin')} />
        </Button>
      </div>
      <ScrollArea className="h-64">
        <div className="pr-4">
          {activities.map((activity) => (
            <ActivityItem key={activity.id} activity={activity} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
