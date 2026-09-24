import { describe, it, expect } from 'vitest'
import { describeDelivery } from './message-delivery'

describe('describeDelivery', () => {
  it('failed when sendError is recorded, even if a lineMessageId exists', () => {
    const d = describeDelivery({ sendError: 'fetch failed', lineMessageId: '1' })
    expect(d.state).toBe('failed')
    expect(d.title).toContain('fetch failed')
  })

  it('delivered when LINE returned a message id', () => {
    expect(describeDelivery({ lineMessageId: '628233816662082170' }).state).toBe('delivered')
  })

  it('saved (unconfirmed) when there is no metadata', () => {
    expect(describeDelivery(null).state).toBe('saved')
    expect(describeDelivery(undefined).state).toBe('saved')
    expect(describeDelivery({}).state).toBe('saved')
  })
})
