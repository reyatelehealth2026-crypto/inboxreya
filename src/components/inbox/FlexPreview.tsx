import React from 'react'

type FlexContent = Record<string, any>

// LINE bubble sizes → pixel width (actual LINE app values)
const bubbleWidthMap: Record<string, number> = {
  nano:  120,
  micro: 160,
  deca:  200,
  hecto: 220,
  kilo:  260,
  mega:  330,
  giga:  370,
}

const spacingMap: Record<string, number> = {
  none: 0,
  xs:   4,
  sm:   8,
  md:   12,
  lg:   16,
  xl:   20,
  xxl:  24,
}

const textSizeMap: Record<string, number> = {
  xxs:  9,
  xs:   11,
  sm:   13,
  md:   14,
  lg:   17,
  xl:   20,
  xxl:  22,
  '3xl': 26,
  '4xl': 30,
  '5xl': 36,
}

/** Parse named spacing (xs/sm/md…) or pixel values like '24px' */
function parsePx(value: string | undefined): number {
  if (!value || value === 'none') return 0
  if (value in spacingMap) return spacingMap[value]
  const m = value.match(/^(\d+(?:\.\d+)?)px$/)
  return m ? parseFloat(m[1]) : 0
}

/** Parse padding shorthand — LINE supports paddingAll, paddingTop/Bottom/Start/End */
function parsePadding(box: FlexContent): React.CSSProperties {
  if (box.paddingAll != null) {
    const v = parsePx(box.paddingAll)
    return { padding: v }
  }
  return {
    paddingTop:    parsePx(box.paddingTop)    || undefined,
    paddingBottom: parsePx(box.paddingBottom) || undefined,
    paddingLeft:   parsePx(box.paddingStart)  || undefined,
    paddingRight:  parsePx(box.paddingEnd)    || undefined,
  }
}

const alignMap: Record<string, string> = {
  start:  'flex-start',
  center: 'center',
  end:    'flex-end',
}

const justifyMap: Record<string, string> = {
  start:       'flex-start',
  center:      'center',
  end:         'flex-end',
  spaceBetween:'space-between',
  spaceAround: 'space-around',
  spaceEvenly: 'space-evenly',
}

function normalizeFlex(flex: FlexContent | null) {
  if (!flex) return null
  if (flex.type === 'flex' && flex.contents) return flex.contents
  if (flex.type === 'bubble' || flex.type === 'carousel') return flex
  if (flex.contents && (flex.contents.type === 'bubble' || flex.contents.type === 'carousel')) {
    return flex.contents
  }
  return null
}

// ─── LINE chat background ────────────────────────────────────────────────────
function FlexFrame({ children, bubbleWidth }: { children: React.ReactNode; bubbleWidth: number }) {
  return (
    <div
      style={{
        background: 'linear-gradient(160deg, #6d8ea0 0%, #4f7080 100%)',
        padding: '14px 10px',
        borderRadius: 14,
        display: 'flex',
        justifyContent: 'flex-end', // messages appear on right in LINE-style
      }}
    >
      <div style={{ maxWidth: bubbleWidth + 16, width: '100%' }}>
        {children}
      </div>
    </div>
  )
}

// ─── Bubble card ─────────────────────────────────────────────────────────────
function BubbleShell({ bubble }: { bubble: FlexContent }) {
  const size = bubble.size || 'mega'
  const width = bubbleWidthMap[size] ?? bubbleWidthMap.mega
  const bodyBg: string  = bubble.styles?.body?.backgroundColor   ?? '#ffffff'
  const footerBg: string = bubble.styles?.footer?.backgroundColor ?? '#ffffff'
  const headerBg: string = bubble.styles?.header?.backgroundColor ?? '#f8fafc'

  return (
    <div
      style={{
        width: '100%',
        maxWidth: width,
        background: '#ffffff',
        borderRadius: 14,
        overflow: 'hidden',
        boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
        fontFamily: '"Noto Sans Thai", "Sarabun", -apple-system, sans-serif',
        fontSize: 14,
      }}
    >
      {bubble.hero && renderHero(bubble.hero)}
      {bubble.header && (
        <div style={{ background: headerBg, borderBottom: '1px solid rgba(0,0,0,0.06)' }}>
          {renderBox(bubble.header)}
        </div>
      )}
      {bubble.body && (
        <div style={{ background: bodyBg }}>
          {renderBox(bubble.body)}
        </div>
      )}
      {bubble.footer && (
        <div style={{ background: footerBg, borderTop: '1px solid #f0f0f0' }}>
          {renderBox(bubble.footer)}
        </div>
      )}
    </div>
  )
}

