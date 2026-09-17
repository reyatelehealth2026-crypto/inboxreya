import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { signLink, verifyLink, signValue, verifyValue } from '@/lib/broadcast-link'

const SECRET = 'test-secret-for-broadcast-link-tests-xyz'

beforeEach(() => {
  process.env.BROADCAST_LINK_SECRET = SECRET
})

afterEach(() => {
  delete process.env.BROADCAST_LINK_SECRET
})

describe('signLink / verifyLink', () => {
  it('roundtrip: signed token verifies back to the same payload', () => {
    const p = { b: 42, r: 3, u: 7 }
    const token = signLink(p)
    expect(verifyLink(token)).toEqual(p)
  })

  it('u=0 roundtrip (anonymous)', () => {
    const p = { b: 1, r: 0, u: 0 }
    const token = signLink(p)
    expect(verifyLink(token)).toEqual(p)
  })

  it('tampered payload returns null', () => {
    const token = signLink({ b: 1, r: 0, u: 1 })
    const [, sig] = token.split('.')
    const fakePayload = Buffer.from(JSON.stringify({ b: 99, r: 0, u: 1 })).toString('base64url')
    expect(verifyLink(`${fakePayload}.${sig}`)).toBeNull()
  })

  it('tampered signature returns null', () => {
    const token = signLink({ b: 1, r: 0, u: 1 })
    const [payload] = token.split('.')
    // 43 chars = valid base64url length for 32-byte HMAC, but wrong value
    const badSig = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA'
    expect(verifyLink(`${payload}.${badSig}`)).toBeNull()
  })

  it('garbage token returns null', () => {
    expect(verifyLink('not-a-valid-token')).toBeNull()
    expect(verifyLink('')).toBeNull()
    expect(verifyLink('a.b.c')).toBeNull()
  })

  it('throws when BROADCAST_LINK_SECRET is missing', () => {
    delete process.env.BROADCAST_LINK_SECRET
    expect(() => signLink({ b: 1, r: 0, u: 0 })).toThrow(/BROADCAST_LINK_SECRET/)
    expect(() => verifyLink('anything')).toThrow(/BROADCAST_LINK_SECRET/)
  })
})

describe('signValue / verifyValue', () => {
  it('roundtrip: signed value verifies back', () => {
    const val = 'hello world 123'
    expect(verifyValue(signValue(val))).toBe(val)
  })

  it('tampered value returns null', () => {
    const token = signValue('original')
    const [, sig] = token.split('.')
    const fakePayload = Buffer.from('tampered').toString('base64url')
    expect(verifyValue(`${fakePayload}.${sig}`)).toBeNull()
  })

  it('garbage token returns null', () => {
    expect(verifyValue('no-dot')).toBeNull()
    expect(verifyValue('')).toBeNull()
  })
})
