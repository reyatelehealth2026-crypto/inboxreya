/**
 * SSO Authentication Endpoint
 * 
 * GET /api/auth/sso?token=xxx&redirect=/dashboard
 * 
 * Receives an HMAC-signed SSO token from the PHP system,
 * verifies it, looks up the user in the database,
 * creates a NextAuth JWT session cookie, and redirects.
 */

import { NextRequest, NextResponse } from 'next/server'
import { encode } from '@auth/core/jwt'
import { verifySSOToken } from '@/lib/sso'
import prisma from '@/lib/prisma'

// Cookie name used by NextAuth v5
// In production (HTTPS), it's prefixed with __Secure-
function getSessionCookieName(isSecure: boolean): string {
    return isSecure
        ? '__Secure-authjs.session-token'
        : 'authjs.session-token'
}

export async function GET(request: NextRequest) {
    const { searchParams } = request.nextUrl
    const token = searchParams.get('token')
    const redirectPath = searchParams.get('redirect') || '/dashboard'

    // Validate token parameter
    if (!token) {
        return NextResponse.json(
            { error: 'Missing SSO token' },
            { status: 400 }
        )
    }

    // Get auth secret
    const authSecret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET
    if (!authSecret) {
        console.error('[SSO] AUTH_SECRET or NEXTAUTH_SECRET is not configured')
        return NextResponse.json(
            { error: 'Server configuration error' },
            { status: 500 }
        )
    }

    // Verify the SSO token
    const payload = verifySSOToken(token)
    if (!payload) {
        // Token is invalid, expired, or replayed
        // Redirect to login page with error
        const loginUrl = new URL('/auth/login', request.url)
        loginUrl.searchParams.set('error', 'sso_token_invalid')
        loginUrl.searchParams.set('callbackUrl', redirectPath)
        return NextResponse.redirect(loginUrl)
    }

    try {
        // Look up the user in the database
        const user = await prisma.adminUser.findFirst({
            where: {
                id: payload.user_id,
                isActive: true,
            },
            include: {
                lineAccount: true,
            },
        })

        if (!user) {
            console.error('[SSO] User not found or inactive:', payload.user_id)
            const loginUrl = new URL('/auth/login', request.url)
            loginUrl.searchParams.set('error', 'sso_user_not_found')
            return NextResponse.redirect(loginUrl)
        }

        // Update last login
        await prisma.adminUser.update({
            where: { id: user.id },
            data: { lastLogin: new Date() },
        })

        // Create NextAuth-compatible JWT token
        // This matches the structure set in auth.ts callbacks.jwt
        const isSecure = request.url.startsWith('https')
        const cookieName = getSessionCookieName(isSecure)

        const sessionToken = await encode({
            token: {
                id: String(user.id),
                sub: String(user.id),
                name: user.displayName || user.username,
                email: user.email,
                picture: user.avatarUrl,
                role: user.role,
                lineAccountId: user.lineAccountId,
                iat: Math.floor(Date.now() / 1000),
                exp: Math.floor(Date.now() / 1000) + (30 * 24 * 60 * 60), // 30 days
            },
            secret: authSecret,
            salt: cookieName,
            maxAge: 30 * 24 * 60 * 60, // 30 days
        })

        // Create redirect response
        const redirectUrl = new URL(redirectPath, request.url)
        const response = NextResponse.redirect(redirectUrl)

        // Set the session cookie
        response.cookies.set(cookieName, sessionToken, {
            httpOnly: true,
            secure: isSecure,
            sameSite: 'lax',
            path: '/',
            maxAge: 30 * 24 * 60 * 60, // 30 days
        })

        console.log('[SSO] Successfully authenticated user:', user.username, '→ redirecting to:', redirectPath)

        return response
    } catch (error) {
        console.error('[SSO] Database error during SSO authentication:', error)
        return NextResponse.json(
            { error: 'Internal server error during SSO authentication' },
            { status: 500 }
        )
    }
}
