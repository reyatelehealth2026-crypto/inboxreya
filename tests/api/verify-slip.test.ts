import { POST } from '@/app/api/inbox/verify-slip/route'
import { beforeEach, describe, expect, test, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: mocks.auth,
}))

// Stand in for the QR reader so the tests can use a fake image buffer.
vi.mock('jimp', () => ({
  Jimp: {
    read: async () => ({ bitmap: { data: new Uint8Array(4), width: 1, height: 1 } }),
  },
}))

vi.mock('jsqr', () => ({
  default: () => ({ data: 'QR-PAYLOAD' }),
}))

const IMAGE_URL = 'https://cdn.example.test/slips/abc.jpg'

function imageResponse() {
  return {
    ok: true,
    headers: { get: () => 'image/jpeg' },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  }
}

function slipcResponse(status: number, payload: unknown) {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(payload),
  }
}

/** Mock the two sequential fetches the route makes: slip image, then slip-c. */
function mockFetch(slipc: ReturnType<typeof slipcResponse>) {
  const fetchMock = vi.fn()
  fetchMock.mockResolvedValueOnce(imageResponse())
  fetchMock.mockResolvedValueOnce(slipc)
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

function postRequest(body: unknown = { imageUrl: IMAGE_URL }) {
  return {
    json: async () => body,
  } as never
}

const OK_SLIP = {
  message: 'Slip processed successfully.',
  fromCache: false,
  data: {
    ref: '202602032204376094',
    date: '2026-03-17T03:15:20.000Z',
    amount: 1250.5,
    sender_bank: '004',
    sender_name: 'สมชาย ใจดี',
    sender_id: 'xxx-x-x1234-x',
    receiver_bank: '014',
    receiver_name: 'บริษัท ซี เอ็น วาย เฮลท์แคร์ จำกัด',
    receiver_id: 'XXX-X-X622-8',
  },
}

describe('POST /api/inbox/verify-slip (slip-c)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.unstubAllGlobals()
    mocks.auth.mockResolvedValue({ user: { id: '7' } })
  })

  test('maps a slip-c success payload onto the frontend contract', async () => {
    const fetchMock = mockFetch(slipcResponse(200, OK_SLIP))

    const json = await (await POST(postRequest())).json()

    expect(json.success).toBe(true)
    expect(json.verified).toBe(true)
    expect(json.warnings).toEqual([])
    expect(json.data.amount).toBe(1250.5)
    expect(json.data.transRef).toBe('202602032204376094')
    // Bank codes are resolved to Thai bank names.
    expect(json.data.sendingBankName).toBe('ธนาคารกสิกรไทย')
    expect(json.data.receivingBankName).toBe('ธนาคารไทยพาณิชย์')
    expect(json.data.sender.account.value).toBe('xxx-x-x1234-x')

    // The image is posted as a base64 data URI with the terms accepted.
    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://slip-c.oiio.download/api/slip')
    const sent = JSON.parse(init.body)
    expect(sent.img.startsWith('data:image/jpeg;base64,')).toBe(true)
    expect(sent).toMatchObject({ tos: true, privacy: true, eula: true })
  })

  test('reports the transfer on the Thai calendar day, not the UTC one', async () => {
    // 18:30 UTC on 17 Mar = 01:30 on 18 Mar in Bangkok.
    mockFetch(
      slipcResponse(200, { ...OK_SLIP, data: { ...OK_SLIP.data, date: '2026-03-17T18:30:00.000Z' } })
    )

    const json = await (await POST(postRequest())).json()

    expect(json.data.transDate).toBe('20260318')
    expect(json.data.transTime).toBe('01:30:00')
    expect(json.data.transDateTime).toBe('2026-03-18T01:30:00+07:00')
  })

  test('turns a slip-c error slug into a Thai message without failing the request', async () => {
    mockFetch(slipcResponse(404, { error: 'Slip not found', slug: 'slip-not-found' }))

    const response = await POST(postRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.verified).toBe(false)
    expect(json.status).toBe('slip-not-found')
    expect(json.error).toContain('ไม่พบรายการนี้ในระบบธนาคาร')
  })

  test('warns when the receiver account is not the company account', async () => {
    mockFetch(
      slipcResponse(200, {
        ...OK_SLIP,
        data: { ...OK_SLIP.data, receiver_id: '123-4-56789-0', receiver_name: 'สมหญิง รักดี' },
      })
    )

    const json = await (await POST(postRequest())).json()

    expect(json.verified).toBe(true)
    expect(json.warnings.map((w: { type: string }) => w.type)).toEqual([
      'receiver_account_mismatch',
      'receiver_name_mismatch',
    ])
  })

  test('names the bank from slip-c details when the code is unknown, blank when neither is available', async () => {
    mockFetch(
      slipcResponse(200, {
        ...OK_SLIP,
        data: {
          ...OK_SLIP.data,
          sender_bank: '999',
          sender_bank_details: { name: 'Some Foreign Bank' },
          receiver_bank: '000', // slip-c's placeholder for "could not identify"
          receiver_bank_details: null,
        },
      })
    )

    const json = await (await POST(postRequest())).json()

    expect(json.data.sendingBankName).toBe('Some Foreign Bank')
    expect(json.data.receivingBankName).toBe('ไม่ระบุ')
    expect(json.data.receivingBank).toBe('000') // raw code still available
  })

  test('does not report a slip as genuine when slip-c flags it unverified', async () => {
    mockFetch(slipcResponse(200, { ...OK_SLIP, data: { ...OK_SLIP.data, verified: false } }))

    const json = await (await POST(postRequest())).json()

    expect(json.verified).toBe(false)
  })

  test('answers 200 with a readable message when slip-c times out', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(imageResponse())
    // Rejects every slip-c call, not only the first, so the assertion below is
    // about how many calls the route chose to make rather than how many the mock
    // happened to have answers for.
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))
    vi.stubGlobal('fetch', fetchMock)

    const response = await POST(postRequest())
    const json = await response.json()

    expect(response.status).toBe(200)
    expect(json.verified).toBe(false)
    expect(json.error).toContain('ใช้เวลานานเกินไป')
    // Image fetch + a single OCR call. A hung slip-c call is NOT retried: asking
    // again immediately was measured against three real slips and hung every
    // time, so a retry only adds dead waiting to a verification already lost.
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  test('skips OCR by sending the QR when the amount is known', async () => {
    const fetchMock = mockFetch(slipcResponse(200, OK_SLIP))

    const json = await (await POST(postRequest({ imageUrl: IMAGE_URL, amount: 1250.5 }))).json()

    expect(json.verified).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(2) // image + one slip-c call

    const [url, init] = fetchMock.mock.calls[1]
    expect(url).toBe('https://slip-c.oiio.download/api/slip/1250.5/no_slip')
    const sent = JSON.parse(init.body)
    expect(sent.qrcode_data).toBe('QR-PAYLOAD')
    expect(sent.img).toBeUndefined()
  })

  test('falls back to the image path when the expected amount does not match the slip', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(imageResponse())
    // The customer paid something other than the order total, so the QR path misses…
    fetchMock.mockResolvedValueOnce(slipcResponse(404, { error: 'not found', slug: 'slip-not-found' }))
    // …and the OCR path still finds the genuine slip.
    fetchMock.mockResolvedValueOnce(slipcResponse(200, OK_SLIP))
    vi.stubGlobal('fetch', fetchMock)

    const json = await (await POST(postRequest({ imageUrl: IMAGE_URL, amount: 999 }))).json()

    expect(json.verified).toBe(true)
    expect(json.data.amount).toBe(1250.5)
    expect(fetchMock.mock.calls[2][0]).toBe('https://slip-c.oiio.download/api/slip')
  })

  test('still falls back to OCR when the QR lookup itself times out', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(imageResponse())
    // The QR lookup hangs and is aborted — this used to abort the whole request.
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'TimeoutError' }))
    // The OCR path must still get its own turn, with its own timeout.
    fetchMock.mockResolvedValueOnce(slipcResponse(200, OK_SLIP))
    vi.stubGlobal('fetch', fetchMock)

    const json = await (await POST(postRequest({ imageUrl: IMAGE_URL, amount: 1250.5 }))).json()

    expect(json.verified).toBe(true)
    expect(fetchMock.mock.calls[2][0]).toBe('https://slip-c.oiio.download/api/slip')
  })

  test('gives each slip-c call its own timeout instead of one shared budget', async () => {
    const fetchMock = vi.fn()
    fetchMock.mockResolvedValueOnce(imageResponse())
    fetchMock.mockResolvedValueOnce(slipcResponse(404, { error: 'not found', slug: 'slip-not-found' }))
    fetchMock.mockResolvedValueOnce(slipcResponse(200, OK_SLIP))
    vi.stubGlobal('fetch', fetchMock)

    await POST(postRequest({ imageUrl: IMAGE_URL, amount: 999 }))

    // A shared budget left the second call with the 1s floor; both must be generous.
    const qrSignal = fetchMock.mock.calls[1][1].signal
    const ocrSignal = fetchMock.mock.calls[2][1].signal
    expect(qrSignal).toBeInstanceOf(AbortSignal)
    expect(ocrSignal).toBeInstanceOf(AbortSignal)
    expect(qrSignal).not.toBe(ocrSignal)
  })

  test('rejects an unauthenticated caller', async () => {
    mocks.auth.mockResolvedValue(null)

    const response = await POST(postRequest())

    expect(response.status).toBe(401)
  })
})
