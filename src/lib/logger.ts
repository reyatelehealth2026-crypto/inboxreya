/**
 * Thin structured logger that emits JSON to stdout and forwards
 * to Sentry (errors → captureException, warnings → captureMessage,
 * info → addBreadcrumb).
 *
 * Use in hot paths (php-bridge, ai.ts, /api/inbox/ai/*, /api/inbox/upload,
 * line-api, errors.ts) instead of console.*. Other call sites can migrate
 * incrementally — see plan A4.
 */
import * as Sentry from '@sentry/nextjs'

type LogContext = Record<string, unknown>

const SERVICE = 'inboxreya'
const ENV = process.env.NODE_ENV ?? 'development'

function emit(level: 'info' | 'warn' | 'error', message: string, ctx?: LogContext) {
  const line = {
    level,
    service: SERVICE,
    env: ENV,
    ts: new Date().toISOString(),
    msg: message,
    ...(ctx ?? {}),
  }
  // Single-line JSON keeps logs greppable in journald.
  const out = JSON.stringify(line, (_, v) =>
    v instanceof Error ? { name: v.name, message: v.message, stack: v.stack } : v
  )
  if (level === 'error') {
    // eslint-disable-next-line no-console
    console.error(out)
  } else if (level === 'warn') {
    // eslint-disable-next-line no-console
    console.warn(out)
  } else {
    // eslint-disable-next-line no-console
    console.log(out)
  }
}

export const logger = {
  info(message: string, ctx?: LogContext) {
    emit('info', message, ctx)
    Sentry.addBreadcrumb({
      category: (ctx?.scope as string) ?? 'app',
      level: 'info',
      message,
      data: ctx,
    })
  },

  warn(message: string, ctx?: LogContext) {
    emit('warn', message, ctx)
    Sentry.captureMessage(message, {
      level: 'warning',
      extra: ctx,
    })
  },

  error(err: unknown, ctx?: LogContext) {
    const message = err instanceof Error ? err.message : String(err)
    emit('error', message, { ...ctx, err })
    if (err instanceof Error) {
      Sentry.captureException(err, { extra: ctx })
    } else {
      Sentry.captureMessage(message, { level: 'error', extra: ctx })
    }
  },
}

/**
 * Bind request-scoped fields (requestId, route, userId). Returns a logger
 * with the same surface as the default export.
 */
export function withRequest(fields: LogContext): typeof logger {
  return {
    info: (msg, ctx) => logger.info(msg, { ...fields, ...ctx }),
    warn: (msg, ctx) => logger.warn(msg, { ...fields, ...ctx }),
    error: (err, ctx) => logger.error(err, { ...fields, ...ctx }),
  }
}
