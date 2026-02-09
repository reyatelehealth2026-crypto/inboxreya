/**
 * Retry Logic with Exponential Backoff
 * Provides automatic retry functionality for failed operations
 */

export interface RetryOptions {
  maxAttempts?: number
  initialDelay?: number
  maxDelay?: number
  backoffMultiplier?: number
  shouldRetry?: (error: any, attempt: number) => boolean
  onRetry?: (error: any, attempt: number, delay: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
  shouldRetry: (error: any) => {
    // Retry on network errors and 5xx server errors
    if (error?.statusCode >= 500) return true
    if (error?.message?.includes('fetch')) return true
    if (error?.message?.includes('network')) return true
    if (error?.message?.includes('timeout')) return true
    return false
  },
  onRetry: () => {},
}

/**
 * Calculate delay with exponential backoff
 */
function calculateDelay(
  attempt: number,
  initialDelay: number,
  maxDelay: number,
  backoffMultiplier: number
): number {
  const delay = initialDelay * Math.pow(backoffMultiplier, attempt - 1)
  return Math.min(delay, maxDelay)
}

/**
 * Sleep for specified milliseconds
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/**
 * Retry a function with exponential backoff
 */
export async function retry<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      // Check if we should retry
      const shouldRetry = opts.shouldRetry(error, attempt)
      const isLastAttempt = attempt === opts.maxAttempts

      if (!shouldRetry || isLastAttempt) {
        throw error
      }

      // Calculate delay
      const delay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      )

      // Call retry callback
      opts.onRetry(error, attempt, delay)

      // Wait before retrying
      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Retry with jitter to prevent thundering herd
 */
export async function retryWithJitter<T>(
  fn: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: any

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error

      const shouldRetry = opts.shouldRetry(error, attempt)
      const isLastAttempt = attempt === opts.maxAttempts

      if (!shouldRetry || isLastAttempt) {
        throw error
      }

      // Calculate delay with jitter
      const baseDelay = calculateDelay(
        attempt,
        opts.initialDelay,
        opts.maxDelay,
        opts.backoffMultiplier
      )
      const jitter = Math.random() * baseDelay * 0.3 // Add up to 30% jitter
      const delay = baseDelay + jitter

      opts.onRetry(error, attempt, delay)

      await sleep(delay)
    }
  }

  throw lastError
}

/**
 * Create a retryable version of a function
 */
export function makeRetryable<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  options: RetryOptions = {}
): T {
  return ((...args: any[]) => {
    return retry(() => fn(...args), options)
  }) as T
}

/**
 * Retry configuration presets
 */
export const retryPresets = {
  // Quick retry for fast operations
  quick: {
    maxAttempts: 2,
    initialDelay: 500,
    maxDelay: 2000,
    backoffMultiplier: 2,
  },

  // Standard retry for most operations
  standard: {
    maxAttempts: 3,
    initialDelay: 1000,
    maxDelay: 10000,
    backoffMultiplier: 2,
  },

  // Aggressive retry for critical operations
  aggressive: {
    maxAttempts: 5,
    initialDelay: 1000,
    maxDelay: 30000,
    backoffMultiplier: 2,
  },

  // Patient retry for slow operations
  patient: {
    maxAttempts: 3,
    initialDelay: 2000,
    maxDelay: 60000,
    backoffMultiplier: 3,
  },
} as const

/**
 * Fetch with automatic retry
 */
export async function fetchWithRetry(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<Response> {
  return retry(async () => {
    const response = await fetch(url, options)

    // Throw error for non-ok responses to trigger retry
    if (!response.ok) {
      const error: any = new Error(`HTTP ${response.status}: ${response.statusText}`)
      error.statusCode = response.status
      error.response = response
      throw error
    }

    return response
  }, retryOptions)
}

/**
 * API call with automatic retry
 */
export async function apiCallWithRetry<T>(
  url: string,
  options: RequestInit = {},
  retryOptions: RetryOptions = {}
): Promise<T> {
  const response = await fetchWithRetry(url, options, retryOptions)
  return response.json()
}
