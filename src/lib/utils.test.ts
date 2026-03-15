import { serializeBangkokWallTime, toBangkokDatabaseTime } from './utils'

describe('Bangkok time helpers', () => {
  it('serializes Prisma dates as Bangkok wall-clock time', () => {
    const date = new Date('2026-03-15T17:00:00.123Z')

    expect(serializeBangkokWallTime(date)).toBe('2026-03-15T17:00:00.123+07:00')
  })

  it('shifts write timestamps to Bangkok database wall time', () => {
    const date = new Date('2026-03-15T10:00:00.000Z')

    expect(toBangkokDatabaseTime(date).toISOString()).toBe('2026-03-15T17:00:00.000Z')
  })
})
