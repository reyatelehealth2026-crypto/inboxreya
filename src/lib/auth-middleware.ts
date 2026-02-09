import { NextRequest, NextResponse } from 'next/server'
import { auth } from './auth'

/**
 * Auth middleware for API routes
 * Ensures user is authenticated before accessing protected routes
 */
export async function requireAuth(request: NextRequest) {
  try {
    const session = await auth()
    
    console.log('[requireAuth] Session:', session ? 'exists' : 'null')
    console.log('[requireAuth] User:', session?.user ? JSON.stringify(session.user) : 'null')
    
    if (!session || !session.user) {
      console.log('[requireAuth] No session or user, returning 401')
      return NextResponse.json(
        { success: false, error: 'Unauthorized - Please log in' },
        { status: 401 }
      )
    }
    
    // If user doesn't have lineAccountId, assign default (3)
    // This is a fallback for super_admin or users without assigned accounts
    // Changed from 1 to 3 because all templates are in account 3
    if (!session.user.lineAccountId || session.user.lineAccountId === 0) {
      console.log('[requireAuth] User missing lineAccountId, setting to 3 (default account)')
      session.user.lineAccountId = 3
    }
    
    console.log('[requireAuth] Auth successful, lineAccountId:', session.user.lineAccountId)
    return { session, user: session.user }
  } catch (error) {
    console.error('[requireAuth] Error:', error)
    return NextResponse.json(
      { success: false, error: 'Authentication error' },
      { status: 500 }
    )
  }
}

/**
 * Role-based authorization middleware
 * Ensures user has required role to access route
 */
export async function requireRole(
  request: NextRequest,
  allowedRoles: string[]
) {
  const authResult = await requireAuth(request)
  
  // If requireAuth returned a response (error), return it
  if (authResult instanceof NextResponse) {
    return authResult
  }
  
  const { user } = authResult
  
  if (!user.role || !allowedRoles.includes(user.role)) {
    return NextResponse.json(
      { 
        success: false, 
        error: 'Forbidden - Insufficient permissions',
        requiredRoles: allowedRoles,
        userRole: user.role 
      },
      { status: 403 }
    )
  }
  
  return authResult
}

/**
 * Helper to get authenticated user from request
 * Returns null if not authenticated
 */
export async function getAuthUser(request: NextRequest) {
  try {
    const session = await auth()
    return session?.user || null
  } catch (error) {
    console.error('Error getting auth user:', error)
    return null
  }
}

/**
 * Helper to check if user has specific role
 */
export function hasRole(user: any, roles: string | string[]): boolean {
  if (!user || !user.role) return false
  
  const roleArray = Array.isArray(roles) ? roles : [roles]
  return roleArray.includes(user.role)
}

/**
 * Helper to check if user has access to specific LINE account
 */
export function hasLineAccountAccess(
  user: any,
  lineAccountId: number
): boolean {
  if (!user || !user.lineAccountId) return false
  
  // Owner role has access to all accounts
  if (user.role === 'owner') return true
  
  // Otherwise, check if user's lineAccountId matches
  return user.lineAccountId === lineAccountId
}

/**
 * Wrapper for API route handlers with auth
 * Usage: export const GET = withAuth(async (request, { user, params }) => { ... })
 */
export function withAuth<T = any>(
  handler: (
    request: NextRequest,
    context: { user: any; session: any; params: T }
  ) => Promise<Response>
) {
  return async (request: NextRequest, context: { params: T }) => {
    try {
      console.log('[withAuth] Starting auth check for:', request.url)
      console.log('[withAuth] Context params:', context?.params)
      
      const authResult = await requireAuth(request)
      
      if (authResult instanceof NextResponse) {
        console.log('[withAuth] Auth failed, returning error response')
        return authResult
      }
      
      console.log('[withAuth] Auth successful, calling handler')
      // Pass params from context to handler
      return await handler(request, { ...authResult, params: context.params })
    } catch (error) {
      console.error('[withAuth] Unexpected error:', error)
      return NextResponse.json(
        { success: false, error: 'Internal server error', details: error instanceof Error ? error.message : 'Unknown error' },
        { status: 500 }
      )
    }
  }
}

/**
 * Wrapper for API route handlers with role-based auth
 * Usage: export const GET = withRole(['owner', 'admin'], async (request, { user, params }) => { ... })
 */
export function withRole<T = any>(
  allowedRoles: string[],
  handler: (
    request: NextRequest,
    context: { user: any; session: any; params: T }
  ) => Promise<Response>
) {
  return async (request: NextRequest, context: { params: T }) => {
    console.log('[withRole] Context params:', context?.params)
    
    const authResult = await requireRole(request, allowedRoles)
    
    if (authResult instanceof NextResponse) {
      return authResult
    }
    
    // Pass params from context to handler
    return handler(request, { ...authResult, params: context.params })
  }
}
