'use client'

import { useCallback, useEffect, useState } from 'react'
import { History } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { ConversationStatusBadge } from './ConversationStatusBadge'
import { formatDistanceToNow } from 'date-fns'

interface StatusHistoryDialogProps {
  conversationId: string
}

interface StatusChange {
  id: string
  action: string
  description: string
  adminId?: string
  adminName?: string
  oldStatus?: string
  newStatus?: string
  createdAt: string
}

export function StatusHistoryDialog({ conversationId }: StatusHistoryDialogProps) {
  const [open, setOpen] = useState(false)
  const [history, setHistory] = useState<StatusChange[]>([])
  const [isLoading, setIsLoading] = useState(false)

  const loadHistory = useCallback(async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `/api/inbox/conversations/${conversationId}/status-history`
      )

      if (!response.ok) {
        throw new Error('Failed to load status history')
      }

      const result = await response.json()
      setHistory(result.data || [])
    } catch (error) {
      console.error('Error loading status history:', error)
      alert('Failed to load status history')
    } finally {
      setIsLoading(false)
    }
  }, [conversationId])

  useEffect(() => {
    if (open) {
      loadHistory()
    }
  }, [open, loadHistory])

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 gap-2">
          <History className="h-4 w-4" />
          <span className="text-xs">History</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Status Change History</DialogTitle>
          <DialogDescription>
            View all status changes for this conversation
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[400px] overflow-y-auto">
          {isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              Loading history...
            </div>
          ) : history.length === 0 ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              No status changes yet
            </div>
          ) : (
            <div className="space-y-4">
              {history.map((change) => (
                <div
                  key={change.id}
                  className="flex items-start gap-3 rounded-lg border p-3"
                >
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      {change.oldStatus && (
                        <>
                          <ConversationStatusBadge status={change.oldStatus} />
                          <span className="text-muted-foreground">→</span>
                        </>
                      )}
                      {change.newStatus && (
                        <ConversationStatusBadge status={change.newStatus} />
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {change.description}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      {change.adminName && (
                        <>
                          <span>by {change.adminName}</span>
                          <span>•</span>
                        </>
                      )}
                      <span>
                        {formatDistanceToNow(new Date(change.createdAt), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
