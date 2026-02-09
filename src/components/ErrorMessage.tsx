'use client'

import { AlertCircle, RefreshCw, HelpCircle } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { getUserFriendlyError } from '@/lib/errors'
import { cn } from '@/lib/utils'

interface ErrorMessageProps {
  error: Error | any
  title?: string
  onRetry?: () => void
  onDismiss?: () => void
  showDetails?: boolean
  className?: string
}

/**
 * Error Message Component
 * Displays user-friendly error messages with suggested actions
 */
export function ErrorMessage({
  error,
  title,
  onRetry,
  onDismiss,
  showDetails = false,
  className,
}: ErrorMessageProps) {
  const friendlyError = getUserFriendlyError(error)

  return (
    <Alert variant="destructive" className={cn('relative', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>{title || 'Error'}</AlertTitle>
      <AlertDescription className="mt-2">
        <p className="text-sm">{friendlyError.message}</p>
        
        {friendlyError.actions.length > 0 && (
          <div className="mt-3">
            <p className="text-xs font-semibold mb-2">What you can do:</p>
            <ul className="text-xs space-y-1 list-disc list-inside">
              {friendlyError.actions.map((action, index) => (
                <li key={index}>{action}</li>
              ))}
            </ul>
          </div>
        )}

        {showDetails && error?.stack && (
          <details className="mt-3">
            <summary className="text-xs cursor-pointer hover:underline">
              Technical Details
            </summary>
            <pre className="mt-2 text-xs bg-black/10 p-2 rounded overflow-auto max-h-32">
              {error.stack}
            </pre>
          </details>
        )}

        <div className="flex gap-2 mt-4">
          {friendlyError.canRetry && onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Inline Error Message (for forms)
 */
export function InlineError({
  message,
  className,
}: {
  message: string
  className?: string
}) {
  return (
    <p className={cn('text-sm text-red-600 flex items-center gap-1', className)}>
      <AlertCircle className="h-3 w-3" />
      <span>{message}</span>
    </p>
  )
}

/**
 * Error State Component (for empty states with errors)
 */
export function ErrorState({
  title = 'Something went wrong',
  message,
  error,
  onRetry,
  showSupport = true,
  className,
}: {
  title?: string
  message?: string
  error?: Error | any
  onRetry?: () => void
  showSupport?: boolean
  className?: string
}) {
  const friendlyError = error ? getUserFriendlyError(error) : null

  return (
    <div className={cn('flex flex-col items-center justify-center p-8 text-center', className)}>
      <div className="p-3 bg-red-100 rounded-full mb-4">
        <AlertCircle className="h-8 w-8 text-red-600" />
      </div>
      
      <h3 className="text-lg font-semibold text-gray-900 mb-2">{title}</h3>
      
      <p className="text-sm text-gray-600 max-w-md mb-4">
        {message || friendlyError?.message || 'An unexpected error occurred'}
      </p>

      {friendlyError?.actions && friendlyError.actions.length > 0 && (
        <div className="mb-4 text-left bg-blue-50 border border-blue-200 rounded-lg p-3 max-w-md">
          <p className="text-xs font-semibold text-blue-900 mb-2">Suggested actions:</p>
          <ul className="text-xs text-blue-800 space-y-1 list-disc list-inside">
            {friendlyError.actions.map((action, index) => (
              <li key={index}>{action}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="flex gap-2">
        {onRetry && (
          <Button onClick={onRetry} variant="default">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        )}
        {showSupport && (
          <Button variant="outline" asChild>
            <a href="/help" target="_blank" rel="noopener noreferrer">
              <HelpCircle className="h-4 w-4 mr-2" />
              Get Help
            </a>
          </Button>
        )}
      </div>
    </div>
  )
}

/**
 * Network Error Banner
 */
export function NetworkErrorBanner({
  onRetry,
  onDismiss,
}: {
  onRetry?: () => void
  onDismiss?: () => void
}) {
  return (
    <Alert variant="destructive" className="border-red-200 bg-red-50">
      <AlertCircle className="h-4 w-4 text-red-600" />
      <AlertTitle className="text-red-900">Network Error</AlertTitle>
      <AlertDescription className="text-red-800">
        <p className="text-sm mb-3">
          Unable to connect to the server. Please check your internet connection.
        </p>
        <div className="flex gap-2">
          {onRetry && (
            <Button size="sm" variant="outline" onClick={onRetry}>
              <RefreshCw className="h-3 w-3 mr-1" />
              Retry
            </Button>
          )}
          {onDismiss && (
            <Button size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          )}
        </div>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Validation Error Summary
 */
export function ValidationErrorSummary({
  errors,
  className,
}: {
  errors: Record<string, string>
  className?: string
}) {
  const errorList = Object.entries(errors)

  if (errorList.length === 0) return null

  return (
    <Alert variant="destructive" className={cn('mb-4', className)}>
      <AlertCircle className="h-4 w-4" />
      <AlertTitle>Please fix the following errors:</AlertTitle>
      <AlertDescription>
        <ul className="mt-2 text-sm space-y-1 list-disc list-inside">
          {errorList.map(([field, message]) => (
            <li key={field}>
              <span className="font-medium">{field}:</span> {message}
            </li>
          ))}
        </ul>
      </AlertDescription>
    </Alert>
  )
}

/**
 * Context-Specific Error Messages
 */
export const contextualErrors = {
  messageSend: {
    title: 'Failed to send message',
    getMessage: (error: any) => {
      if (error?.code === 'RATE_LIMIT_EXCEEDED') {
        return 'You are sending messages too quickly. Please wait a moment and try again.'
      }
      if (error?.code === 'MESSAGE_TOO_LONG') {
        return 'Your message is too long. Please shorten it and try again.'
      }
      if (error?.statusCode === 401) {
        return 'Your session has expired. Please log in again.'
      }
      return 'Unable to send your message. Please try again.'
    },
    actions: ['Check your internet connection', 'Try again in a moment', 'Contact support if the problem persists'],
  },

  fileUpload: {
    title: 'Failed to upload file',
    getMessage: (error: any) => {
      if (error?.code === 'FILE_TOO_LARGE') {
        return 'The file is too large. Maximum size is 10MB.'
      }
      if (error?.code === 'INVALID_FILE_TYPE') {
        return 'This file type is not supported. Please upload a JPEG, PNG, GIF, or PDF file.'
      }
      return 'Unable to upload your file. Please try again.'
    },
    actions: ['Check file size and type', 'Try a different file', 'Contact support if needed'],
  },

  dataLoad: {
    title: 'Failed to load data',
    getMessage: () => 'Unable to load the requested data. Please try again.',
    actions: ['Refresh the page', 'Check your internet connection', 'Try again later'],
  },

  saveChanges: {
    title: 'Failed to save changes',
    getMessage: () => 'Your changes could not be saved. Please try again.',
    actions: ['Check your internet connection', 'Try again', 'Contact support if the problem persists'],
  },
}

/**
 * Get contextual error message
 */
export function getContextualError(
  context: keyof typeof contextualErrors,
  error: any
): {
  title: string
  message: string
  actions: string[]
} {
  const errorContext = contextualErrors[context]
  return {
    title: errorContext.title,
    message: errorContext.getMessage(error),
    actions: errorContext.actions,
  }
}
