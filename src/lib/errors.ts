/**
 * Custom API Error Classes
 * Provides structured error handling for API operations
 */

export class APIError extends Error {
  public statusCode: number
  public code: string
  public details?: any

  constructor(
    message: string,
    statusCode: number = 500,
    code: string = 'INTERNAL_ERROR',
    details?: any
  ) {
    super(message)
    this.name = 'APIError'
    this.statusCode = statusCode
    this.code = code
    this.details = details

    // Maintains proper stack trace for where our error was thrown
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError)
    }
  }

  toJSON() {
    return {
      success: false,
      error: {
        message: this.message,
        code: this.code,
        statusCode: this.statusCode,
        details: this.details,
      },
    }
  }
}

export class ValidationError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 400, 'VALIDATION_ERROR', details)
    this.name = 'ValidationError'
  }
}

export class AuthenticationError extends APIError {
  constructor(message: string = 'Authentication required') {
    super(message, 401, 'AUTHENTICATION_ERROR')
    this.name = 'AuthenticationError'
  }
}

export class AuthorizationError extends APIError {
  constructor(message: string = 'Insufficient permissions') {
    super(message, 403, 'AUTHORIZATION_ERROR')
    this.name = 'AuthorizationError'
  }
}

export class NotFoundError extends APIError {
  constructor(resource: string = 'Resource') {
    super(`${resource} not found`, 404, 'NOT_FOUND')
    this.name = 'NotFoundError'
  }
}

export class ConflictError extends APIError {
  constructor(message: string, details?: any) {
    super(message, 409, 'CONFLICT', details)
    this.name = 'ConflictError'
  }
}

export class RateLimitError extends APIError {
  constructor(message: string = 'Rate limit exceeded') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED')
    this.name = 'RateLimitError'
  }
}

export class ExternalServiceError extends APIError {
  constructor(service: string, message?: string) {
    super(
      message || `External service error: ${service}`,
      502,
      'EXTERNAL_SERVICE_ERROR',
      { service }
    )
    this.name = 'ExternalServiceError'
  }
}

/**
 * Error message templates for user-friendly messages
 */
export const ERROR_MESSAGES = {
  // Authentication & Authorization
  AUTHENTICATION_REQUIRED: 'Please log in to continue',
  SESSION_EXPIRED: 'Your session has expired. Please log in again',
  INSUFFICIENT_PERMISSIONS: 'You do not have permission to perform this action',

  // Validation
  INVALID_INPUT: 'Please check your input and try again',
  REQUIRED_FIELD: 'This field is required',
  INVALID_FORMAT: 'Invalid format. Please check your input',

  // Network & Connection
  NETWORK_ERROR: 'Network error. Please check your connection and try again',
  CONNECTION_LOST: 'Connection lost. Reconnecting...',
  OFFLINE: 'You are offline. Changes will be saved when you reconnect',

  // API Errors
  SERVER_ERROR: 'Something went wrong on our end. Please try again',
  SERVICE_UNAVAILABLE: 'Service temporarily unavailable. Please try again later',
  RATE_LIMIT: 'Too many requests. Please wait a moment and try again',

  // Resource Errors
  NOT_FOUND: 'The requested resource was not found',
  ALREADY_EXISTS: 'This resource already exists',

  // Operation Errors
  OPERATION_FAILED: 'Operation failed. Please try again',
  SAVE_FAILED: 'Failed to save changes. Please try again',
  DELETE_FAILED: 'Failed to delete. Please try again',
  UPLOAD_FAILED: 'File upload failed. Please try again',

  // Message Errors
  MESSAGE_SEND_FAILED: 'Failed to send message. Click to retry',
  MESSAGE_TOO_LONG: 'Message is too long. Please shorten it',
  ATTACHMENT_TOO_LARGE: 'File is too large. Maximum size is 10MB',

  // Generic
  UNKNOWN_ERROR: 'An unexpected error occurred. Please try again',
  TRY_AGAIN: 'Please try again',
  CONTACT_SUPPORT: 'If the problem persists, please contact support',
} as const

/**
 * Get user-friendly error message with suggested actions
 */
export function getUserFriendlyError(error: any): {
  message: string
  actions: string[]
  canRetry: boolean
} {
  // Handle APIError instances
  if (error instanceof APIError) {
    switch (error.code) {
      case 'AUTHENTICATION_ERROR':
        return {
          message: ERROR_MESSAGES.AUTHENTICATION_REQUIRED,
          actions: ['Log in again'],
          canRetry: false,
        }
      case 'AUTHORIZATION_ERROR':
        return {
          message: ERROR_MESSAGES.INSUFFICIENT_PERMISSIONS,
          actions: ['Contact your administrator'],
          canRetry: false,
        }
      case 'VALIDATION_ERROR':
        return {
          message: error.message || ERROR_MESSAGES.INVALID_INPUT,
          actions: ['Check your input', 'Try again'],
          canRetry: true,
        }
      case 'NOT_FOUND':
        return {
          message: error.message || ERROR_MESSAGES.NOT_FOUND,
          actions: ['Go back', 'Refresh the page'],
          canRetry: false,
        }
      case 'RATE_LIMIT_EXCEEDED':
        return {
          message: ERROR_MESSAGES.RATE_LIMIT,
          actions: ['Wait a moment', 'Try again'],
          canRetry: true,
        }
      case 'EXTERNAL_SERVICE_ERROR':
        return {
          message: ERROR_MESSAGES.SERVICE_UNAVAILABLE,
          actions: ['Try again later', 'Contact support'],
          canRetry: true,
        }
      default:
        return {
          message: error.message || ERROR_MESSAGES.SERVER_ERROR,
          actions: ['Try again', 'Refresh the page'],
          canRetry: true,
        }
    }
  }

  // Handle network errors
  if (error.message?.includes('fetch') || error.message?.includes('network')) {
    return {
      message: ERROR_MESSAGES.NETWORK_ERROR,
      actions: ['Check your connection', 'Try again'],
      canRetry: true,
    }
  }

  // Handle timeout errors
  if (error.message?.includes('timeout')) {
    return {
      message: 'Request timed out',
      actions: ['Try again', 'Check your connection'],
      canRetry: true,
    }
  }

  // Default error
  return {
    message: ERROR_MESSAGES.UNKNOWN_ERROR,
    actions: ['Try again', 'Refresh the page', 'Contact support'],
    canRetry: true,
  }
}

/**
 * Log error to monitoring service
 */
export function logError(error: any, context?: Record<string, any>) {
  // Log to console in development
  if (process.env.NODE_ENV === 'development') {
    console.error('[Error]', error, context)
  }

  // Server-side production: log to console only (no HTTP self-call with relative URL)
  if (process.env.NODE_ENV === 'production' && (typeof window !== 'object' || typeof document === 'undefined')) {
    console.error('[Server Error]', error, context)
  }

  // In production, send to monitoring service (browser only — server-side uses console.error)
  // Double-guard: window must exist AND be the real browser global (not a Node.js polyfill)
  if (process.env.NODE_ENV === 'production' && typeof window === 'object' && typeof document !== 'undefined') {
    try {
      fetch('/api/errors/log', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          error: {
            message: error?.message,
            stack: error?.stack,
            name: error?.name,
            code: error?.code,
            statusCode: error?.statusCode,
          },
          context,
          timestamp: new Date().toISOString(),
          userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : undefined,
          url: typeof window !== 'undefined' ? window.location.href : undefined,
        }),
      }).catch((err) => {
        console.error('Failed to log error:', err)
      })
    } catch (err) {
      console.error('Error logging failed:', err)
    }
  }
}
