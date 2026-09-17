import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  NOTIFY_BATCH,
  NOTIFY_GAP_MS,
  FRESH_WINDOW_MINUTES,
  sendBdoNotification,
} from '@/lib/bdo-notify'

const candidate = {
  bdoId: 99001,
  bdoName: 'BDO2609-00001',
  partnerId: 5001,
  lineUserId: 'Utestuser',
  amountTotal: 7162,
}

describe('sweep limits', () => {
  it('finishes a batch inside the one-minute crontab tick', () => {
    expect(NOTIFY_BATCH * NOTIFY_GAP_MS).toBeLessThan(60_000)
  })

  it('keeps the freshness window near the lag reps already achieve by hand', () => {
    // Reps sent 88% within 3 minutes; a window of hours is the backlog guard,
    // not the target latency — but it must never reach back a whole day.
    expect(FRESH_WINDOW_MINUTES).toBeGreaterThan(30)
    expect(FRESH_WINDOW_MINUTES).toBeLessThan(24 * 60)
  })
})

describe('sendBdoNotification', () => {
  const originalFetch = global.fetch

  beforeEach(() => {
    process.env.PHP_API_URL = 'https://php.example.test'
  })

  afterEach(() => {
    global.fetch = originalFetch
    vi.restoreAllMocks()
  })

  it('posts the same action the rep button uses', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ text: async () => '{"success":true}' })
    global.fetch = fetchMock as unknown as typeof fetch

    const result = await sendBdoNotification(candidate)

    expect(result.success).toBe(true)
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('https://php.example.test/api/odoo-dashboard-api.php')
    expect(JSON.parse(init.body)).toEqual({
      action: 'send_bdo_payment_notification',
      bdo_id: 99001,
      partner_id: 5001,
    })
  })

  it('reports the backend error instead of claiming success', async () => {
    global.fetch = vi
      .fn()
      .mockResolvedValue({ text: async () => '{"success":false,"error":"no line user"}' }) as unknown as typeof fetch

    expect(await sendBdoNotification(candidate)).toEqual({
      success: false,
      error: 'no line user',
    })
  })

  it('treats an empty body as a failure rather than a silent send', async () => {
    global.fetch = vi.fn().mockResolvedValue({ text: async () => '   ' }) as unknown as typeof fetch

    const result = await sendBdoNotification(candidate)
    expect(result.success).toBe(false)
  })

  it('does not throw when the network drops', async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error('ECONNRESET')) as unknown as typeof fetch

    expect(await sendBdoNotification(candidate)).toEqual({
      success: false,
      error: 'ECONNRESET',
    })
  })
})
