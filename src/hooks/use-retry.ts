/**
 * Hook for manual retry of failed operations
 */

import { useState, useCallback } from 'react'
import { retry, retryPresets, RetryOptions } from '@/lib/retry'
import { useToast } from '@/hooks/use-toast'
import { getUserFriendlyError } from '@/lib/errors'

interface UseRetryOptions extends RetryOptions {
  showToast?: boolean
  successMessage?: string
}

export function useRetry<T>(
  operation: () => Promise<T>,
  options: UseRetryOptions = {}
) {
  const [isRetrying, setIsRetrying] = useState(false)
  const [retryCount, setRetryCount] = useState(0)
  const [error, setError] = useState<Error | null>(null)
  const { toast } = useToast()

  const execute = useCallback(async (): Promise<T | null> => {
    setIsRetrying(true)
    setError(null)

    try {
      const result = await retry(operation, {
        ...retryPresets.standard,
        ...options,
        onRetry: (err, attempt, delay) => {
          setRetryCount(attempt)
          
          if (options.showToast) {
            toast({
              title: 'Retrying...',
              description: `Attempt ${attempt} of ${options.maxAttempts || 3}`,
              variant: 'default',
            })
          }

          options.onRetry?.(err, attempt, delay)
        },
      })

      if (options.showToast && options.successMessage) {
        toast({
          title: 'Success',
          description: options.successMessage,
          variant: 'default',
        })
      }

      setRetryCount(0)
      return result
    } catch (err: any) {
      setError(err)

      if (options.showToast) {
        const friendlyError = getUserFriendlyError(err)
        toast({
          title: 'Operation Failed',
          description: friendlyError.message,
          variant: 'destructive',
        })
      }

      return null
    } finally {
      setIsRetrying(false)
    }
  }, [operation, options, toast])

  const reset = useCallback(() => {
    setIsRetrying(false)
    setRetryCount(0)
    setError(null)
  }, [])

  return {
    execute,
    reset,
    isRetrying,
    retryCount,
    error,
  }
}

/**
 * Hook for retrying failed messages
 */
export function useMessageRetry() {
  const { toast } = useToast()

  const retryMessage = useCallback(async (
    messageId: number,
    sendFunction: () => Promise<any>
  ) => {
    try {
      const result = await retry(sendFunction, {
        ...retryPresets.standard,
        onRetry: (err, attempt) => {
          toast({
            title: 'Retrying message...',
            description: `Attempt ${attempt} of 3`,
            variant: 'default',
          })
        },
      })

      toast({
        title: 'Message sent',
        description: 'Your message was sent successfully',
        variant: 'default',
      })

      return result
    } catch (error: any) {
      const friendlyError = getUserFriendlyError(error)
      
      toast({
        title: 'Failed to send message',
        description: friendlyError.canRetry 
          ? `${friendlyError.message} - Click to retry` 
          : friendlyError.message,
        variant: 'destructive',
      })

      throw error
    }
  }, [toast])

  return { retryMessage }
}

/**
 * Hook for retrying API calls
 */
export function useAPIRetry() {
  const { toast } = useToast()

  const retryAPICall = useCallback(async <T>(
    apiCall: () => Promise<T>,
    options: {
      operationName?: string
      showToast?: boolean
    } = {}
  ): Promise<T | null> => {
    const { operationName = 'Operation', showToast = true } = options

    try {
      const result = await retry(apiCall, {
        ...retryPresets.standard,
        onRetry: (err, attempt) => {
          if (showToast) {
            toast({
              title: `Retrying ${operationName}...`,
              description: `Attempt ${attempt} of 3`,
              variant: 'default',
            })
          }
        },
      })

      if (showToast) {
        toast({
          title: 'Success',
          description: `${operationName} completed successfully`,
          variant: 'default',
        })
      }

      return result
    } catch (error: any) {
      if (showToast) {
        const friendlyError = getUserFriendlyError(error)
        
        toast({
          title: `${operationName} Failed`,
          description: friendlyError.message,
          variant: 'destructive',
        })
      }

      return null
    }
  }, [toast])

  return { retryAPICall }
}
