/**
 * SSO Token Verification Utilities
 * 
 * Verifies HMAC-SHA256 signed tokens from the PHP system
 * and creates NextAuth-compatible JWT sessions.
 */

import * as crypto from 'crypto'

/**
 * SSO Token Payload - data encoded in the token
 */
export interface SSOPayload {
    user_id: number
    username: string
    email: string
    role: string
    line_account_id: number
    iat: number  // issued at (unix timestamp)
    exp: number  // expiry (unix timestamp)
    nonce: string // unique nonce for replay protection
}

/**
 * In-memory nonce store to prevent replay attacks.
 * In production with multiple instances, consider using Redis or database.
 * Nonces are cleaned up after 5 minutes.
 */
const usedNonces = new Map<string, number>()

// Clean up expired nonces every 5 minutes
const NONCE_CLEANUP_INTERVAL = 5 * 60 * 1000
let cleanupTimer: NodeJS.Timeout | null = null

function startNonceCleanup() {
    if (cleanupTimer) return
    cleanupTimer = setInterval(() => {
        const cutoff = Date.now() - NONCE_CLEANUP_INTERVAL
        usedNonces.forEach((timestamp, nonce) => {
            if (timestamp < cutoff) {
                usedNonces.delete(nonce)
            }
        })
    }, NONCE_CLEANUP_INTERVAL)

    // Don't prevent process exit
    if (cleanupTimer.unref) {
        cleanupTimer.unref()
    }
}

/**
 * Verify an SSO token from the PHP system
 * 
 * @param token The SSO token (payload.signature format)
 * @returns The decoded payload if valid, null if invalid
 */
export function verifySSOToken(token: string): SSOPayload | null {
    const secretKey = process.env.SSO_SECRET_KEY

    if (!secretKey) {
        console.error('[SSO] SSO_SECRET_KEY environment variable is not set')
        return null
    }

    // Split token into payload and signature
    const dotIndex = token.lastIndexOf('.')
    if (dotIndex === -1) {
        console.error('[SSO] Invalid token format: no separator found')
        return null
    }

    const payloadBase64 = token.substring(0, dotIndex)
    const signature = token.substring(dotIndex + 1)

    // Verify HMAC-SHA256 signature
    const expectedSignature = crypto
        .createHmac('sha256', secretKey)
        .update(payloadBase64)
        .digest('hex')

    if (!crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
    )) {
        console.error('[SSO] Invalid token signature')
        return null
    }

    // Decode payload (URL-safe base64)
    let payload: SSOPayload
    try {
        // Restore standard base64 from URL-safe format
        let base64 = payloadBase64.replace(/-/g, '+').replace(/_/g, '/')
        // Add padding if needed
        const padding = base64.length % 4
        if (padding) {
            base64 += '='.repeat(4 - padding)
        }

        const payloadJson = Buffer.from(base64, 'base64').toString('utf-8')
        payload = JSON.parse(payloadJson)
    } catch (error) {
        console.error('[SSO] Failed to decode token payload:', error)
        return null
    }

    // Verify expiry
    const now = Math.floor(Date.now() / 1000)
    if (payload.exp < now) {
        console.error('[SSO] Token expired:', {
            exp: new Date(payload.exp * 1000).toISOString(),
            now: new Date(now * 1000).toISOString(),
        })
        return null
    }

    // Verify not issued in the future (with 5 second tolerance for clock skew)
    if (payload.iat > now + 5) {
        console.error('[SSO] Token issued in the future:', {
            iat: new Date(payload.iat * 1000).toISOString(),
            now: new Date(now * 1000).toISOString(),
        })
        return null
    }

    // Check nonce for replay protection
    if (!payload.nonce) {
        console.error('[SSO] Token missing nonce')
        return null
    }

    if (usedNonces.has(payload.nonce)) {
        console.error('[SSO] Token nonce already used (replay attack?)')
        return null
    }

    // Mark nonce as used
    usedNonces.set(payload.nonce, Date.now())
    startNonceCleanup()

    // Validate required fields
    if (!payload.user_id || !payload.username) {
        console.error('[SSO] Token missing required fields (user_id, username)')
        return null
    }

    console.log('[SSO] Token verified successfully for user:', payload.username)
    return payload
}
