'use client'

import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'

interface Admin {
  id: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role?: string | null
}

interface AssigneeAvatarsProps {
  assignees: Admin[]
  maxDisplay?: number
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function AssigneeAvatars({
  assignees,
  maxDisplay = 3,
  size = 'sm',
  className,
}: AssigneeAvatarsProps) {
  if (assignees.length === 0) {
    return null
  }

  const displayedAssignees = assignees.slice(0, maxDisplay)
  const remainingCount = assignees.length - maxDisplay

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2)
  }

  const sizeClasses = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-10 w-10 text-sm',
  }

  const avatarSize = sizeClasses[size]

  return (
    <TooltipProvider>
      <div className={cn('flex items-center -space-x-2', className)}>
        {displayedAssignees.map((assignee, index) => (
          <Tooltip key={assignee.id}>
            <TooltipTrigger asChild>
              <Avatar
                className={cn(
                  avatarSize,
                  'border-2 border-background ring-1 ring-border',
                  'hover:z-10 transition-transform hover:scale-110'
                )}
                style={{ zIndex: displayedAssignees.length - index }}
              >
                <AvatarImage src={assignee.avatarUrl || undefined} />
                <AvatarFallback className={avatarSize}>
                  {getInitials(assignee.displayName || assignee.username)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm">
                <div className="font-medium">
                  {assignee.displayName || assignee.username}
                </div>
                {assignee.role && (
                  <div className="text-xs text-muted-foreground">
                    {assignee.role}
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        ))}

        {remainingCount > 0 && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div
                className={cn(
                  avatarSize,
                  'flex items-center justify-center rounded-full',
                  'border-2 border-background ring-1 ring-border',
                  'bg-muted text-muted-foreground font-medium',
                  'hover:z-10 transition-transform hover:scale-110 cursor-default'
                )}
              >
                +{remainingCount}
              </div>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-sm space-y-1">
                {assignees.slice(maxDisplay).map((assignee) => (
                  <div key={assignee.id}>
                    {assignee.displayName || assignee.username}
                  </div>
                ))}
              </div>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  )
}
