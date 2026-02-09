'use client'

import { cn } from '@/lib/utils'

interface SkipLink {
  href: string
  label: string
}

interface SkipNavigationProps {
  links?: SkipLink[]
}

const defaultLinks: SkipLink[] = [
  { href: '#main-content', label: 'Skip to main content' },
  { href: '#conversation-list', label: 'Skip to conversation list' },
  { href: '#chat-panel', label: 'Skip to chat panel' },
]

/**
 * Skip navigation links for keyboard users
 */
export function SkipNavigation({ links = defaultLinks }: SkipNavigationProps) {
  return (
    <div className="skip-navigation">
      {links.map((link) => (
        <a
          key={link.href}
          href={link.href}
          className={cn(
            'sr-only focus:not-sr-only',
            'fixed top-4 left-4 z-[9999]',
            'px-4 py-2 bg-blue-600 text-white rounded-md',
            'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2',
            'font-medium text-sm'
          )}
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}
