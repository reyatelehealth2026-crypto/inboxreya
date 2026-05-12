"use client"

import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Clock,
  RefreshCw,
  Reply,
  ShoppingBag,
  Tag,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  useActionSuggest,
  type SuggestedAction,
} from '@/hooks/use-action-suggest'

export interface ActionSuggestCardProps {
  userId: number | null
  onAction?: (action: SuggestedAction) => void
  className?: string
}

const PRIORITY_STYLES: Record<1 | 2 | 3, string> = {
  1: 'bg-red-100 text-red-700 border-red-200',
  2: 'bg-amber-100 text-amber-700 border-amber-200',
  3: 'bg-blue-100 text-blue-700 border-blue-200',
}

const TYPE_ICONS: Record<SuggestedAction['type'], typeof Reply> = {
  reply: Reply,
  price_list: Tag,
  follow_up: Clock,
  order_check: ShoppingBag,
  escalate: AlertCircle,
}

export function ActionSuggestCard({
  userId,
  onAction,
  className,
}: ActionSuggestCardProps) {
  const queryClient = useQueryClient()
  const query = useActionSuggest(userId)

  if (userId == null) return null

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai', 'suggest', userId] })
  }

  return (
    <aside
      className={cn(
        'rounded-lg border bg-card p-3 text-sm space-y-2',
        className,
      )}
    >
      <div className="flex items-center justify-between">
        <div className="font-medium">🎯 ขั้นต่อไป</div>
        <button
          type="button"
          onClick={handleRefresh}
          className="p-1 rounded hover:bg-muted text-muted-foreground"
          aria-label="รีเฟรชคำแนะนำ"
        >
          <RefreshCw
            className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')}
          />
        </button>
      </div>

      {query.isLoading && (
        <div className="space-y-1.5">
          <div className="h-8 rounded bg-muted animate-pulse" />
          <div className="h-8 rounded bg-muted animate-pulse" />
          <div className="h-8 rounded bg-muted animate-pulse" />
        </div>
      )}

      {query.isError && !query.isLoading && (
        <div className="space-y-1.5">
          <div className="p-2 rounded-md bg-red-50 border border-red-200 text-red-700 text-xs">
            {query.error instanceof Error ? query.error.message : 'ดึงคำแนะนำไม่ได้'}
          </div>
          <button
            type="button"
            onClick={() => query.refetch()}
            className="text-xs px-2 py-1 rounded border hover:bg-muted"
          >
            ลองอีกครั้ง
          </button>
        </div>
      )}

      {query.data && !query.isLoading && !query.isError && (
        <TooltipProvider delayDuration={200}>
          <ul className="space-y-1.5">
            {query.data.actions.map((action, idx) => {
              const Icon = TYPE_ICONS[action.type]
              return (
                <li key={idx}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <button
                        type="button"
                        onClick={() => onAction?.(action)}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md border hover:bg-muted text-left"
                      >
                        <span
                          className={cn(
                            'shrink-0 inline-flex items-center justify-center text-[10px] font-semibold w-6 h-5 rounded border',
                            PRIORITY_STYLES[action.priority],
                          )}
                        >
                          P{action.priority}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block font-medium truncate">
                            {action.label}
                          </span>
                          <span className="block text-xs text-muted-foreground truncate">
                            {action.reason}
                          </span>
                        </span>
                        <Icon className="shrink-0 h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="left" className="max-w-xs">
                      <div className="text-xs font-medium mb-0.5">ทำไม?</div>
                      <div className="text-xs">{action.reason}</div>
                    </TooltipContent>
                  </Tooltip>
                </li>
              )
            })}
          </ul>
          {query.data.degraded.length > 0 && (
            <div className="inline-block text-[10px] px-1.5 py-0.5 rounded bg-amber-50 border border-amber-200 text-amber-800">
              บริบทบางส่วนไม่พร้อม
            </div>
          )}
        </TooltipProvider>
      )}
    </aside>
  )
}
