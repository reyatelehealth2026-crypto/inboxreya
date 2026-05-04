import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { auth } from '@/lib/auth'

const publicRoutes = [
  '/auth/login',
  '/auth/register',
  '/auth/error',
  '/api/auth',
  '/api/webhook',
  '/api/health',
]

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (publicRoutes.some(route => pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const session = await auth()

  if (!session?.user) {
    if (pathname.startsWith('/api/')) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }

    const loginUrl = new URL('/auth/login', request.url)
    loginUrl.searchParams.set('callbackUrl', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (pathname.startsWith('/api/')) {
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', session.user.id)
    requestHeaders.set('x-user-role', session.user.role || '')
    requestHeaders.set('x-line-account-id', String(session.user.lineAccountId || ''))

    return NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  // Skip middleware (which calls auth() = DB hit) on:
  // - Next internals & static
  // - Public/unauthenticated APIs (auth/webhook/health/cron)
  // - Static asset paths and common file extensions (icons, uploads, fonts, images, css, js, maps)
  matcher: [
    '/((?!_next/static|_next/image|_next/data|favicon\\.ico|robots\\.txt|sitemap\\.xml|manifest\\.json|api/auth|api/webhook|api/health|api/cron|icons/|uploads/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff2?|ttf|eot|otf|mp4|webm|map)$).*)',
  ],
}
