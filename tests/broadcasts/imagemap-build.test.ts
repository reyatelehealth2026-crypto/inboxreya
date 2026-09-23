import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

// broadcast-runtime → @/lib/prisma; ถ้าไม่ mock จะสร้าง Prisma Client จริง แล้วหา
// query engine ไม่เจอบนเครื่อง dev (schema.prisma ปัก binaryTargets ไว้เฉพาะ linux)
vi.mock('@/lib/prisma', () => ({
  default: {},
  prisma: {},
}))

import {
  buildBroadcastMessages,
  buildBroadcastEnvelope,
  parseStoredBroadcast,
  personalizeMessages,
  summarizeBroadcastForList,
} from '@/lib/broadcast-runtime'
import { verifyLink } from '@/lib/broadcast-link'

const ORIGIN = 'https://inbox.example.com'
const SECRET = 'test-secret-for-imagemap-build-tests'

const region = (over: Record<string, unknown> = {}) => ({
  x: 0,
  y: 0,
  w: 520,
  h: 400,
  url: 'https://inbox.example.com/promo?k=SOS',
  ...over,
})

const imagemap = (over: Record<string, unknown> = {}) => ({
  baseKey: 'signed-base-key',
  width: 1040,
  height: 800,
  altText: 'โปรโมชั่นประจำวัน',
  regions: [region(), region({ x: 520, url: 'https://example.com/product/1' })],
  ...over,
})

beforeEach(() => {
  process.env.BROADCAST_LINK_SECRET = SECRET
  process.env.NEXT_PUBLIC_APP_URL = ORIGIN
})

afterEach(() => {
  delete process.env.BROADCAST_LINK_SECRET
  delete process.env.NEXT_PUBLIC_APP_URL
})

describe('buildBroadcastMessages - imagemap', () => {
  it('builds the LINE imagemap message shape', () => {
    const built = buildBroadcastMessages({ imagemap: imagemap() })

    expect(built.messageType).toBe('imagemap')
    expect(built.messages).toHaveLength(1)
    expect(built.messages[0]).toEqual({
      type: 'imagemap',
      baseUrl: `${ORIGIN}/api/imagemap/signed-base-key`,
      altText: 'โปรโมชั่นประจำวัน',
      baseSize: { width: 1040, height: 800 },
      actions: [
        {
          type: 'uri',
          linkUri: 'https://inbox.example.com/promo?k=SOS',
          area: { x: 0, y: 0, width: 520, height: 400 },
        },
        {
          type: 'uri',
          linkUri: 'https://example.com/product/1',
          area: { x: 520, y: 0, width: 520, height: 400 },
        },
      ],
    })
    expect(built.imagemapMeta).toEqual({
      baseKey: 'signed-base-key',
      regions: imagemap().regions,
    })
  })

  it('appends one flex and a closing text, staying within the 5-payload limit', () => {
    const built = buildBroadcastMessages({
      imagemap: imagemap(),
      flexContent: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
      content: 'สนใจสอบถามได้เลยค่ะ',
    })

    expect(built.messages.map((m) => m.type)).toEqual(['imagemap', 'flex', 'text'])
    expect(built.messages.length).toBeLessThanOrEqual(5)
    expect(built.summaryText).toBe('สนใจสอบถามได้เลยค่ะ')
  })

  it('rejects more than 50 regions (LINE limit)', () => {
    const regions = Array.from({ length: 51 }, (_, i) => region({ x: 0, y: i * 10, w: 100, h: 10 }))
    expect(() => buildBroadcastMessages({ imagemap: imagemap({ regions }) })).toThrow()
  })

  it('rejects a region that leaves the image', () => {
    expect(() =>
      buildBroadcastMessages({ imagemap: imagemap({ regions: [region({ x: 600, w: 500 })] }) })
    ).toThrow()
    expect(() =>
      buildBroadcastMessages({ imagemap: imagemap({ regions: [region({ y: 700, h: 200 })] }) })
    ).toThrow()
  })

  it('rejects a non-https destination url', () => {
    expect(() =>
      buildBroadcastMessages({ imagemap: imagemap({ regions: [region({ url: 'http://example.com' })] }) })
    ).toThrow()
  })
})

describe('envelope round trip', () => {
  it('stores imagemapMeta at the top level and survives parseStoredBroadcast', () => {
    const envelope = buildBroadcastEnvelope({ imagemap: imagemap(), targetTagIds: [7] })
    const stored = JSON.stringify(envelope)

    // T5 reads the meta straight off the parsed content.
    expect(JSON.parse(stored).imagemapMeta.regions[1].url).toBe('https://example.com/product/1')

    const parsed = parseStoredBroadcast(stored)
    expect(parsed.messageType).toBe('imagemap')
    expect(parsed.imagemapMeta?.baseKey).toBe('signed-base-key')
    expect(parsed.target).toEqual({ mode: 'tags', tagIds: [7] })
  })

  it('summarizes the list thumbnail as the 460px size', () => {
    const stored = JSON.stringify(buildBroadcastEnvelope({ imagemap: imagemap() }))
    const summary = summarizeBroadcastForList({ content: stored })

    expect(summary.messageType).toBe('imagemap')
    expect(summary.mediaUrl).toBe(`${ORIGIN}/api/imagemap/signed-base-key/460`)
  })
})

