'use client'

import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

interface ConversationStatusBadgeProps {
  status: string
  className?: string
}

const statusConfig = {
  new: {
    label: 'New',
    variant: 'default' as const,
    className: 'bg-blue-500 hover:bg-blue-600 text-white',
  },
  in_progress: {
    label: 'In Progress',
    variant: 'secondary' as const,
    className: 'bg-yellow-500 hover:bg-yellow-600 text-white',
  },
  waiting: {
    label: 'Waiting',
    variant: 'outline' as const,
    className: 'bg-orange-500 hover:bg-orange-600 text-white border-orange-600',
  },
  resolved: {
    label: 'Resolved',
    variant: 'secondary' as const,
    className: 'bg-green-500 hover:bg-green-600 text-white',
  },
  active: {
    label: 'Active',
    variant: 'default' as const,
    className: 'bg-gray-500 hover:bg-gray-600 text-white',
  },
}

export function ConversationStatusBadge({ status, className }: ConversationStatusBadgeProps) {
  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.active

  return (
    <Badge
      variant={config.variant}
      className={cn(config.className, 'text-xs font-medium', className)}
    >
      {config.label}
    </Badge>
  )
}
