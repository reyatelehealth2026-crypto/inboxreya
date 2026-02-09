import type { JSX } from 'react'
import { cn } from '@/lib/utils'

interface ScreenReaderOnlyProps {
  children: React.ReactNode
  className?: string
  as?: keyof JSX.IntrinsicElements
}

/**
 * Component for content that should only be visible to screen readers
 */
export function ScreenReaderOnly({ 
  children, 
  className,
  as: Component = 'span' 
}: ScreenReaderOnlyProps) {
  return (
    <Component
      className={cn(
        'sr-only',
        // Fallback styles if sr-only class is not available
        'absolute w-px h-px p-0 -m-px overflow-hidden whitespace-nowrap border-0',
        className
      )}
    >
      {children}
    </Component>
  )
}
