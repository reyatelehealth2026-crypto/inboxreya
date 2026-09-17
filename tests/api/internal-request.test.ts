import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { NextRequest } from 'next/server'
import { isInternalRequest } from '@/lib/api-utils'

const SECRET = 'test-secret-0123456789'
const request = (headers: Record<string, string>) =>
  new NextRequest('https://inbox.example.test/api/inbox/conversations', { headers })

describe('isInternalRequest', () => {
  const original = process.env.INTERNAL_API_SECRET
  beforeEach(() => {
    process.env.INTERNAL_API_SECRET = SECRET
  })
  afterEach(() => {
    process.env.INTERNAL_API_SECRET = original
  })

  it('no longer trusts the bare flag anyone on the internet can send', () => {
    expect(isInternalRequest(request({ 'x-internal-request': 'true' }))).toBe(false)
  })

  it('accepts the shared secret', () => {
    expect(isInternalRequest(request({ 'x-internal-secret': SECRET }))).toBe(true)
  })

  it('rejects a wrong or truncated secret', () => {
    expect(isInternalRequest(request({ 'x-internal-secret': 'nope' }))).toBe(false)
    expect(isInternalRequest(request({ 'x-internal-secret': SECRET.slice(0, -1) }))).toBe(false)
  })

  it('fails closed when the server has no secret configured', () => {
    delete process.env.INTERNAL_API_SECRET
    expect(isInternalRequest(request({ 'x-internal-secret': '' }))).toBe(false)
    expect(isInternalRequest(request({ 'x-internal-secret': 'undefined' }))).toBe(false)
  })
})