// ─── Hero ────────────────────────────────────────────────────────────────────
function renderHero(hero: FlexContent): React.ReactNode {
  if (hero.type === 'image') {
    const ar = hero.aspectRatio ? hero.aspectRatio.replace(':', ' / ') : '20 / 13'
    return (
      <div style={{ width: '100%', aspectRatio: ar, overflow: 'hidden', position: 'relative' }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={hero.url}
          alt=""
          style={{ width: '100%', height: '100%', objectFit: hero.aspectMode ?? 'cover', display: 'block' }}
        />
      </div>
    )
  }
  if (hero.type === 'box') return renderBox(hero)
  return null
}

// ─── Box ─────────────────────────────────────────────────────────────────────
function renderBox(box: FlexContent): React.ReactNode {
  if (!box || box.type !== 'box') return renderContent(box)

  const layout     = box.layout || 'vertical'
  const spacing    = parsePx(box.spacing)
  const bg         = box.backgroundColor || 'transparent'
  const radius     = box.cornerRadius ? parsePx(box.cornerRadius) : undefined
  const borderW    = box.borderWidth ? parsePx(box.borderWidth) : 0
  const borderC    = box.borderColor  || 'transparent'
  const marginTop  = parsePx(box.margin)

  // Fixed width / height
  const fixedW = box.width  ? parsePx(box.width)  || box.width  : undefined
  const fixedH = box.height ? parsePx(box.height) || box.height : undefined

  const padStyle   = parsePadding(box)

  const style: React.CSSProperties = {
    display:        'flex',
    flexDirection:  layout === 'vertical' ? 'column' : 'row',
    gap:            spacing,
    backgroundColor: bg,
    borderRadius:   radius,
    border:         borderW ? `${borderW}px solid ${borderC}` : undefined,
    marginTop:      marginTop || undefined,
    alignItems:     (alignMap[box.alignItems]   as any) || undefined,
    justifyContent: (justifyMap[box.justifyContent] as any) || undefined,
    flex:           box.flex !== undefined ? box.flex : undefined,
    width:          fixedW,
    height:         fixedH,
    minWidth:       0,
    overflow:       'hidden',
    flexShrink:     box.flex === 0 ? 0 : undefined,
    ...padStyle,
  }

  return (
    <div style={style}>
      {Array.isArray(box.contents)
        ? box.contents.map((item: FlexContent, i: number) => (
            <React.Fragment key={i}>{renderContent(item)}</React.Fragment>
          ))
        : null}
    </div>
  )
}

// ─── Content dispatcher ──────────────────────────────────────────────────────
function renderContent(content: FlexContent): React.ReactNode {
  if (!content) return null
  switch (content.type) {
    case 'box':       return renderBox(content)
    case 'text':      return renderText(content)
    case 'image':     return renderImage(content)
    case 'button':    return renderButton(content)
    case 'separator': return renderSeparator(content)
    case 'spacer':    return <div style={{ height: spacingMap[content.size || 'md'] ?? 12 }} />
    case 'filler':    return <div style={{ flex: 1 }} />
    default:          return null
  }
}

// ─── Text ────────────────────────────────────────────────────────────────────
function renderText(t: FlexContent): React.ReactNode {
  const fontSize   = textSizeMap[t.size || 'md'] ?? 14
  const fontWeight = t.weight === 'bold' ? 700 : 400
  const color      = t.color || '#333333'
  const align      = t.align || 'start'
  const wrap       = t.wrap !== false
  const marginTop  = parsePx(t.margin)

  return (
    <div
      style={{
        fontSize,
        fontWeight,
        color,
        textAlign:      align as any,
        marginTop:      marginTop || undefined,
        lineHeight:     1.45,
        textDecoration: t.decoration === 'line-through' ? 'line-through' : undefined,
        whiteSpace:     wrap ? 'pre-wrap' : 'nowrap',
        overflow:       wrap ? 'visible' : 'hidden',
        textOverflow:   wrap ? undefined : 'ellipsis',
        flex:           t.flex !== undefined ? t.flex : undefined,
        flexShrink:     t.flex === 0 ? 0 : undefined,
      }}
    >
      {t.text || ''}
    </div>
  )
}

// ─── Image — supports fixed `size` (e.g. '28px') as well as aspect-ratio mode ──
function renderImage(img: FlexContent): React.ReactNode {
  const marginTop = parsePx(img.margin)
  const fixedPx   = img.size ? parsePx(img.size) : 0   // e.g. size='28px'

  // Fixed-size image (logo, icon)
  if (fixedPx > 0) {
    return (
      <div
        style={{
          width:      fixedPx,
          height:     fixedPx,
          flexShrink: 0,
          marginTop:  marginTop || undefined,
          display:    'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow:   'hidden',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt=""
          style={{
            width:      '100%',
            height:     '100%',
            objectFit:  img.aspectMode === 'fit' ? 'contain' : 'cover',
            display:    'block',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </div>
    )
  }

  // Aspect-ratio image (hero, product photo, QR)
  const ar = img.aspectRatio ? img.aspectRatio.replace(':', ' / ') : '1 / 1'
  return (
    <div
      style={{
        marginTop:  marginTop || undefined,
        flex:       img.flex !== undefined ? img.flex : undefined,
        width:      '100%',
      }}
    >
      <div style={{ width: '100%', aspectRatio: ar, overflow: 'hidden', borderRadius: 6 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={img.url}
          alt=""
          style={{
            width:     '100%',
            height:    '100%',
            objectFit: img.aspectMode ?? 'cover',
            display:   'block',
          }}
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </div>
    </div>
  )
}

// ─── Separator ───────────────────────────────────────────────────────────────
function renderSeparator(sep: FlexContent): React.ReactNode {
  const marginTop = parsePx(sep.margin)
  const color     = sep.color || '#e2e8f0'
  return (
    <div
      style={{
        height:     1,
        background: color,
        width:      '100%',
        marginTop:  marginTop || undefined,
        flexShrink: 0,
      }}
    />
  )
}

// ─── Button ──────────────────────────────────────────────────────────────────
function renderButton(btn: FlexContent): React.ReactNode {
  const style     = btn.style || 'link'
  const height    = btn.height || 'md'
  const color     = btn.color || '#06C755'
  const marginTop = parsePx(btn.margin)
  const paddingY  = height === 'sm' ? 7 : height === 'lg' ? 14 : 10

  let bg        = 'transparent'
  let textColor = color
  let border    = '1.5px solid transparent'

  if (style === 'primary') { bg = color; textColor = '#ffffff' }
  else if (style === 'secondary') { bg = '#f0f0f0'; textColor = '#555555' }
  else if (style === 'outline') { border = `1.5px solid ${color}`; textColor = color }

  return (
    <button
      type="button"
      style={{
        width:        '100%',
        marginTop:    marginTop || undefined,
        padding:      `${paddingY}px 14px`,
        borderRadius: 8,
        border,
        background:   bg,
        color:        textColor,
        fontSize:     13,
        fontWeight:   600,
        cursor:       'default',
        letterSpacing: 0.2,
      }}
    >
      {btn.action?.label || btn.label || 'Button'}
    </button>
  )
}

// ─── Public export ───────────────────────────────────────────────────────────
export function FlexPreview({ flex }: { flex: FlexContent | null }) {
  const normalized = normalizeFlex(flex)
  if (!normalized) {
    return <div style={{ fontSize: 12, color: '#6b7280' }}>ไม่สามารถแสดง Flex preview</div>
  }

  if (normalized.type === 'carousel') {
    const bubbles: FlexContent[] = Array.isArray(normalized.contents) ? normalized.contents : []
    const firstSize = bubbles[0]?.size || 'mega'
    const w = bubbleWidthMap[firstSize] ?? bubbleWidthMap.mega
    return (
      <FlexFrame bubbleWidth={w * bubbles.length}>
        <div
          style={{
            display:          'flex',
            gap:              10,
            overflowX:        'auto',
            paddingBottom:    6,
            scrollSnapType:   'x mandatory',
          }}
        >
          {bubbles.map((bubble, i) => (
            <div key={i} style={{ flexShrink: 0, width: w, scrollSnapAlign: 'start' }}>
              <BubbleShell bubble={bubble} />
            </div>
          ))}
        </div>
      </FlexFrame>
    )
  }

  if (normalized.type === 'bubble') {
    const w = bubbleWidthMap[normalized.size || 'mega'] ?? bubbleWidthMap.mega
    return (
      <FlexFrame bubbleWidth={w}>
        <BubbleShell bubble={normalized} />
      </FlexFrame>
    )
  }

  return <div style={{ fontSize: 12, color: '#6b7280' }}>ไม่รองรับรูปแบบนี้</div>
}
