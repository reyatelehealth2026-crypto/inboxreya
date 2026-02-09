'use client'

import { useOnlineStatus, useOfflineQueue } from '@/hooks/use-offline'
import { WifiOff, Wifi, RefreshCw } from 'lucide-react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

export function OfflineIndicator() {
  const isOnline = useOnlineStatus()
  const { queuedMessages, processQueue, isProcessing } = useOfflineQueue()

  // Don't show anything if online and no queued messages
  if (isOnline && queuedMessages.length === 0) {
    return null
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 flex justify-center p-2">
      <Alert
        className={cn(
          'max-w-md shadow-lg',
          isOnline ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'
        )}
      >
        <div className="flex items-center gap-3">
          {isOnline ? (
            <Wifi className="h-5 w-5 text-green-600" />
          ) : (
            <WifiOff className="h-5 w-5 text-yellow-600" />
          )}
          <div className="flex-1">
            <AlertDescription className={cn(
              'text-sm font-medium',
              isOnline ? 'text-green-800' : 'text-yellow-800'
            )}>
              {isOnline ? (
                queuedMessages.length > 0 ? (
                  <>
                    Back online! {queuedMessages.length} message(s) queued
                  </>
                ) : (
                  'Connected'
                )
              ) : (
                'You are offline. Messages will be queued'
              )}
            </AlertDescription>
          </div>
          {isOnline && queuedMessages.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={processQueue}
              disabled={isProcessing}
              className="ml-2"
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                  Sending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-3 w-3 mr-1" />
                  Send Now
                </>
              )}
            </Button>
          )}
        </div>
      </Alert>
    </div>
  )
}

/**
 * Compact offline indicator for use in headers
 */
export function CompactOfflineIndicator() {
  const isOnline = useOnlineStatus()

  if (isOnline) {
    return null
  }

  return (
    <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-xs font-medium">
      <WifiOff className="h-3 w-3" />
      <span>Offline</span>
    </div>
  )
}

/**
 * Status badge for connection status
 */
export function ConnectionStatusBadge() {
  const isOnline = useOnlineStatus()

  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium',
        isOnline
          ? 'bg-green-100 text-green-800'
          : 'bg-red-100 text-red-800'
      )}
      title={isOnline ? 'Connected' : 'Disconnected'}
    >
      <div
        className={cn(
          'w-2 h-2 rounded-full',
          isOnline ? 'bg-green-500' : 'bg-red-500'
        )}
      />
      <span>{isOnline ? 'Online' : 'Offline'}</span>
    </div>
  )
}
