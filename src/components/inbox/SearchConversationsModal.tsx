'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Search, User, MessageSquare, Clock } from 'lucide-react'
import { useInboxStore } from '@/stores/inbox'
import { formatDistanceToNow } from 'date-fns'

interface SearchConversationsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  conversations: any[]
  onSelectConversation: (conversationId: string) => void
}

export function SearchConversationsModal({
  open,
  onOpenChange,
  conversations,
  onSelectConversation,
}: SearchConversationsModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  // Filter conversations based on search query
  const filteredConversations = conversations.filter((conv) => {
    const query = searchQuery.toLowerCase()
    return (
      conv.customer?.displayName?.toLowerCase().includes(query) ||
      conv.lastMessage?.content?.toLowerCase().includes(query) ||
      conv.tags?.some((tag: any) => tag.name?.toLowerCase().includes(query))
    )
  })

  // Reset selected index when search changes
  useEffect(() => {
    setSelectedIndex(0)
  }, [searchQuery])

  // Focus input when modal opens
  useEffect(() => {
    if (open) {
      setSearchQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSelect = useCallback(
    (conversation: any) => {
      onSelectConversation(conversation.id)
      onOpenChange(false)
    },
    [onSelectConversation, onOpenChange]
  )

  // Handle keyboard navigation
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) =>
          Math.min(prev + 1, filteredConversations.length - 1)
        )
      } else if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => Math.max(prev - 1, 0))
      } else if (e.key === 'Enter' && filteredConversations[selectedIndex]) {
        e.preventDefault()
        handleSelect(filteredConversations[selectedIndex])
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open, filteredConversations, selectedIndex, handleSelect])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 gap-0">
        {/* Search Input */}
        <div className="p-4 border-b">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
            <Input
              ref={inputRef}
              type="text"
              placeholder="Search conversations by name, message, or tag..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>
        </div>

        {/* Results */}
        <div className="max-h-[400px] overflow-y-auto">
          {filteredConversations.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Search className="h-12 w-12 mx-auto mb-3 text-gray-300" />
              <p className="text-sm">
                {searchQuery ? 'No conversations found' : 'Start typing to search...'}
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredConversations.map((conversation, index) => (
                <button
                  key={conversation.id}
                  onClick={() => handleSelect(conversation)}
                  className={`w-full p-4 text-left hover:bg-gray-50 transition-colors ${index === selectedIndex ? 'bg-blue-50' : ''
                    }`}
                >
                  <div className="flex items-start gap-3">
                    {/* Avatar */}
                    <div className="flex-shrink-0">
                      {conversation.customer?.pictureUrl ? (
                        <img
                          src={conversation.customer.pictureUrl}
                          alt={conversation.customer.displayName}
                          className="w-10 h-10 rounded-full"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <User className="h-5 w-5 text-gray-500" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-1">
                        <h4 className="text-sm font-medium text-gray-900 truncate">
                          {conversation.customer?.displayName || 'Unknown'}
                        </h4>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {conversation.lastMessageAt &&
                            formatDistanceToNow(new Date(conversation.lastMessageAt), {
                              addSuffix: true,
                            })}
                        </span>
                      </div>

                      {conversation.lastMessage && (
                        <p className="text-sm text-gray-600 truncate flex items-center gap-1">
                          <MessageSquare className="h-3 w-3" />
                          {conversation.lastMessage.content}
                        </p>
                      )}

                      {/* Tags */}
                      {conversation.tags && conversation.tags.length > 0 && (
                        <div className="flex gap-1 mt-2">
                          {conversation.tags.slice(0, 3).map((tag: any) => (
                            <span
                              key={tag.id}
                              className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-800"
                            >
                              {tag.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 border-t bg-gray-50 text-xs text-gray-500">
          <div className="flex items-center justify-between">
            <span>Use ↑↓ to navigate, Enter to select</span>
            <span>ESC to close</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
