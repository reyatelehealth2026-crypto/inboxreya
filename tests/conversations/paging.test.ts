import { describe, it, expect, vi, beforeEach } from 'vitest'

const { db } = vi.hoisted(() => ({
  db: { $queryRaw: vi.fn(), message: { findMany: vi.fn() } },
}))
vi.mock('@/lib/prisma', () => ({ default: db, prisma: db }))

import { lastMessagesFor } from '@/lib/last-messages'
import { useInboxStore, CONVERSATION_PAGE_SIZE } from '@/stores/inbox'

beforeEach(() => vi.clearAllMocks())

describe('lastMessagesFor', () => {
  it('asks the database for nothing when there are no users', async () => {
    expect((await lastMessagesFor([])).size).toBe(0)
    expect(db.$queryRaw).not.toHaveBeenCalled()
  })

  it('loads only the newest row per user and keys it by user id', async () => {
    db.$queryRaw.mockResolvedValue([{ id: 11n }, { id: 25 }]) // MariaDB hands MAX() back as BigInt
    db.message.findMany.mockResolvedValue([
      { id: 11, userId: 1, content: 'a' },
      { id: 25, userId: 2, content: 'b' },
      { id: 30, userId: null, content: 'orphan' },
    ])

    const last = await lastMessagesFor([1, 2, 3])

    expect(db.message.findMany.mock.calls[0][0].where).toEqual({ id: { in: [11, 25] } })
    expect(last.get(1)).toMatchObject({ id: 11 })
    expect(last.get(2)).toMatchObject({ id: 25 })
    expect(last.has(3)).toBe(false) // user with no messages yet
    expect(last.size).toBe(2) // the orphan row is dropped, not keyed under null
  })
})

describe('conversation paging', () => {
  const limit = () => useInboxStore.getState().conversationPaging.limit
  const loadMore = (key: string) => useInboxStore.getState().loadMoreConversations(key)

  beforeEach(() =>
    useInboxStore.setState({ conversationPaging: { filtersKey: '', limit: CONVERSATION_PAGE_SIZE } }),
  )

  it('grows one page at a time for the same filters', () => {
    loadMore('A')
    loadMore('A')
    expect(limit()).toBe(CONVERSATION_PAGE_SIZE * 3)
  })

  it('starts over from one page when the filters change', () => {
    loadMore('A')
    loadMore('A')
    loadMore('B')
    expect(useInboxStore.getState().conversationPaging).toEqual({
      filtersKey: 'B',
      limit: CONVERSATION_PAGE_SIZE * 2,
    })
  })

  it('never asks for more than the server allows', () => {
    for (let i = 0; i < 40; i++) loadMore('A')
    expect(limit()).toBe(2000)
  })
})
