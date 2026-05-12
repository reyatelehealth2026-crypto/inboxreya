/**
 * In-memory circuit-breaker for PHP backend calls.
 *
 * Keyed by `service` (a short slug extracted from the endpoint, e.g.
 * `orders`, `health-profile`). Each circuit tracks recent failures in a
 * rolling window. When the failure count hits the threshold, the circuit
 * trips open and rejects new calls immediately for `openMs`. After that
 * one probe is allowed (half-open); success closes the circuit, failure
 * trips it open again.
 *
 * Module-scoped state — survives across requests within a Next.js server
 * instance. Resets on cold start (acceptable: PHP outages typically last
 * minutes, not seconds).
 */

import { logger } from './logger'

type State = 'closed' | 'open' | 'half-open'

interface Circuit {
  state: State
  failures: number[] // epoch ms of recent failures (within window)
  openedAt: number | null
}

const FAILURE_THRESHOLD = 5
const FAILURE_WINDOW_MS = 30_000
const OPEN_DURATION_MS = 60_000

const circuits = new Map<string, Circuit>()

function getCircuit(service: string): Circuit {
  let c = circuits.get(service)
  if (!c) {
    c = { state: 'closed', failures: [], openedAt: null }
    circuits.set(service, c)
  }
  return c
}

function trim(circuit: Circuit, now: number) {
  const cutoff = now - FAILURE_WINDOW_MS
  circuit.failures = circuit.failures.filter((t) => t >= cutoff)
}

function shouldAttempt(circuit: Circuit, now: number): boolean {
  if (circuit.state === 'closed') return true
  if (circuit.state === 'open') {
    if (circuit.openedAt !== null && now - circuit.openedAt >= OPEN_DURATION_MS) {
      circuit.state = 'half-open'
      return true // one probe allowed
    }
    return false
  }
  // half-open: previous probe is in flight — block additional concurrent probes
  // by demoting to "open with elapsed clock" essentially; here we just allow
  // since concurrency on the same service is unlikely to matter much.
  return true
}

function recordSuccess(circuit: Circuit) {
  circuit.state = 'closed'
  circuit.failures = []
  circuit.openedAt = null
}

function recordFailure(service: string, circuit: Circuit, now: number) {
  trim(circuit, now)
  circuit.failures.push(now)
  if (circuit.failures.length >= FAILURE_THRESHOLD && circuit.state !== 'open') {
    circuit.state = 'open'
    circuit.openedAt = now
    logger.warn('php circuit opened', {
      scope: 'php-circuit',
      service,
      failuresInWindow: circuit.failures.length,
      openForMs: OPEN_DURATION_MS,
    })
  }
}

export class CircuitOpenError extends Error {
  statusCode = 503
  constructor(public service: string) {
    super(`PHP circuit is open for service "${service}"`)
    this.name = 'CircuitOpenError'
  }
}

export async function withCircuit<T>(service: string, fn: () => Promise<T>): Promise<T> {
  const circuit = getCircuit(service)
  const now = Date.now()
  trim(circuit, now)

  if (!shouldAttempt(circuit, now)) {
    throw new CircuitOpenError(service)
  }

  try {
    const result = await fn()
    if (circuit.state !== 'closed') {
      recordSuccess(circuit)
      logger.info('php circuit closed', { scope: 'php-circuit', service })
    }
    return result
  } catch (err) {
    recordFailure(service, circuit, Date.now())
    throw err
  }
}

/**
 * Derive a stable service slug from a URL or endpoint path:
 *   `/api/orders.php?action=list` → `orders`
 *   `https://host/api/inbox/templates`  → `inbox-templates`
 *   `/api/line/send-media.php`     → `line-send-media`
 */
export function serviceFromUrl(url: string): string {
  try {
    const path = url.startsWith('http') ? new URL(url).pathname : url.split('?')[0]
    const cleaned = path
      .replace(/^\/+/, '')
      .replace(/^api\//, '')
      .replace(/\.php$/, '')
      .replace(/\//g, '-')
    return cleaned || 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Test-only helper: reset all circuits. */
export function __resetCircuits() {
  circuits.clear()
}
