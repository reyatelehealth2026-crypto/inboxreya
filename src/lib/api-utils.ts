/**
 * API Utilities - Error handling, validation, and rate limiting
 */

import { NextRequest, NextResponse } from 'next/server'
import { z, ZodError, ZodType } from 'zod'
import {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError,
  logError
} from './errors'

// ============================================================================
// Error Handling
// ============================================================================

// Re-export error classes for convenience
export {
  APIError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  RateLimitError
}

/**
 * Handle API errors and return appropriate response
 * Enhanced with better error logging and user-friendly messages
 */
export function handleAPIError(error: unknown): NextResponse {
  // Log error to monitoring service
  logError(error, {
    source: 'api',
    timestamp: new Date().toISOString(),
  })

  // Handle known API errors
  if (error instanceof APIError) {
    return NextResponse.json(error.toJSON(), { status: error.statusCode })
  }

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    const validationError = new ValidationError(
      'Validation failed',
      error.issues.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }))
    )
    return NextResponse.json(validationError.toJSON(), { status: 400 })
  }

  // Handle Prisma errors
  if (error && typeof error === 'object' && 'code' in error) {
    const prismaError = error as any

    // Unique constraint violation
    if (prismaError.code === 'P2002') {
      const conflictError = new APIError(
        'A record with this value already exists',
        409,
        'DUPLICATE_ENTRY'
      )
      return NextResponse.json(conflictError.toJSON(), { status: 409 })
    }

    // Record not found
    if (prismaError.code === 'P2025') {
      const notFoundError = new NotFoundError('Record')
      return NextResponse.json(notFoundError.toJSON(), { status: 404 })
    }

    // Foreign key constraint violation
    if (prismaError.code === 'P2003') {
      const validationError = new ValidationError(
        'Invalid reference to related record'
      )
      return NextResponse.json(validationError.toJSON(), { status: 400 })
    }
  }

  // Handle generic errors
  if (error instanceof Error) {
    const apiError = new APIError(
      error.message || 'Internal server error',
      500,
      'INTERNAL_ERROR'
    )
    return NextResponse.json(apiError.toJSON(), { status: 500 })
  }

  // Unknown error
  const unknownError = new APIError(
    'An unexpected error occurred',
    500,
    'UNKNOWN_ERROR'
  )
  return NextResponse.json(unknownError.toJSON(), { status: 500 })
}

/**
 * Success response helper
 */
export function successResponse<T>(data: T, status: number = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    },
    { status }
  )
}

/**
 * Error response helper
 */
export function errorResponse(
  message: string,
  status: number = 400,
  code?: string
): NextResponse {
  return NextResponse.json(
    {
      success: false,
      error: message,
      ...(code && { code }),
    },
    { status }
  )
}

// ============================================================================
// Input Validation
// ============================================================================

/**
 * Validate request body against Zod schema
 */
export async function validateBody<T>(
  request: NextRequest,
  schema: ZodType<T>
): Promise<T> {
  try {
    const body = await request.json()
    return schema.parse(body)
  } catch (error) {
    if (error instanceof ZodError) {
      throw error
    }
    throw new APIError('Invalid JSON body', 400, 'INVALID_JSON')
  }
}

/**
 * Validate query parameters against Zod schema
 */
export function validateQuery<T>(
  request: NextRequest,
  schema: ZodType<T>
): T {
  const { searchParams } = new URL(request.url)
  const params: Record<string, any> = {}

  searchParams.forEach((value, key) => {
    params[key] = value
  })

  return schema.parse(params)
}

/**
 * Validate path parameters against Zod schema
 */
export function validateParams<T>(
  params: Record<string, string | string[]>,
  schema: ZodType<T>
): T {
  return schema.parse(params)
}

// ============================================================================
// Common Validation Schemas
// ============================================================================

export const commonSchemas = {
  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().positive().default(1),
    limit: z.coerce.number().int().positive().max(100).default(20),
    cursor: z.string().optional(),
  }),

  // ID parameter
  id: z.object({
    id: z.coerce.number().int().positive(),
  }),

  // String ID parameter
  stringId: z.object({
    id: z.string().min(1),
  }),

  // Date range
  dateRange: z.object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
  }),

  // Search
  search: z.object({
    search: z.string().optional(),
    query: z.string().optional(),
  }),

  // Status filter
  status: z.object({
    status: z.enum(['new', 'in_progress', 'waiting', 'resolved', 'all']).optional(),
  }),
}

