'use client'

import { useEffect } from 'react'

const HIGHLIGHT = ['ring-4', 'ring-[#ec3013]', 'ring-offset-2']

/**
 * Scroll the card a broadcast keyword points at into view and ring it for a beat.
 *
 * The server already resolved ?k= to a card id, so this island only moves the
 * viewport — no matching, no data.
 */
export function PromoFocus({ targetId }: { targetId: string }) {
  useEffect(() => {
    const card = document.getElementById(targetId)
    if (!card) return

    card.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' })
    card.classList.add(...HIGHLIGHT)
    const timer = window.setTimeout(() => card.classList.remove(...HIGHLIGHT), 2000)
    return () => window.clearTimeout(timer)
  }, [targetId])

  return null
}
