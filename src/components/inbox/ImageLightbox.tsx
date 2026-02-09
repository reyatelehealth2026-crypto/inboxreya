"use client"

import { useEffect, useCallback } from 'react'
import Image from 'next/image'
import { X, Download, ExternalLink, ZoomIn, ZoomOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface ImageLightboxProps {
    src: string | null
    alt?: string
    onClose: () => void
    isOpen: boolean
}

export function ImageLightbox({ src, alt = 'Image', onClose, isOpen }: ImageLightboxProps) {
    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                onClose()
            }
        }
        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, onClose])

    // Prevent body scroll when open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = 'hidden'
        } else {
            document.body.style.overflow = ''
        }
        return () => {
            document.body.style.overflow = ''
        }
    }, [isOpen])

    const handleDownload = useCallback(() => {
        if (!src) return
        const link = document.createElement('a')
        link.href = src
        link.download = `image_${Date.now()}.jpg`
        link.click()
    }, [src])

    const handleOpenInNewTab = useCallback(() => {
        if (!src) return
        window.open(src, '_blank')
    }, [src])

    const handleBackdropClick = useCallback((e: React.MouseEvent) => {
        if (e.target === e.currentTarget) {
            onClose()
        }
    }, [onClose])

    if (!isOpen || !src) return null

    return (
        <div
            className={cn(
                'fixed inset-0 z-[9999] flex items-center justify-center',
                'bg-black/90 backdrop-blur-sm',
                'transition-opacity duration-300',
                isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
            )}
            onClick={handleBackdropClick}
            role="dialog"
            aria-modal="true"
            aria-label="ดูรูปภาพขนาดใหญ่"
        >
            {/* Close button */}
            <Button
                variant="ghost"
                size="icon"
                className="absolute top-4 right-4 h-11 w-11 rounded-full bg-white/10 hover:bg-white/20 text-white z-10"
                onClick={onClose}
                aria-label="ปิด"
            >
                <X className="h-6 w-6" />
            </Button>

            {/* Image container */}
            <div className="relative max-w-[90vw] max-h-[85vh] flex items-center justify-center">
                <Image
                    src={src}
                    alt={alt}
                    width={1200}
                    height={900}
                    className="max-w-full max-h-[85vh] object-contain rounded-lg shadow-2xl"
                    unoptimized
                    priority
                />
            </div>

            {/* Action buttons */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-3">
                <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm"
                    onClick={handleDownload}
                >
                    <Download className="h-4 w-4 mr-2" />
                    ดาวน์โหลด
                </Button>
                <Button
                    variant="secondary"
                    size="sm"
                    className="bg-white/20 hover:bg-white/30 text-white border-none backdrop-blur-sm"
                    onClick={handleOpenInNewTab}
                >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    เปิดในแท็บใหม่
                </Button>
            </div>
        </div>
    )
}
