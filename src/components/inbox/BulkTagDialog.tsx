"use client"

import { useState } from 'react'
import { X, Tag, Users } from 'lucide-react'
import { useTags, useAssignTag } from '@/hooks/use-tags'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useToast } from '@/hooks/use-toast'

interface BulkTagDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  selectedUserIds: string[]
  onComplete?: () => void
}

export function BulkTagDialog({
  open,
  onOpenChange,
  selectedUserIds,
  onComplete,
}: BulkTagDialogProps) {
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(new Set())
  const { data: tags = [] } = useTags()
  const assignTag = useAssignTag()
  const { toast } = useToast()
  const [isProcessing, setIsProcessing] = useState(false)

  const toggleTag = (tagId: string) => {
    const newSet = new Set(selectedTagIds)
    if (newSet.has(tagId)) {
      newSet.delete(tagId)
    } else {
      newSet.add(tagId)
    }
    setSelectedTagIds(newSet)
  }

  const handleApply = async () => {
    if (selectedTagIds.size === 0) {
      toast({
        title: 'กรุณาเลือกแท็ก',
        description: 'กรุณาเลือกแท็กอย่างน้อย 1 แท็ก',
        variant: 'destructive',
      })
      return
    }

    setIsProcessing(true)
    let successCount = 0
    let errorCount = 0

    try {
      // Apply each tag to each user
      for (const userId of selectedUserIds) {
        for (const tagId of selectedTagIds) {
          try {
            await assignTag.mutateAsync({ userId, tagId })
            successCount++
          } catch (error) {
            console.error(`Failed to assign tag ${tagId} to user ${userId}:`, error)
            errorCount++
          }
        }
      }

      toast({
        title: 'เพิ่มแท็กสำเร็จ',
        description: `เพิ่มแท็กให้ ${selectedUserIds.length} ลูกค้า (${successCount} สำเร็จ${errorCount > 0 ? `, ${errorCount} ล้มเหลว` : ''})`,
      })

      setSelectedTagIds(new Set())
      onOpenChange(false)
      onComplete?.()
    } catch (error) {
      toast({
        title: 'เกิดข้อผิดพลาด',
        description: 'ไม่สามารถเพิ่มแท็กได้',
        variant: 'destructive',
      })
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Tag className="h-5 w-5" />
            เพิ่มแท็กแบบกลุ่ม
          </DialogTitle>
          <DialogDescription>
            เลือกแท็กที่ต้องการเพิ่มให้กับลูกค้า {selectedUserIds.length} คน
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Selected customers count */}
          <div className="flex items-center gap-2 p-3 bg-muted rounded-md">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm">
              เลือกลูกค้า <strong>{selectedUserIds.length}</strong> คน
            </span>
          </div>

          {/* Tag selection */}
          <div>
            <label className="text-sm font-medium mb-2 block">เลือกแท็ก</label>
            <ScrollArea className="h-[300px] border rounded-md p-3">
              <div className="space-y-2">
                {tags.map((tag) => {
                  const isSelected = selectedTagIds.has(tag.id)
                  return (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`flex items-center justify-between w-full p-2 rounded-md transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border-2 border-primary'
                          : 'hover:bg-muted border-2 border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: tag.color }}
                        />
                        <span className="text-sm">{tag.name}</span>
                      </div>
                      {isSelected && (
                        <Badge variant="default" className="text-xs">
                          เลือกแล้ว
                        </Badge>
                      )}
                    </button>
                  )
                })}
                {tags.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    ไม่มีแท็ก
                  </p>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* Selected tags preview */}
          {selectedTagIds.size > 0 && (
            <div>
              <label className="text-sm font-medium mb-2 block">
                แท็กที่เลือก ({selectedTagIds.size})
              </label>
              <div className="flex flex-wrap gap-1.5 p-2 border rounded-md bg-muted/50">
                {Array.from(selectedTagIds).map((tagId) => {
                  const tag = tags.find((t) => t.id === tagId)
                  if (!tag) return null
                  return (
                    <Badge
                      key={tagId}
                      variant="outline"
                      className="gap-1 pr-1"
                      style={{ borderColor: tag.color, color: tag.color }}
                    >
                      {tag.name}
                      <button
                        onClick={() => toggleTag(tagId)}
                        className="ml-1 hover:bg-muted rounded-full p-0.5"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
          >
            ยกเลิก
          </Button>
          <Button onClick={handleApply} disabled={isProcessing || selectedTagIds.size === 0}>
            {isProcessing ? 'กำลังเพิ่มแท็ก...' : `เพิ่มแท็ก (${selectedTagIds.size})`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
