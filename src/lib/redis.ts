import Redis from 'ioredis'

// Key prefix แยกของ inboxreya จาก odoo (ที่ใช้ prefix 'cny:')
const KEY_PREFIX = 'inbox:'

let redis: Redis | null = null

export function getRedis(): Redis {
  if (!redis) {
    const url = process.env.REDIS_URL
    if (!url) {
      throw new Error('REDIS_URL environment variable is not set')
    }
    redis = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 3) return null
        return Math.min(times * 200, 2000)
      },
      lazyConnect: true,
    })

    redis.on('error', (err) => {
      console.error('[Redis] Connection error:', err.message)
    })

    redis.on('connect', () => {
      console.log('[Redis] Connected')
    })
  }
  return redis
}

export async function redisGet(key: string): Promise<string | null> {
  try {
    return await getRedis().get(KEY_PREFIX + key)
  } catch {
    console.error('[Redis] GET failed for key:', key)
    return null
  }
}

export async function redisSet(
  key: string,
  value: string,
  ttlSeconds?: number
): Promise<void> {
  try {
    if (ttlSeconds) {
      await getRedis().set(KEY_PREFIX + key, value, 'EX', ttlSeconds)
    } else {
      await getRedis().set(KEY_PREFIX + key, value)
    }
  } catch {
    console.error('[Redis] SET failed for key:', key)
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    await getRedis().del(KEY_PREFIX + key)
  } catch {
    console.error('[Redis] DEL failed for key:', key)
  }
}

export async function redisHealthCheck(): Promise<boolean> {
  try {
    const pong = await getRedis().ping()
    return pong === 'PONG'
  } catch {
    return false
  }
}

/**
 * Cache-aside helper สำหรับ DB queries
 *
 * ถ้า cache มี → คืนค่าจาก Redis (เร็ว)
 * ถ้าไม่มี    → รัน fetcher() แล้ว save ลง Redis + คืนค่า
 * ถ้า Redis พัง → fallback ไปรัน fetcher() ตรงๆ โดยไม่ error
 *
 * @example
 * const tags = await cacheQuery(
 *   `tags:account:${accountId}`,
 *   () => prisma.userTag.findMany({ where: { lineAccountId: accountId } }),
 *   300  // cache 5 นาที
 * )
 */
export async function cacheQuery<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 60
): Promise<T> {
  // 1. ลอง hit cache ก่อน
  try {
    const cached = await getRedis().get(KEY_PREFIX + key)
    if (cached !== null) {
      return JSON.parse(cached) as T
    }
  } catch {
    // Redis ไม่พร้อม → ข้ามไป fetch DB ตรงๆ
  }

  // 2. Cache miss → ดึงจาก DB
  const data = await fetcher()

  // 3. บันทึก cache (ไม่ block response)
  try {
    await getRedis().set(
      KEY_PREFIX + key,
      JSON.stringify(data),
      'EX',
      ttlSeconds
    )
  } catch {
    // ไม่ต้อง throw — cache fail ไม่กระทบ business logic
  }

  return data
}

/**
 * Invalidate cache key หรือ pattern
 * ใช้หลัง write/update ข้อมูล
 *
 * @example
 * await cacheInvalidate(`tags:account:${accountId}`)         // ลบ key เดียว
 * await cacheInvalidate(`templates:account:${accountId}:*`)  // ลบตาม pattern
 */
export async function cacheInvalidate(pattern: string): Promise<void> {
  try {
    const r = getRedis()
    const fullPattern = KEY_PREFIX + pattern

    if (fullPattern.includes('*')) {
      // SCAN-based delete เพื่อไม่ block server
      let cursor = '0'
      do {
        const [nextCursor, keys] = await r.scan(cursor, 'MATCH', fullPattern, 'COUNT', 100)
        cursor = nextCursor
        if (keys.length > 0) {
          await r.del(...keys)
        }
      } while (cursor !== '0')
    } else {
      await r.del(fullPattern)
    }
  } catch {
    console.error('[Redis] Invalidate failed for pattern:', pattern)
  }
}

/** TTL constants (วินาที) — ใช้ร่วมกันทั้งโปรเจกต์ */
export const CACHE_TTL = {
  DASHBOARD_STATS:  120,   // 2 นาที — aggregate ช้า
  TAGS:             300,   // 5 นาที — เปลี่ยนนาน
  TEMPLATES:        300,   // 5 นาที
  CONVERSATIONS:     30,   // 30 วิ — เปลี่ยนบ่อย
  CUSTOMER_PROFILE: 120,   // 2 นาที
  ANALYTICS:        300,   // 5 นาที
  HEALTH:            60,   // 1 นาที
  MESSAGES:          15,   // 15 วิ — ข้อความเข้าออกบ่อย
  ADMINS:           300,   // 5 นาที — admin list เปลี่ยนนาน
  NOTES:             15,   // 15 วิ — note เปลี่ยนบ่อย
  AUTO_RULES:       300,   // 5 นาที — config เปลี่ยนน้อย
  LINK_PREVIEW:    3600,   // 1 ชม. — URL preview ไม่เปลี่ยน
  BROADCASTS:        30,   // 30 วิ
  GROUPS:            60,   // 1 นาที
  ORDERS:            30,   // 30 วิ
  SLIP_CENTER:     1800,   // 30 นาที — cache นาน, invalidate หลัง match/unmatch/edit
  QUOTED_MSG:       600,   // 10 นาที — ข้อความ quote ไม่เปลี่ยน
  PRESCRIPTIONS:     60,   // 1 นาที
  CUSTOMER_360:      30,   // 30 วิ — from PHP
  ACTIVE_ORDERS:     30,   // 30 วิ
  ODOO_PARTNER:     300,   // 5 นาที — local sync
} as const

