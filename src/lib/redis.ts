import Redis from 'ioredis'

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
    return await getRedis().get(key)
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
      await getRedis().set(key, value, 'EX', ttlSeconds)
    } else {
      await getRedis().set(key, value)
    }
  } catch {
    console.error('[Redis] SET failed for key:', key)
  }
}

export async function redisDel(key: string): Promise<void> {
  try {
    await getRedis().del(key)
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
