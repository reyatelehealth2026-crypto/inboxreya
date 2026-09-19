'use client'

import { useEffect, useState } from 'react'

export type HeroSlide =
  | { kind: 'image'; src: string; alt: string; href?: string }
  | { kind: 'statement'; kicker: string; title: string; note: string }

const AUTO_ADVANCE_MS = 5000

/** Full-width slider: CMS banners plus one statement slide. Auto-advances. */
export function PromoHero({ slides }: { slides: HeroSlide[] }) {
  const [index, setIndex] = useState(0)
  const count = slides.length

  useEffect(() => {
    if (count < 2) return
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), AUTO_ADVANCE_MS)
    return () => window.clearInterval(timer)
  }, [count])

  if (count === 0) return null

  return (
    <div className="ph-hero">
      <div className="ph-hero-track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) =>
          slide.kind === 'image' ? (
            <div key={i} className="ph-hero-slide">
              {slide.href ? <a href={slide.href}><SlideImage slide={slide} eager={i === 0} /></a> : <SlideImage slide={slide} eager={i === 0} />}
            </div>
          ) : (
            <div key={i} className="ph-hero-slide ph-hero-stmt">
              <div className="ph-kicker">{slide.kicker}</div>
              <div className="ph-hero-title">{slide.title}</div>
              <div className="ph-hero-note">{slide.note}</div>
            </div>
          )
        )}
      </div>
      {count > 1 && (
        <>
          <span className="ph-hero-label">
            {index + 1}/{count}
          </span>
          <button
            type="button"
            className="ph-hero-btn prev"
            aria-label="ก่อนหน้า"
            onClick={() => setIndex((i) => (i + count - 1) % count)}
          >
            <Chevron left />
          </button>
          <button
            type="button"
            className="ph-hero-btn next"
            aria-label="ถัดไป"
            onClick={() => setIndex((i) => (i + 1) % count)}
          >
            <Chevron />
          </button>
          <div className="ph-hero-dots">
            {slides.map((_, i) => (
              <button
                key={i}
                type="button"
                className={i === index ? 'ph-dot on' : 'ph-dot'}
                aria-label={`สไลด์ ${i + 1}`}
                onClick={() => setIndex(i)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function SlideImage({ slide, eager }: { slide: { src: string; alt: string }; eager: boolean }) {
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={slide.src} alt={slide.alt} loading={eager ? 'eager' : 'lazy'} decoding="async" />
}

function Chevron({ left = false }: { left?: boolean }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={left ? 'm15 18-6-6 6-6' : 'm9 18 6-6-6-6'} />
    </svg>
  )
}
