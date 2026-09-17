import { beforeEach, afterEach, describe, expect, test, vi } from 'vitest'
import { signLink } from '@/lib/broadcast-link'

const mocks = vi.hoisted(() => ({
  broadcastFindUnique: vi.fn(),
  lineUserFindUnique: vi.fn(),
  userTagFindUnique: vi.fn(),
  engagementCreate: vi.fn(),
  tagAssignmentUpsert: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    broadcastMessageV2: {
      findUnique: mocks.broadcastFindUnique,
    },
    lineUser: {
      findUnique: mocks.lineUserFindUnique,
    },
    userTag: {
      findUnique: mocks.userTagFindUnique,
    },
    broadcastEngagement: {
      create: mocks.engagementCreate,
    },
    userTagAssignment: {
      upsert: mocks.tagAssignmentUpsert,
    },
  },
}))

const { GET } = await import('@/app/r/[token]/route')

const SECRET = 'test-secret-for-click-redirect-tests-xyz'

function makeRequest(token: string) {
  return new Request(`http://localhost/r/${token}`, {
    headers: { 'user-agent': 'test-agent/1.0' },
  }) as never
}

function envelopeContent(regions: unknown[]) {
  return JSON.stringify({
    version: 2,
    kind: 'composer_broadcast',
    imagemapMeta: { baseKey: 'abc123', regions },
  })
}

beforeEach(() => {
  process.env.BROADCAST_LINK_SECRET = SECRET
  vi.clearAllMocks()
  vi.spyOn(console, 'error').mockImplementation(() => {})

  mocks.broadcastFindUnique.mockResolvedValue({
    content: envelopeContent([
      { x: 0, y: 0, w: 500, h: 500, url: 'https://example.com/promo-a', tagId: 10 },
      { x: 500, y: 0, w: 500, h: 500, url: 'https://example.com/promo-b' },
    ]),
    lineAccountId: 3,
  })
  mocks.lineUserFindUnique.mockResolvedValue({ id: 7, lineUserId: 'U1234abcd', lineAccountId: 3 })
  mocks.userTagFindUnique.mockResolvedValue({ id: 10, lineAccountId: 3 })
  mocks.engagementCreate.mockResolvedValue({ id: 1 })
  mocks.tagAssignmentUpsert.mockResolvedValue({ id: 1 })
})

afterEach(() => {
  delete process.env.BROADCAST_LINK_SECRET
  vi.restoreAllMocks()
})

describe('GET /r/[token]', () => {
  test('valid token logs a click, tags the user, and 302s to the region url', async () => {
    const token = signLink({ b: 42, r: 0, u: 7 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/promo-a')

    expect(mocks.engagementCreate).toHaveBeenCalledWith({
      data: {
        broadcastId: 42,
        lineUserId: 'U1234abcd',
        lineUserPkId: 7,
        eventType: 'click',
        action: 'region:0',
        source: 'redirect',
        userAgent: 'test-agent/1.0',
      },
    })

    expect(mocks.userTagFindUnique).toHaveBeenCalledWith({
      where: { id: 10 },
      select: { id: true, lineAccountId: true },
    })
    expect(mocks.tagAssignmentUpsert).toHaveBeenCalledWith({
      where: { userId_tagId: { userId: 7, tagId: 10 } },
      update: {},
      create: {
        userId: 7,
        tagId: 10,
        assignedBy: 'broadcast_click',
        assignedReason: 'broadcast:42:region:0',
      },
    })
  })

  test('u=0 logs "anon" and never looks up a user or tags', async () => {
    const token = signLink({ b: 42, r: 0, u: 0 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/promo-a')

    expect(mocks.lineUserFindUnique).not.toHaveBeenCalled()
    expect(mocks.engagementCreate).toHaveBeenCalledWith({
      data: {
        broadcastId: 42,
        lineUserId: 'anon',
        lineUserPkId: null,
        eventType: 'click',
        action: 'region:0',
        source: 'redirect',
        userAgent: 'test-agent/1.0',
      },
    })
    expect(mocks.userTagFindUnique).not.toHaveBeenCalled()
    expect(mocks.tagAssignmentUpsert).not.toHaveBeenCalled()
  })

  test('tag belonging to another account is not assigned', async () => {
    mocks.userTagFindUnique.mockResolvedValue({ id: 10, lineAccountId: 99 })

    const token = signLink({ b: 42, r: 0, u: 7 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/promo-a')
    expect(mocks.tagAssignmentUpsert).not.toHaveBeenCalled()
  })

  test('a global tag (lineAccountId null) is still assigned', async () => {
    mocks.userTagFindUnique.mockResolvedValue({ id: 10, lineAccountId: null })

    const token = signLink({ b: 42, r: 0, u: 7 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(mocks.tagAssignmentUpsert).toHaveBeenCalledTimes(1)
  })

  test('tampered token 302s to /promo with no DB write', async () => {
    const token = signLink({ b: 42, r: 0, u: 7 })
    const [payload] = token.split('.')
    const tampered = `${payload}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`

    const res = await GET(makeRequest(tampered), { params: Promise.resolve({ token: tampered }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/promo')
    expect(mocks.broadcastFindUnique).not.toHaveBeenCalled()
    expect(mocks.engagementCreate).not.toHaveBeenCalled()
  })

  test('missing broadcast 302s to /promo', async () => {
    mocks.broadcastFindUnique.mockResolvedValue(null)

    const token = signLink({ b: 999, r: 0, u: 0 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/promo')
    expect(mocks.engagementCreate).not.toHaveBeenCalled()
  })

  test('region index out of range 302s to /promo', async () => {
    const token = signLink({ b: 42, r: 5, u: 0 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/promo')
    expect(mocks.engagementCreate).not.toHaveBeenCalled()
  })

  test('non-https region url falls back to /promo (defense in depth)', async () => {
    mocks.broadcastFindUnique.mockResolvedValue({
      content: envelopeContent([{ x: 0, y: 0, w: 500, h: 500, url: 'http://insecure.example.com' }]),
      lineAccountId: 3,
    })

    const token = signLink({ b: 42, r: 0, u: 0 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/promo')
  })

  test('DB throw while resolving the broadcast still redirects to /promo', async () => {
    mocks.broadcastFindUnique.mockRejectedValueOnce(new Error('connection lost'))

    const token = signLink({ b: 42, r: 0, u: 0 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('http://localhost:3000/promo')
  })

  test('DB throw while logging still redirects to the resolved region url', async () => {
    mocks.engagementCreate.mockRejectedValueOnce(new Error('write failed'))

    const token = signLink({ b: 42, r: 0, u: 0 })
    const res = await GET(makeRequest(token), { params: Promise.resolve({ token }) })

    expect(res.status).toBe(302)
    expect(res.headers.get('location')).toBe('https://example.com/promo-a')
  })
})
