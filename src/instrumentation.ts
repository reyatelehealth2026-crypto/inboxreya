/**
 * Next 15 instrumentation hook. Loads the matching Sentry config based on
 * runtime. No-op when SENTRY_DSN is unset, so dev/test environments stay quiet.
 */
import * as Sentry from '@sentry/nextjs'

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config')
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config')
  }
}

export const onRequestError = Sentry.captureRequestError