// ============================================================================
// Rate Limiting
// ============================================================================

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Max requests per window
}

// In-memory rate limit store (use Redis in production)
const rateLimitStore = new Map<string, { count: number; resetAt: number }>()

/**
 * Simple in-memory rate limiter
 * For production, use Redis or a dedicated rate limiting service
 */
export function rateLimit(config: RateLimitConfig) {
  return async (request: NextRequest): Promise<NextResponse | null> => {
    // Get client identifier (IP address or user ID)
    const identifier =
      request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      request.headers.get('x-user-id') ||
      'anonymous'

    const key = `ratelimit:${identifier}:${request.nextUrl.pathname}`
    const now = Date.now()

    // Get or create rate limit entry
    let entry = rateLimitStore.get(key)

    // Reset if window expired
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + config.windowMs,
      }
      rateLimitStore.set(key, entry)
    }

    // Increment request count
    entry.count++

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetAt - now) / 1000)

      throw new RateLimitError(`Too many requests. Please try again in ${retryAfter} seconds`)
    }

    // Add rate limit headers to response
    const remaining = config.maxRequests - entry.count

    // Return null to indicate rate limit passed
    // The calling code should add these headers to the response
    return null
  }
}

/**
 * Predefined rate limit configurations
 */
export const rateLimitConfigs = {
  // Standard API endpoints
  standard: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60, // 60 requests per minute
  },

  // Strict rate limit for sensitive operations
  strict: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10, // 10 requests per minute
  },

  // Lenient rate limit for read operations
  lenient: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 120, // 120 requests per minute
  },

  // Very strict for authentication
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5, // 5 attempts per 15 minutes
  },
}

// ============================================================================
// Request Helpers
// ============================================================================

/**
 * Get user ID from request headers (set by middleware)
 */
export function getUserId(request: NextRequest): string | null {
  return request.headers.get('x-user-id')
}

/**
 * Get user role from request headers (set by middleware)
 */
export function getUserRole(request: NextRequest): string | null {
  return request.headers.get('x-user-role')
}

/**
 * Get LINE account ID from request headers (set by middleware)
 */
export function getLineAccountId(request: NextRequest): number | null {
  const value = request.headers.get('x-line-account-id')
  return value ? parseInt(value, 10) : null
}

/**
 * Check if request is from internal service
 */
export function isInternalRequest(request: NextRequest): boolean {
  return request.headers.get('x-internal-request') === 'true'
}

// ============================================================================
// API Route Wrapper
// ============================================================================

interface APIRouteOptions {
  rateLimit?: RateLimitConfig
  requireAuth?: boolean
  allowedRoles?: string[]
}

/**
 * Wrap API route handler with common functionality
 * - Error handling
 * - Rate limiting
 * - Authentication check
 * - Role-based access control
 */
export function withAPIRoute(
  handler: (request: NextRequest, context?: any) => Promise<NextResponse>,
  options: APIRouteOptions = {}
) {
  return async (request: NextRequest, context?: any): Promise<NextResponse> => {
    try {
      // Apply rate limiting if configured
      if (options.rateLimit) {
        const rateLimitResponse = await rateLimit(options.rateLimit)(request)
        if (rateLimitResponse) {
          return rateLimitResponse
        }
      }

      // Check authentication if required
      if (options.requireAuth) {
        const userId = getUserId(request)
        if (!userId && !isInternalRequest(request)) {
          throw new AuthenticationError()
        }
      }

      // Check role-based access if specified
      if (options.allowedRoles && options.allowedRoles.length > 0) {
        const userRole = getUserRole(request)
        if (!userRole || !options.allowedRoles.includes(userRole)) {
          throw new AuthorizationError()
        }
      }

      // Execute handler
      return await handler(request, context)
    } catch (error) {
      return handleAPIError(error)
    }
  }
}

// ============================================================================
// Cleanup
// ============================================================================

/**
 * Clean up expired rate limit entries
 * Should be called periodically (e.g., every 5 minutes)
 */
export function cleanupRateLimitStore() {
  const now = Date.now()
  for (const [key, entry] of rateLimitStore.entries()) {
    if (now > entry.resetAt) {
      rateLimitStore.delete(key)
    }
  }
}

