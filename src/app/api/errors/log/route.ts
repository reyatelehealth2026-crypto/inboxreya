import { NextRequest, NextResponse } from 'next/server'

/**
 * Error Logging API Endpoint
 * Receives client-side errors and logs them to monitoring service
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    const {
      error,
      errorInfo,
      timestamp,
      userAgent,
      url,
    } = body

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.error('[Client Error]', {
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
      })
    }

    // In production, send to monitoring service (e.g., Sentry, LogRocket, Datadog)
    if (process.env.NODE_ENV === 'production') {
      // Example: Send to Sentry
      // await Sentry.captureException(new Error(error.message), {
      //   contexts: {
      //     error: {
      //       stack: error.stack,
      //       componentStack: errorInfo.componentStack,
      //     },
      //   },
      //   tags: {
      //     source: 'client',
      //   },
      //   extra: {
      //     userAgent,
      //     url,
      //     timestamp,
      //   },
      // })

      // For now, log to server console
      console.error('[Production Client Error]', {
        message: error?.message,
        stack: error?.stack,
        componentStack: errorInfo?.componentStack,
        timestamp,
        url,
        userAgent,
      })
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Error logged successfully',
      },
      { status: 200 }
    )
  } catch (err) {
    console.error('Failed to log client error:', err)
    return NextResponse.json(
      {
        success: false,
        message: 'Failed to log error',
      },
      { status: 500 }
    )
  }
}
