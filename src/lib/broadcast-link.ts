import { createHmac, timingSafeEqual } from 'node:crypto'

export interface BroadcastLinkPayload {
  b: number // broadcastId
  r: number // regionIndex
  u: number // LineUser.id primary key; 0 = anonymous
}

function getSecret(): string {
  const secret = process.env.BROADCAST_LINK_SECRET
  if (!secret) {
    throw new Error('BROADCAST_LINK_SECRET environment variable is not set')
  }
  return secret
}

function hmacSign(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload).digest('base64url')
}

function verifySig(payload: string, sig: string, secret: string): boolean {
  const expected = hmacSign(payload, secret)
  try {
    const sigBuf = Buffer.from(sig, 'base64url')
    const expectedBuf = Buffer.from(expected, 'base64url')
    if (sigBuf.length !== expectedBuf.length) return false
    return timingSafeEqual(sigBuf, expectedBuf)
  } catch {
    return false
  }
}

export function signLink(p: BroadcastLinkPayload): string {
  const secret = getSecret()
  const payload = Buffer.from(JSON.stringify(p)).toString('base64url')
  const sig = hmacSign(payload, secret)
  return `${payload}.${sig}`
}

export function verifyLink(token: string): BroadcastLinkPayload | null {
  const secret = getSecret()
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts

  if (!verifySig(payload, sig, secret)) return null

  try {
    const p = JSON.parse(Buffer.from(payload, 'base64url').toString()) as unknown
    if (
      typeof p === 'object' &&
      p !== null &&
      'b' in p && 'r' in p && 'u' in p &&
      Number.isInteger((p as BroadcastLinkPayload).b) && (p as BroadcastLinkPayload).b > 0 &&
      Number.isInteger((p as BroadcastLinkPayload).r) && (p as BroadcastLinkPayload).r >= 0 &&
      Number.isInteger((p as BroadcastLinkPayload).u) && (p as BroadcastLinkPayload).u >= 0
    ) {
      return p as BroadcastLinkPayload
    }
  } catch {
    // malformed payload
  }
  return null
}

export function signValue(value: string): string {
  const secret = getSecret()
  const payload = Buffer.from(value).toString('base64url')
  const sig = hmacSign(payload, secret)
  return `${payload}.${sig}`
}

export function verifyValue(token: string): string | null {
  const secret = getSecret()
  const parts = token.split('.')
  if (parts.length !== 2) return null
  const [payload, sig] = parts

  if (!verifySig(payload, sig, secret)) return null

  try {
    return Buffer.from(payload, 'base64url').toString()
  } catch {
    return null
  }
}
