import { describe, expect, it } from 'vitest'
import { mergeSlipMetadata, type SlipMark } from './slip-mark'

/**
 * `Message.metadata` is a single JSON column shared by the quote reply, the LINE
 * message id and flex payloads. Writing the slip mark over any of them breaks
 * how that message renders in chat, so the merge gets its own cover.
 */

const MARK: SlipMark = {
  verified: true,
  bdoId: 123,
  invoiceId: null,
  bdoName: 'BDO-TEST-0001',
  amount: 1500,
  ref: 'TESTREF0001',
  points: 1,
  at: '2026-08-22T03:30:00.000Z',
}

describe('mergeSlipMetadata', () => {
  it('keeps existing keys the chat view depends on', () => {
    const existing = JSON.stringify({
      quotedMessageId: 'QUOTED-1',
      lineMessageId: 'LINE-1',
      flexContent: { type: 'bubble' },
    })

    const merged = JSON.parse(mergeSlipMetadata(existing, MARK))

    expect(merged.quotedMessageId).toBe('QUOTED-1')
    expect(merged.lineMessageId).toBe('LINE-1')
    expect(merged.flexContent).toEqual({ type: 'bubble' })
    expect(merged.slip.bdoName).toBe('BDO-TEST-0001')
  })

  it('writes the mark when there is no metadata yet', () => {
    const merged = JSON.parse(mergeSlipMetadata(null, MARK))

    expect(merged.slip.verified).toBe(true)
    expect(merged.slip.points).toBe(1)
  })

  it('replaces an older mark rather than nesting a second one', () => {
    const first = mergeSlipMetadata(null, { ...MARK, points: 0, ref: 'OLDREF' })
    const second = JSON.parse(mergeSlipMetadata(first, MARK))

    expect(second.slip.ref).toBe('TESTREF0001')
    expect(second.slip.points).toBe(1)
  })

  it('preserves unparseable metadata instead of destroying it', () => {
    const merged = JSON.parse(mergeSlipMetadata('not json at all', MARK))

    expect(merged._raw).toBe('not json at all')
    expect(merged.slip.verified).toBe(true)
  })

  it('does not treat a JSON array as an object to spread', () => {
    const merged = JSON.parse(mergeSlipMetadata('[1,2,3]', MARK))

    expect(merged.slip.verified).toBe(true)
    expect(Array.isArray(merged)).toBe(false)
  })
})
