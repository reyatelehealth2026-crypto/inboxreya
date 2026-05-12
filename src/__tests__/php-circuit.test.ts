import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  withCircuit,
  serviceFromUrl,
  CircuitOpenError,
  __resetCircuits,
} from '../lib/php-circuit'

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

describe('serviceFromUrl', () => {
  it('extracts slug from PHP endpoint path', () => {
    expect(serviceFromUrl('/api/orders.php?action=list')).toBe('orders')
  })
  it('extracts slug from absolute URL', () => {
    expect(serviceFromUrl('https://php.example.com/api/line/send-media.php')).toBe(
      'line-send-media'
    )
  })
  it('falls back to "unknown" for empty path', () => {
    expect(serviceFromUrl('')).toBe('unknown')
  })
})

describe('withCircuit', () => {
  beforeEach(() => {
    __resetCircuits()
  })

  it('passes through successful calls', async () => {
    const result = await withCircuit('svc-a', async () => 'ok')
    expect(result).toBe('ok')
  })

  it('lets failures through while below threshold', async () => {
    for (let i = 0; i < 4; i++) {
      await expect(
        withCircuit('svc-b', async () => {
          throw new Error('boom')
        })
      ).rejects.toThrow('boom')
    }
    // 5th still throws the underlying error (this attempt trips it)
    await expect(
      withCircuit('svc-b', async () => {
        throw new Error('boom')
      })
    ).rejects.toThrow('boom')
  })

  it('rejects with CircuitOpenError once threshold is crossed', async () => {
    for (let i = 0; i < 5; i++) {
      await withCircuit('svc-c', async () => {
        throw new Error('boom')
      }).catch(() => undefined)
    }
    await expect(
      withCircuit('svc-c', async () => 'should not run')
    ).rejects.toBeInstanceOf(CircuitOpenError)
  })

  it('isolates circuits per service', async () => {
    for (let i = 0; i < 5; i++) {
      await withCircuit('svc-d', async () => {
        throw new Error('boom')
      }).catch(() => undefined)
    }
    // Different service should still be closed
    const ok = await withCircuit('svc-e', async () => 'fresh')
    expect(ok).toBe('fresh')
  })
})
