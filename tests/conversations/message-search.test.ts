import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db, cacheQuery } = vi.hoisted(() => ({
  db: { $queryRaw: vi.fn() },
  // pass-through cache: run the fetcher, like a Redis miss
  cacheQuery: vi.fn((_key: string, fetcher: () => Promise<unknown>) => fetcher()),
}))
vi.mock('@/lib/prisma', () => ({ default: db, prisma: db }))
vi.mock('@/lib/redis', () => ({ cacheQuery }))

import { userIdsWithMessageContaining } from '@/lib/message-search'

beforeEach(() => {
  vi.clearAllMocks()
  db.$queryRaw.mockResolvedValue([{ userId: 7n }, { userId: 9 }])
})

describe('userIdsWithMessageContaining', () => {
  it('does not scan the table for blank or one-character terms', async () => {
    expect(await userIdsWithMessageContaining('  ')).toEqual([])
    expect(await userIdsWithMessageContaining('ก')).toEqual([])
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it('returns plain numbers and caches per lower-cased term for a minute', async () => {
    expect(await userIdsWithMessageContaining('  Para ')).toEqual([7, 9])
    expect(cacheQuery).toHaveBeenCalledWith('msgsearch:para', expect.any(Function), 60)
  })

  it('escapes LIKE wildcards the user typed', async () => {
    await userIdsWithMessageContaining('50%_off')
    // tagged-template call: [strings, ...values]; the first value is the pattern
    expect(db.$queryRaw.mock.calls[0][1]).toBe('%50\\%\\_off%')
  })

  it('shares one scan between concurrent callers of the same term', async () => {
    let release: (rows: { userId: number }[]) => void = () => {}
    db.$queryRaw.mockReturnValue(new Promise((resolve) => { release = resolve }))

    const first = userIdsWithMessageContaining('พารา')
    const second = userIdsWithMessageContaining('พารา')
    release([{ userId: 3 }])

    expect(await first).toEqual([3])
    expect(await second).toEqual([3])
    expect(db.$queryRaw).toHaveBeenCalledTimes(1)

    // …and lets go afterwards, so the next search reaches the cache again
    await userIdsWithMessageContaining('พารา')
    expect(cacheQuery).toHaveBeenCalledTimes(2)
  })
})
