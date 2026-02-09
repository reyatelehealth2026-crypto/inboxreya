"use client"

import { useState } from 'react'
import { Plus, X, ChevronDown, ChevronUp } from 'lucide-react'
import { useTags, useAssignTag, useRemoveTag, useCreateTag } from '@/hooks/use-tags'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { UserTag } from '@/types'

interface TagSelectorProps {
    userId: string
    currentTags: UserTag[]
}

export function TagSelector({
    userId,
    currentTags
}: TagSelectorProps) {
    const [isOpen, setIsOpen] = useState(false)
    const [newTagName, setNewTagName] = useState('')
    const [newTagColor, setNewTagColor] = useState('#3B82F6')
    const { data: allTags } = useTags()
    const assignTag = useAssignTag()
    const removeTag = useRemoveTag()
    const createTag = useCreateTag()

    const currentTagIds = new Set(currentTags.map((t) => t.id))
    const tags = Array.isArray(allTags) ? allTags : []
    const availableTags = tags.filter((t) => !currentTagIds.has(t.id))

    const handleAssign = async (tagId: string) => {
        await assignTag.mutateAsync({ userId, tagId })
        setIsOpen(false) // Collapse dropdown immediately after selection
    }

    const handleRemove = async (tagId: string) => {
        await removeTag.mutateAsync({ userId, tagId })
    }

    const handleCreateTag = async () => {
        if (!newTagName.trim()) return
        const newTag = await createTag.mutateAsync({
            name: newTagName.trim(),
            color: newTagColor
        })
        // Auto-assign the newly created tag
        await assignTag.mutateAsync({ userId, tagId: newTag.id })
        setNewTagName('')
        setNewTagColor('#3B82F6')
        setIsOpen(false) // Collapse dropdown after create and assign
    }

    // Function to determine text color based on background color
    const getContrastColor = (hexColor: string) => {
        const hex = hexColor.replace('#', '')
        const r = parseInt(hex.substr(0, 2), 16)
        const g = parseInt(hex.substr(2, 2), 16)
        const b = parseInt(hex.substr(4, 2), 16)
        const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
        return luminance > 0.5 ? '#1a1a1a' : '#ffffff'
    }

    return (
        <div className="flex items-center gap-3">
            {/* Current tags */}
            {currentTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                    {currentTags.map((tag) => {
                        const bgColor = tag.color || "#E2E8F0"
                        const textColor = getContrastColor(bgColor)
                        return (
                            <span
                                key={tag.id}
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-semibold shadow-sm"
                                style={{
                                    backgroundColor: bgColor,
                                    color: textColor,
                                }}
                                title={tag.name}
                            >
                                <span className="min-w-0 break-words">{tag.name}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemove(tag.id)}
                                    className="ml-0.5 inline-flex h-3 w-3 flex-shrink-0 items-center justify-center rounded hover:bg-black/20"
                                    aria-label={`ลบแท็ก ${tag.name}`}
                                >
                                    <X className="h-2 w-2" />
                                </button>
                            </span>
                        )
                    })}
                </div>
            )}

            {/* Dropdown trigger */}
            <div className="relative">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-5 px-1.5 text-[10px] gap-1 hover:bg-gray-100/80 text-gray-600 border-gray-200"
                    onClick={() => setIsOpen(!isOpen)}
                    aria-expanded={isOpen}
                    aria-label="เพิ่มแท็ก"
                >
                    <Plus className="h-2.5 w-2.5" />
                    {currentTags.length === 0 ? 'เพิ่มแท็ก' : ''}
                </Button>

                {/* Dropdown menu */}
                {isOpen && (
                    <>
                        {/* Backdrop to close dropdown */}
                        <div
                            className="fixed inset-0 z-10"
                            onClick={() => setIsOpen(false)}
                        />

                        {/* Dropdown content */}
                        <div className="absolute top-full left-0 mt-1 bg-white border rounded-lg shadow-lg z-20 w-60 max-h-64 overflow-hidden flex flex-col">
                            {/* Available tags list */}
                            <div className="overflow-y-auto flex-1 p-2">
                                {availableTags.length > 0 ? (
                                    <div className="space-y-1">
                                        {availableTags.map((tag) => (
                                            <button
                                                key={tag.id}
                                                onClick={() => handleAssign(tag.id)}
                                                className="flex items-center gap-2 w-full px-2 py-1.5 text-xs rounded-md hover:bg-gray-100 transition-colors text-left"
                                            >
                                                <div
                                                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                                                    style={{ backgroundColor: tag.color }}
                                                />
                                                <span className="flex-1 truncate">{tag.name}</span>
                                            </button>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-[10px] text-gray-500 text-center py-2">
                                        ไม่มีแท็กเพิ่มเติม
                                    </p>
                                )}
                            </div>

                            {/* Create new tag section */}
                            <div className="border-t p-2 bg-gray-50">
                                <div className="space-y-2">
                                    <Input
                                        placeholder="ชื่อแท็กใหม่..."
                                        value={newTagName}
                                        onChange={(e) => setNewTagName(e.target.value)}
                                        className="h-7 text-xs"
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && newTagName.trim()) {
                                                handleCreateTag()
                                            }
                                        }}
                                    />
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="color"
                                            value={newTagColor}
                                            onChange={(e) => setNewTagColor(e.target.value)}
                                            className="h-6 w-8 rounded border cursor-pointer p-0"
                                        />
                                        <Button
                                            size="sm"
                                            className="h-6 text-[10px] flex-1"
                                            style={{ background: '#0C665D' }}
                                            onClick={handleCreateTag}
                                            disabled={!newTagName.trim()}
                                        >
                                            <Plus className="h-3 w-3 mr-1" />
                                            สร้าง
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </>
                )}
            </div>
        </div>
    )
}
