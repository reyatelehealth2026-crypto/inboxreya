import React from 'react'
import Image from 'next/image'

type FlexContent = Record<string, any>

const bubbleWidthMap: Record<string, number> = {
  nano: 120,
  micro: 160,
  deca: 200,
  hecto: 220,
  kilo: 260,
  mega: 300,
  giga: 340,
}

const spacingMap: Record<string, number> = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
}

const textSizeMap: Record<string, number> = {
  xxs: 9,
  xs: 10,
  sm: 12,
  md: 14,
  lg: 16,
  xl: 18,
  xxl: 20,
  '3xl': 24,
  '4xl': 28,
  '5xl': 32,
}

const alignMap: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
}

const justifyMap: Record<string, string> = {
  start: 'flex-start',
  center: 'center',
  end: 'flex-end',
  spaceBetween: 'space-between',
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

function FlexFrame({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        background: 'linear-gradient(135deg, #7494a5 0%, #5a7a8a 100%)',
        padding: 12,
        borderRadius: 12,
        overflow: 'hidden',
        maxWidth: '100%',
      }}
    >
      {children}
    </div>
  )
}

function BubbleShell({ bubble }: { bubble: FlexContent }) {
  const size = bubble.size || 'mega'
  const width = bubbleWidthMap[size] ?? bubbleWidthMap.mega
  return (
    <div
      style={{
        width,
        background: '#ffffff',
        borderRadius: 16,
        overflow: 'hidden',
        flexShrink: 0,
        scrollSnapAlign: 'start',
        boxShadow: '0 2px 10px rgba(0,0,0,0.12)',
      }}
    >
      {bubble.hero && <div>{renderHero(bubble.hero)}</div>}
      {bubble.header && (
        <div style={{ padding: '12px 16px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
          {renderBox(bubble.header)}
        </div>
      )}
      {bubble.body && <div style={{ padding: '12px 16px' }}>{renderBox(bubble.body)}</div>}
      {bubble.footer && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid #e2e8f0' }}>{renderBox(bubble.footer)}</div>
      )}
    </div>
  )
}

function renderHero(hero: FlexContent) {
  if (hero.type === 'image') {
    const aspectRatio = hero.aspectRatio ? hero.aspectRatio.replace(':', ' / ') : '20 / 13'
    return (
      <div
        style={{
          width: '100%',
          aspectRatio,
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Image
          src={hero.url}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          style={{ objectFit: hero.aspectMode || 'cover' }}
        />
      </div>
    )
  }
  if (hero.type === 'box') {
    return renderBox(hero)
  }
  return null
}

function renderBox(box: FlexContent): React.ReactNode {
  if (!box || box.type !== 'box') {
    return renderContent(box)
  }

  const layout = box.layout || 'vertical'
  const spacing = spacingMap[box.spacing || 'none'] ?? 0
  const padding = spacingMap[box.paddingAll || 'none'] ?? 0
  const backgroundColor = box.backgroundColor || 'transparent'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: layout === 'vertical' ? 'column' : 'row',
        gap: spacing,
        padding,
        backgroundColor,
        alignItems: alignMap[box.alignItems] || undefined,
        justifyContent: justifyMap[box.justifyContent] || undefined,
        flex: box.flex !== undefined ? box.flex : undefined,
      }}
    >
      {Array.isArray(box.contents) ? box.contents.map((item, index) => (
        <React.Fragment key={index}>{renderContent(item)}</React.Fragment>
      )) : null}
    </div>
  )
}

function renderContent(content: FlexContent): React.ReactNode {
  if (!content) return null

  switch (content.type) {
    case 'box':
      return renderBox(content)
    case 'text':
      return renderText(content)
    case 'image':
      return renderImage(content)
    case 'button':
      return renderButton(content)
    case 'separator':
      return <div style={{ height: 1, background: '#e2e8f0', width: '100%' }} />
    case 'spacer':
      return <div style={{ height: spacingMap[content.size || 'md'] ?? 12 }} />
    case 'filler':
      return <div style={{ flex: 1 }} />
    default:
      return null
  }
}

