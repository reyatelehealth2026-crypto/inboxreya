/**
 * ปั้น token SSO ให้หลังบ้านขายส่ง (cny-wholesale-nuxt)
 *
 * คู่กับ server/utils/ssoToken.ts ฝั่งโน้น — รูปแบบเดียวกับที่ระบบ PHP ส่งเข้ามาที่
 * /api/auth/sso ของเรา: "<payload base64url>.<hex hmac-sha256>"
 *
 * อายุสั้นมากโดยตั้งใจ ตัว token ต้องเดินทางผ่าน query string ซึ่งไปโผล่ใน
 * access log และ Referer ได้ ฝั่งขายส่งปฏิเสธ token ที่อายุเกิน 120 วินาที
 * ค่าตรงนี้จึงต้องต่ำกว่านั้นเสมอ
 */

import { createHmac, randomUUID } from 'crypto'

export interface SSOSignInput {
    user_id: number
    username: string
    email?: string
    role?: string
}

/** อายุ token — ต้องน้อยกว่า MAX_LIFETIME_SEC (120) ของฝั่งขายส่ง */
export const SSO_TOKEN_TTL_SEC = 60

export function signSSOToken(input: SSOSignInput, secret: string): string {
    if (!secret) {
        throw new Error('SSO_SECRET_KEY is not configured')
    }

    const iat = Math.floor(Date.now() / 1000)
    const payload = {
        ...input,
        iat,
        exp: iat + SSO_TOKEN_TTL_SEC,
        nonce: randomUUID(),
    }

    const payloadB64 = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url')
    const signature = createHmac('sha256', secret).update(payloadB64).digest('hex')

    return `${payloadB64}.${signature}`
}
