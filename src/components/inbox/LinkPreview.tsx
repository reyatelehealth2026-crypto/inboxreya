
"use client"

import { useQuery } from '@tanstack/react-query'
import Image from 'next/image'
import { Skeleton } from '@/components/ui/skeleton'
import { ExternalLink } from 'lucide-react'

interface LinkPreviewProps {
    url: string
    isOutgoing: boolean
}

interface PreviewData {
    title: string
    description: string
    image: string
    favicon: string
    url: string
    hostname: string
}

export function LinkPreview({ url, isOutgoing }: LinkPreviewProps) {
    const { data, isLoading, error } = useQuery<PreviewData>({
        queryKey: ['link-preview', url],
        queryFn: async () => {
            try {
                const res = await fetch(`/api/inbox/link-preview?url=${encodeURIComponent(url)}`)
                if (!res.ok) throw new Error('Failed to fetch preview')
                return res.json()
            } catch (err) {
                console.error(err)
                throw err
            }
        },
        staleTime: 24 * 60 * 60 * 1000, // 24 hours
        retry: false,
        enabled: !!url && (url.startsWith('http://') || url.startsWith('https://'))
    })

    // Don't show loading state or error if URL is not valid or returns empty
    // We prefer to fail silently and show just the link text which is handled by parent
    if (error) return null

    if (isLoading) {
        return (
            <div className={`mt-2 max-w-[300px] rounded-lg overflow-hidden border ${isOutgoing ? 'border-primary-foreground/20 bg-black/5' : 'border-border bg-background/50'}`}>
                <Skeleton className="h-[150px] w-full bg-muted/60" />
                <div className="p-3 space-y-2">
                    <Skeleton className="h-4 w-3/4 bg-muted/60" />
                    <Skeleton className="h-3 w-full bg-muted/60" />
                </div>
            </div>
        )
    }

    if (!data || (!data.title && !data.description && !data.image)) {
        return null
    }

    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className={`block mt-2 max-w-[300px] rounded-xl overflow-hidden border transition-all hover:opacity-95 no-underline
        ${isOutgoing ? 'bg-black/10 border-black/5 text-primary-foreground' : 'bg-background border-border hover:bg-muted/30'}
      `}
            onClick={(e) => e.stopPropagation()} // Prevent bubble click handlers
        >
            {data.image && (
                <div className="relative w-full aspect-[1.91/1] bg-muted overflow-hidden">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                        src={data.image}
                        alt={data.title || 'Link preview'}
                        className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500"
                        onError={(e) => {
                            e.currentTarget.style.display = 'none'
                        }}
                    />
                </div>
            )}
            <div className="p-3">
                {data.title && (
                    <h3 className={`font-semibold text-sm line-clamp-2 mb-1 leading-snug ${isOutgoing ? 'text-primary-foreground' : 'text-foreground'}`}>
                        {data.title}
                    </h3>
                )}
                {data.description && (
                    <p className={`text-xs line-clamp-2 mb-2 leading-relaxed ${isOutgoing ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                        {data.description}
                    </p>
                )}
                <div className={`flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-medium ${isOutgoing ? 'text-primary-foreground/60' : 'text-muted-foreground/70'}`}>
                    {data.favicon && (
                        /* eslint-disable-next-line @next/next/no-img-element */
                        <img
                            src={data.favicon}
                            alt=""
                            className="w-3 h-3 object-contain"
                            onError={(e) => { e.currentTarget.style.display = 'none' }}
                        />
                    )}
                    <span className="truncate">{data.hostname || new URL(url).hostname}</span>
                </div>
            </div>
        </a>
    )
}
