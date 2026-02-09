"use client"

import { useState, useRef, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface EmojiPickerProps {
    onEmojiSelect: (emoji: string) => void
    isOpen: boolean
    onClose: () => void
}

const EMOJI_CATEGORIES = {
    smileys: {
        label: '😀',
        title: 'หน้าและอารมณ์',
        emojis: ['😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃', '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙', '🥲', '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔', '🤐', '🤨', '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔', '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵', '🥶', '🥴', '😵', '🤯', '🤠', '🥳', '🥸', '😎', '🤓', '🧐']
    },
    gestures: {
        label: '👍',
        title: 'ท่าทางและร่างกาย',
        emojis: ['👋', '🤚', '🖐️', '✋', '🖖', '👌', '🤌', '🤏', '✌️', '🤞', '🤟', '🤘', '🤙', '👈', '👉', '👆', '🖕', '👇', '☝️', '👍', '👎', '✊', '👊', '🤛', '🤜', '👏', '🙌', '👐', '🤲', '🤝', '🙏', '✍️', '💅', '🤳', '💪', '🦾', '🦿', '🦵', '🦶', '👂', '🦻', '👃', '🧠', '🫀', '🫁', '🦷', '🦴', '👀', '👁️', '👅', '👄']
    },
    hearts: {
        label: '❤️',
        title: 'หัวใจและความรัก',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔', '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '♥️', '💌', '💋', '👩‍❤️‍👨', '👨‍❤️‍👨', '👩‍❤️‍👩', '💏', '💑', '👪', '🏠', '🏡']
    },
    objects: {
        label: '🎁',
        title: 'สิ่งของ',
        emojis: ['🎁', '🎀', '🎊', '🎉', '🎈', '🎄', '🎃', '🎗️', '🎟️', '🎫', '🎖️', '🏆', '🏅', '🥇', '🥈', '🥉', '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱', '🎳', '🎯', '📱', '💻', '⌨️', '🖥️', '🖨️', '💰', '💳', '💎', '⌚', '📷', '📹', '🎥', '🎬', '🎤', '🎧', '🎼', '🎵', '🎶', '📚', '📖', '📝', '✏️', '📌', '📎', '✂️', '📦', '📮', '📧', '📞', '☎️']
    },
    food: {
        label: '🍔',
        title: 'อาหารและเครื่องดื่ม',
        emojis: ['🍎', '🍊', '🍋', '🍌', '🍉', '🍇', '🍓', '🫐', '🍈', '🍒', '🍑', '🥭', '🍍', '🥥', '🥝', '🍅', '🍆', '🥑', '🥦', '🥬', '🥒', '🌶️', '🫑', '🌽', '🥕', '🧄', '🧅', '🥔', '🍠', '🥐', '🥖', '🍞', '🥨', '🥯', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗', '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆', '🌮', '🌯', '🫔', '🥗', '🥘', '🍝', '🍜', '🍲', '🍛', '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠', '🥮', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍿', '🧃', '🥤', '☕', '🍵', '🧉', '🍺', '🍻', '🥂', '🍷', '🥃', '🍸', '🍹', '🧊']
    },
    nature: {
        label: '🌸',
        title: 'ธรรมชาติ',
        emojis: ['🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱', '🪴', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁', '🍂', '🍃', '🍇', '🌍', '🌎', '🌏', '🌐', '🪨', '⭐', '🌟', '✨', '⚡', '☀️', '🌤️', '⛅', '🌥️', '☁️', '🌦️', '🌧️', '⛈️', '🌩️', '🌨️', '❄️', '☃️', '⛄', '🌬️', '💨', '🌪️', '🌫️', '🌈', '🌊', '💧', '💦', '☔', '🐶', '🐱', '🐭', '🐹', '🐰', '🦊', '🐻', '🐼', '🐨', '🐯', '🦁', '🐮', '🐷', '🐸', '🐵', '🙈', '🙉', '🙊', '🐒', '🐔', '🐧', '🐦', '🐤', '🦆', '🦅', '🦉', '🦇', '🐺', '🐗', '🐴', '🦄', '🐝', '🐛', '🦋', '🐌', '🐞', '🐜', '🦟']
    }
}

type CategoryKey = keyof typeof EMOJI_CATEGORIES

export function EmojiPicker({ onEmojiSelect, isOpen, onClose }: EmojiPickerProps) {
    const [activeCategory, setActiveCategory] = useState<CategoryKey>('smileys')
    const containerRef = useRef<HTMLDivElement>(null)

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                onClose()
            }
        }
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside)
        }
        return () => document.removeEventListener('mousedown', handleClickOutside)
    }, [isOpen, onClose])

    // Close on escape
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                onClose()
            }
        }
        if (isOpen) {
            window.addEventListener('keydown', handleKeyDown)
        }
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    const handleEmojiClick = useCallback((emoji: string) => {
        onEmojiSelect(emoji)
    }, [onEmojiSelect])

    if (!isOpen) return null

    return (
        <div
            ref={containerRef}
            className={cn(
                'absolute bottom-14 left-0 z-50',
                'bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700',
                'w-80 max-h-80 overflow-hidden',
                'animate-in fade-in-0 zoom-in-95 duration-150'
            )}
        >
            {/* Category tabs */}
            <div className="flex items-center gap-1 p-2 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
                {(Object.entries(EMOJI_CATEGORIES) as [CategoryKey, typeof EMOJI_CATEGORIES.smileys][]).map(([key, { label, title }]) => (
                    <Button
                        key={key}
                        variant="ghost"
                        size="sm"
                        className={cn(
                            'h-8 w-8 p-0 text-lg hover:bg-gray-200 dark:hover:bg-slate-700',
                            activeCategory === key && 'bg-gray-200 dark:bg-slate-700'
                        )}
                        onClick={() => setActiveCategory(key)}
                        title={title}
                    >
                        {label}
                    </Button>
                ))}
            </div>

            {/* Emoji grid */}
            <div className="p-2 max-h-56 overflow-y-auto">
                <div className="grid grid-cols-8 gap-0.5">
                    {EMOJI_CATEGORIES[activeCategory].emojis.map((emoji, index) => (
                        <button
                            key={`${emoji}-${index}`}
                            className={cn(
                                'h-8 w-8 flex items-center justify-center text-xl',
                                'rounded-md hover:bg-gray-100 dark:hover:bg-slate-700',
                                'transition-colors duration-100',
                                'focus:outline-none focus:ring-2 focus:ring-teal-500'
                            )}
                            onClick={() => handleEmojiClick(emoji)}
                            type="button"
                        >
                            {emoji}
                        </button>
                    ))}
                </div>
            </div>
        </div>
    )
}
