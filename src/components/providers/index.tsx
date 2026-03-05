"use client"

import { SessionProvider } from "next-auth/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { persistQueryClient } from "@tanstack/react-query-persist-client"
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { useEffect, useState } from "react"
import { Toaster } from "@/components/ui/toaster"
import { HighContrastMode } from "@/components/accessibility/HighContrastMode"
import { FocusIndicator } from "@/components/accessibility/FocusIndicator"
import { TextScalingSupport } from "@/components/accessibility/TextScalingSupport"

// Custom error handler for React Query
function handleQueryError(error: Error) {
  console.error('Query error:', error)
  // You can add custom error tracking here (e.g., Sentry)
}

// Retry logic with exponential backoff
function retryWithBackoff(failureCount: number, error: Error) {
  // Don't retry on 401/403 errors
  if (error.message.includes('401') || error.message.includes('403')) {
    return false
  }

  // Retry up to 3 times with exponential backoff
  if (failureCount < 3) {
    return true
  }

  return false
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            // Cache configuration
            staleTime: 30 * 1000, // 30 seconds - data is fresh for 30s
            gcTime: 30 * 60 * 1000, // 30 minutes - keep unused data in cache for 30min

            // Refetch configuration - rely on real-time (Pusher/SSE) for updates
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
            refetchOnMount: true,

            // Retry configuration
            retry: retryWithBackoff,
            retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // Exponential backoff

            // Error handling
            throwOnError: false, // Don't throw errors, handle them gracefully
          },
          mutations: {
            // Retry mutations once
            retry: 1,
            retryDelay: 1000,

            // Error handling for mutations
            onError: handleQueryError,
          },
        },
      })
  )

  useEffect(() => {
    if (typeof window === "undefined") return

    const persister = createSyncStoragePersister({
      storage: window.localStorage,
      throttleTime: 1000,
      key: 'inbox-query-cache',
    })

    persistQueryClient({
      queryClient,
      persister,
      maxAge: 30 * 60 * 1000, // 30 minutes
      buster: "inbox-nextjs-v1",
      dehydrateOptions: {
        // Don't persist errors
        shouldDehydrateQuery: (query) => {
          return query.state.status === 'success'
        },
      },
    })
  }, [queryClient])

  return (
    <SessionProvider>
      <QueryClientProvider client={queryClient}>
        {children}
        <HighContrastMode />
        <FocusIndicator />
        <TextScalingSupport />
        <Toaster />
        <ReactQueryDevtools initialIsOpen={false} />
      </QueryClientProvider>
    </SessionProvider>
  )
}