// Run cleanup every 5 minutes
if (typeof setInterval !== 'undefined') {
  setInterval(cleanupRateLimitStore, 5 * 60 * 1000)
}

// ============================================================================
// PHP Backend Bridge
// ============================================================================

/**
 * Make request to PHP backend API
 * Handles authentication headers and error responses
 * Uses internal proxy to avoid Vercel Security Checkpoint
 */
export async function phpApiRequest(
  endpoint: string,
  options: RequestInit = {}
): Promise<any> {
  // Check if we should use proxy (in production/Vercel environment)
  const useProxy = process.env.VERCEL === '1' || process.env.NODE_ENV === 'production';

  if (useProxy) {
    // Use internal proxy to avoid Vercel Security Checkpoint
    // Must use absolute URL for server-side fetch in serverless functions
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL
      || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null)
      || 'http://localhost:3000';
    const proxyUrl = `${baseUrl}/api/php-proxy?endpoint=${encodeURIComponent(endpoint)}`;

    console.log('phpApiRequest - Using proxy:', proxyUrl);
    console.log('phpApiRequest - Base URL:', baseUrl);
    console.log('phpApiRequest - Method:', options.method || 'GET');
    console.log('phpApiRequest - Headers:', options.headers);

    try {
      const response = await fetch(proxyUrl, {
        ...options,
        cache: 'no-store',
      });

      console.log('phpApiRequest - Proxy response status:', response.status);

      const contentType = response.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) {
        const text = await response.text();
        console.error('phpApiRequest - Non-JSON from proxy:', text.substring(0, 500));
        throw new APIError(
          'Proxy returned non-JSON response',
          500,
          'INVALID_PROXY_RESPONSE'
        );
      }

      const data = await response.json();
      console.log('phpApiRequest - Proxy response data:', data);

      if (!response.ok) {
        throw new APIError(
          data.error || data.message || 'PHP backend request failed',
          response.status,
          data.code || 'PHP_ERROR'
        );
      }

      return data;
    } catch (error) {
      console.error('phpApiRequest - Proxy error:', error);

      if (error instanceof APIError) {
        throw error;
      }

      throw new APIError(
        error instanceof Error ? error.message : 'Failed to connect via proxy',
        500,
        'PROXY_CONNECTION_ERROR'
      );
    }
  }

  // Direct connection (development mode)
  const phpBackendUrl = process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com';
  const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${phpBackendUrl}${cleanEndpoint}`;

  console.log('phpApiRequest - Direct URL:', url);
  console.log('phpApiRequest - Method:', options.method || 'GET');
  console.log('phpApiRequest - Headers:', options.headers);

  try {
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'InboxReya-NextJS/1.0',
        'Accept': 'application/json',
        'X-Requested-With': 'XMLHttpRequest',
        ...options.headers,
      },
      cache: 'no-store',
    });

    console.log('phpApiRequest - Response status:', response.status);
    console.log('phpApiRequest - Response headers:', Object.fromEntries(response.headers.entries()));

    // Check content type
    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      const text = await response.text();
      console.error('Non-JSON response from:', url);
      console.error('Response status:', response.status);
      console.error('Content-Type:', contentType);
      console.error('Response body (first 1000 chars):', text.substring(0, 1000));

      // Try to extract error message from HTML
      let errorMessage = 'PHP backend returned non-JSON response';
      const errorMatch = text.match(/<title>(.*?)<\/title>/i);
      if (errorMatch) {
        errorMessage += `: ${errorMatch[1]}`;
      }

      throw new APIError(
        errorMessage,
        500,
        'INVALID_RESPONSE_TYPE'
      );
    }

    const data = await response.json();
    console.log('phpApiRequest - Response data:', data);

    if (!response.ok) {
      throw new APIError(
        data.error || data.message || 'PHP backend request failed',
        response.status,
        data.code || 'PHP_ERROR'
      );
    }

    return data;
  } catch (error) {
    console.error('phpApiRequest - Error:', error);

    if (error instanceof APIError) {
      throw error;
    }

    // Network or parsing error
    throw new APIError(
      error instanceof Error ? error.message : 'Failed to connect to PHP backend',
      500,
      'PHP_CONNECTION_ERROR'
    );
  }
}