describe('personalizeMessages', () => {
  it('rewrites only imagemap actions and the tokens verify back to {b,r,u}', () => {
    const built = buildBroadcastMessages({ imagemap: imagemap(), content: 'ปิดท้าย' })
    const personalized = personalizeMessages(built.messages, 55, 91)

    const actions = personalized[0].actions as Array<{ linkUri: string; area: unknown }>
    expect(actions).toHaveLength(2)
    actions.forEach((action, index) => {
      expect(action.linkUri.startsWith(`${ORIGIN}/r/`)).toBe(true)
      expect(verifyLink(action.linkUri.slice(`${ORIGIN}/r/`.length))).toEqual({ b: 55, r: index, u: 91 })
    })
    // areas untouched
    expect(actions[1].area).toEqual({ x: 520, y: 0, width: 520, height: 400 })

    // closing text passed through untouched, originals not mutated
    expect(personalized[1]).toEqual({ type: 'text', text: 'ปิดท้าย' })
    expect((built.messages[0].actions as Array<{ linkUri: string }>)[0].linkUri).toBe(
      'https://inbox.example.com/promo?k=SOS'
    )
  })

  it('signs u=0 for the anonymous broadcast path', () => {
    const built = buildBroadcastMessages({ imagemap: imagemap() })
    const actions = personalizeMessages(built.messages, 3, 0)[0].actions as Array<{ linkUri: string }>
    expect(verifyLink(actions[0].linkUri.split('/r/')[1])).toEqual({ b: 3, r: 0, u: 0 })
  })

  it('is a no-op for non-imagemap messages', () => {
    const text = buildBroadcastMessages({ content: 'hello' })
    expect(personalizeMessages(text.messages, 1, 2)).toEqual(text.messages)

    const image = buildBroadcastMessages({ mediaUrl: 'https://cdn.example.com/a.jpg' })
    expect(personalizeMessages(image.messages, 1, 2)).toEqual(image.messages)
  })
})

describe('flex link tracking', () => {
  const flexCarousel = {
    type: 'carousel',
    contents: [
      {
        type: 'bubble',
        hero: { type: 'image', url: 'https://cdn.example.com/a.png', action: { type: 'uri', uri: 'https://shop.example.com/p/1' } },
        footer: {
          type: 'box',
          layout: 'vertical',
          contents: [
            { type: 'box', layout: 'vertical', action: { type: 'uri', label: 'ดูโปร', uri: 'https://shop.example.com/p/1' }, contents: [] },
            { type: 'box', layout: 'vertical', action: { type: 'uri', label: 'แชท', uri: 'https://line.me/R/oaMessage/@x/?hi' }, contents: [] },
            { type: 'button', action: { type: 'uri', label: 'ทั้งหมด', uri: `${ORIGIN}/promo` } },
          ],
        },
      },
    ],
  }

  it('records each distinct https link once, skipping LINE deep links', () => {
    const built = buildBroadcastMessages({ flexContents: [flexCarousel] })
    expect(built.flexLinks).toEqual(['https://shop.example.com/p/1', `${ORIGIN}/promo`])
    expect(buildBroadcastEnvelope({ flexContents: [flexCarousel] }).flexLinks).toEqual(built.flexLinks)
  })

  it('rewrites tracked flex links to /r/ tokens numbered after the imagemap regions', () => {
    const built = buildBroadcastMessages({ imagemap: imagemap(), flexContent: flexCarousel })
    const personalized = personalizeMessages(built.messages, 9, 4, built.flexLinks)
    const bubble = (personalized[1].contents as { contents: Array<Record<string, any>> }).contents[0]

    const heroUri = bubble.hero.action.uri as string
    const [pill, chat, all] = bubble.footer.contents
    expect(verifyLink(heroUri.split('/r/')[1])).toEqual({ b: 9, r: 2, u: 4 })
    expect(pill.action.uri).toBe(heroUri)
    expect(verifyLink((all.action.uri as string).split('/r/')[1])).toEqual({ b: 9, r: 3, u: 4 })
    expect(chat.action.uri).toBe('https://line.me/R/oaMessage/@x/?hi')
    // the stored message is untouched
    expect((built.messages[1].contents as any).contents[0].hero.action.uri).toBe('https://shop.example.com/p/1')
  })

  it('leaves flex messages alone when nothing is tracked', () => {
    const built = buildBroadcastMessages({ flexContents: [flexCarousel] })
    expect(personalizeMessages(built.messages, 1, 2)).toEqual(built.messages)
  })

  it('round-trips flexLinks through the stored envelope', () => {
    const envelope = buildBroadcastEnvelope({ flexContents: [flexCarousel] })
    expect(parseStoredBroadcast(JSON.stringify(envelope)).flexLinks).toEqual(envelope.flexLinks)
  })
})

describe('existing broadcast types are unchanged', () => {
  it('text / image / video / flex still build as before', () => {
    expect(buildBroadcastMessages({ content: 'hi' })).toMatchObject({
      messageType: 'text',
      messages: [{ type: 'text', text: 'hi' }],
    })
    expect(buildBroadcastMessages({ mediaUrl: 'https://cdn.example.com/a.jpg' }).messageType).toBe('image')
    expect(
      buildBroadcastMessages({ mediaUrl: 'https://cdn.example.com/a.mp4', messageType: 'video' }).messageType
    ).toBe('video')

    const flex = buildBroadcastMessages({
      flexContent: { type: 'bubble', body: { type: 'box', layout: 'vertical', contents: [] } },
    })
    expect(flex.messageType).toBe('flex')
    expect(flex.imagemapMeta).toBeUndefined()
  })
})
