import { describe, expect, test } from 'vitest'
import { toBroadcastCreatedAtIso } from '@/lib/broadcast-time'

describe('toBroadcastCreatedAtIso', () => {
  test('undoes the global Prisma read shift for DB-default broadcast created_at values', () => {
    expect(toBroadcastCreatedAtIso(new Date('2026-05-18T02:16:21.000Z'))).toBe('2026-05-18T09:16:21.000Z')
  })
})
