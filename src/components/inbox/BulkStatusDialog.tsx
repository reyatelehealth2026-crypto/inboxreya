'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { ConversationStatusBadge } from './ConversationStatusBadge'

interface BulkStatusDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedConversationIds: string[]
  onSuccess?: () => void
}

const statuses = [
  { value: 'new', label: 'New' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting', label: 'Waiting' },
  { value: 'resolved', label: 'Resolved' },
]

export function BulkStatusDialog({
  open,
  onOpenChange,
  selectedConversationIds,
  onSuccess,
}: BulkStatusDialogProps) {
  const [selectedStatus, setSelectedStatus] = useState<string>('')
  const [isUpdating, setIsUpdating] = useState(false)

  const handleSubmit = async () => {
    if (!selectedStatus || selectedConversationIds.length === 0) return

    setIsUpdating(true)
    try {
      const response = await fetch('/api/inbox/conversations/bulk-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationIds: selectedConversationIds,
          status: selectedStatus,
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Failed to update status')
      }

      const result = await response.json()
      alert(`Successfully updated ${result.data.updatedCount} conversations`)
      onSuccess?.()
      onOpenChange(false)
      setSelectedStatus('')
    } catch (error) {
      console.error('Error bulk updating status:', error)
      alert(error instanceof Error ? error.message : 'Failed to update status')
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Update Status for Multiple Conversations</DialogTitle>
          <DialogDescription>
            Change the status for {selectedConversationIds.length} selected conversation
            {selectedConversationIds.length !== 1 ? 's' : ''}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">New Status</label>
            <Select value={selectedStatus} onValueChange={setSelectedStatus}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((status) => (
                  <SelectItem key={status.value} value={status.value}>
                    <div className="flex items-center gap-2">
                      <ConversationStatusBadge status={status.value} />
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isUpdating}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedStatus || isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