function renderText(text: FlexContent) {
  const size = textSizeMap[text.size || 'md'] ?? 14
  const weight = text.weight === 'bold' ? 700 : 400
  const color = text.color || '#333333'
  const align = text.align || 'start'
  const wrap = text.wrap !== false
  const marginTop = spacingMap[text.margin || 'none'] ?? 0
  const decoration = text.decoration === 'line-through' ? 'line-through' : 'none'

  return (
    <div
      style={{
        fontSize: size,
        fontWeight: weight,
        color,
        textAlign: align,
        marginTop,
        lineHeight: 1.4,
        textDecoration: decoration,
        whiteSpace: wrap ? 'pre-wrap' : 'nowrap',
        overflow: wrap ? 'visible' : 'hidden',
        textOverflow: wrap ? 'clip' : 'ellipsis',
        flex: text.flex !== undefined ? text.flex : undefined,
      }}
    >
      {text.text || ''}
    </div>
  )
}

function renderImage(img: FlexContent) {
  const aspectRatio = img.aspectRatio ? img.aspectRatio.replace(':', ' / ') : '1 / 1'
  const marginTop = spacingMap[img.margin || 'none'] ?? 0
  return (
    <div
      style={{
        marginTop,
        flex: img.flex !== undefined ? img.flex : undefined,
      }}
    >
      <div
        style={{
          width: '100%',
          aspectRatio,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 8,
        }}
      >
        <Image
          src={img.url}
          alt=""
          fill
          sizes="100vw"
          unoptimized
          style={{ objectFit: img.aspectMode || 'cover' }}
          onError={(event) => {
            const target = event.currentTarget as HTMLImageElement
            target.src = 'https://via.placeholder.com/100?text=No+Image'
          }}
        />
      </div>
    </div>
  )
}

function renderButton(btn: FlexContent) {
  const style = btn.style || 'link'
  const height = btn.height || 'md'
  const color = btn.color || '#06C755'
  const marginTop = spacingMap[btn.margin || 'none'] ?? 0
  const paddingY = height === 'sm' ? 6 : height === 'lg' ? 12 : 8

  let background = 'transparent'
  let textColor = color
  let border = '1px solid transparent'

  if (style === 'primary') {
    background = color
    textColor = '#ffffff'
  } else if (style === 'secondary') {
    background = '#e0e0e0'
    textColor = '#333333'
  } else if (style === 'link') {
    border = '1px solid transparent'
  }

  return (
    <button
      type="button"
      style={{
        width: '100%',
        marginTop,
        padding: `${paddingY}px 12px`,
        borderRadius: 8,
        border,
        background,
        color: textColor,
        fontSize: 12,
        cursor: 'default',
      }}
    >
      {btn.action?.label || btn.label || 'Button'}
    </button>
  )
}

export function FlexPreview({ flex }: { flex: FlexContent | null }) {
  const normalized = normalizeFlex(flex)
  if (!normalized) {
    return <div style={{ fontSize: 12, color: '#6b7280' }}>ไม่สามารถแสดง Flex preview</div>
  }

  if (normalized.type === 'carousel') {
    const bubbles = Array.isArray(normalized.contents) ? normalized.contents : []
    return (
      <FlexFrame>
        <div
          style={{
            display: 'flex',
            gap: 10,
            overflowX: 'auto',
            paddingBottom: 8,
            scrollSnapType: 'x mandatory',
          }}
        >
          {bubbles.map((bubble: FlexContent, index: number) => (
            <BubbleShell key={index} bubble={bubble} />
          ))}
        </div>
      </FlexFrame>
    )
  }

  if (normalized.type === 'bubble') {
    return (
      <FlexFrame>
        <div style={{ display: 'flex' }}>
          <BubbleShell bubble={normalized} />
        </div>
      </FlexFrame>
    )
  }

  return <div style={{ fontSize: 12, color: '#6b7280' }}>ไม่รองรับรูปแบบนี้</div>
}
