"use client"

import { useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Clock,
  RefreshCw,
  Reply,
  ShoppingBag,
  Tag,
  Target,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
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
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const query = useActionSuggest(userId, { enabled: open })

  if (userId == null) return null

  const handleRefresh = () => {
    queryClient.invalidateQueries({ queryKey: ['ai', 'suggest', userId] })
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={cn('gap-1.5 whitespace-nowrap', className)}
        >
          <Target className="h-4 w-4" />
          ขั้นตอนถัดไป
        </Button>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        side="top"
        sideOffset={8}
        className="w-[min(32rem,calc(100vw-1.5rem))] p-0"
      >
        <aside className="overflow-hidden rounded-md bg-card text-sm">
          <div className="flex items-center justify-between gap-3 border-b px-3 py-2.5">
            <div className="flex min-w-0 items-center gap-2">
              <Target className="h-4 w-4 shrink-0 text-primary" />
              <div className="truncate font-medium">ขั้นตอนถัดไป</div>
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
              aria-label="รีเฟรชคำแนะนำ"
            >
              <RefreshCw
                className={cn('h-3.5 w-3.5', query.isFetching && 'animate-spin')}
              />
            </button>
          </div>

          <div className="max-h-[min(24rem,55vh)] space-y-2 overflow-y-auto p-3">
            {query.isLoading && (
              <div className="space-y-1.5">
                <div className="h-8 rounded bg-muted animate-pulse" />
                <div className="h-8 rounded bg-muted animate-pulse" />
                <div className="h-8 rounded bg-muted animate-pulse" />
              </div>
            )}

            {query.isError && !query.isLoading && (
              <div className="space-y-1.5">
                <div className="rounded-md border border-red-200 bg-red-50 p-2 text-xs text-red-700">
                  {query.error instanceof Error ? query.error.message : 'ดึงคำแนะนำไม่ได้'}
                </div>
                <button
                  type="button"
                  onClick={() => query.refetch()}
                  className="rounded border px-2 py-1 text-xs hover:bg-muted"
                >
                  ลองอีกครั้ง
                </button>
              </div>
            )}

            {query.data && !query.isLoading && !query.isError && (
              <TooltipProvider delayDuration={200}>
                {query.data.actions.length > 0 ? (
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
                                className="flex w-full items-center gap-2 rounded-md border px-2 py-1.5 text-left hover:bg-muted"
                              >
                                <span
                                  className={cn(
                                    'inline-flex h-5 w-6 shrink-0 items-center justify-center rounded border text-[10px] font-semibold',
                                    PRIORITY_STYLES[action.priority],
                                  )}
                                >
                                  P{action.priority}
                                </span>
                                <span className="min-w-0 flex-1">
                                  <span className="block truncate font-medium">
                                    {action.label}
                                  </span>
                                  <span className="block truncate text-xs text-muted-foreground">
                                    {action.reason}
                                  </span>
                                </span>
                                <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                              </button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <div className="mb-0.5 text-xs font-medium">ทำไม?</div>
                              <div className="text-xs">{action.reason}</div>
                            </TooltipContent>
                          </Tooltip>
                        </li>
                      )
                    })}
                  </ul>
                ) : (
                  <div className="rounded-md border border-dashed px-3 py-4 text-center text-xs text-muted-foreground">
                    ยังไม่มีคำแนะนำเพิ่มเติม
                  </div>
                )}

                {query.data.degraded.length > 0 && (
                  <div className="inline-block rounded border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">
                    บริบทบางส่วนไม่พร้อม
                  </div>
                )}
              </TooltipProvider>
            )}
          </div>
        </aside>
      </PopoverContent>
    </Popover>
  )
}
