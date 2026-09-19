'use client'

import { useEffect, useState } from 'react'

/** Chips ticking down to `endsAt` (ISO). Renders placeholders until mounted so SSR and client agree. */
export function DealCountdown({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [])

  const parts = now === null ? null : split(Math.max(0, new Date(endsAt).getTime() - now))

  return (
    <div className="ph-chips">
      {parts && parts.days > 0 && <span className="ph-chip">{parts.days} วัน</span>}
      <span className="ph-chip">{parts ? pad(parts.hours) : '--'}</span>
      <span className="ph-chip">{parts ? pad(parts.minutes) : '--'}</span>
      <span className="ph-chip">{parts ? pad(parts.seconds) : '--'}</span>
    </div>
  )
}

function split(ms: number) {
  let s = Math.floor(ms / 1000)
  const days = Math.floor(s / 86400)
  s -= days * 86400
  const hours = Math.floor(s / 3600)
  s -= hours * 3600
  const minutes = Math.floor(s / 60)
  return { days, hours, minutes, seconds: s - minutes * 60 }
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}
