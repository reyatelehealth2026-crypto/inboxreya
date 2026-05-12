import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { redisHealthCheck } from '@/lib/redis'
import { logger } from '@/lib/logger'

export const dynamic = 'force-dynamic'
export const revalidate = 0

type DepResult = { ok: boolean; latencyMs: number; error?: string }

async function timed(fn: () => Promise<unknown>): Promise<DepResult> {
  const start = Date.now()
  try {
    await fn()
    return { ok: true, latencyMs: Date.now() - start }
  } catch (err) {
    return {
      ok: false,
      latencyMs: Date.now() - start,
      error: err instanceof Error ? err.message : String(err),
    }
  }
}

/**
 * Health Check Endpoint
 *
 * Returns per-dependency status (db, redis, php) so uptime monitors can
 * differentiate transient PHP outages from full Next.js degradation.
 * Returns 503 only when core Next.js dependencies are unhealthy.
 *
 * Total budget: ~2.5s (each dep capped at 2s).
 */
export async function GET() {
  const phpBase =
    process.env.PHP_API_URL ||
    process.env.NEXT_PUBLIC_PHP_API_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ''

  const [dbResult, redisResult, phpResult] = await Promise.all([
    timed(() => prisma.$queryRaw`SELECT 1`),
    timed(async () => {
      const ok = await redisHealthCheck()
      if (!ok) throw new Error('Redis ping failed')
    }),
    timed(async () => {
      if (!phpBase) throw new Error('PHP_API_URL not configured')
      const res = await fetch(`${phpBase.replace(/\/$/, '')}/api/health.php`, {
        signal: AbortSignal.timeout(2000),
        headers: { 'X-Internal-Request': 'true' },
      })
      if (!res.ok) throw new Error(`PHP /api/health.php returned ${res.status}`)
    }),
  ])

  const deps = {
    db: dbResult,
    redis: redisResult,
    php: phpResult,
  }

  const coreOk = dbResult.ok && redisResult.ok
  const allOk = coreOk && phpResult.ok
  const status = allOk ? 'ok' : 'degraded'

  if (!allOk) {
    logger.warn('health check degraded', {
      scope: 'api:health',
      db: dbResult,
      redis: redisResult,
      php: phpResult,
    })
  }

  return NextResponse.json(
    {
      status,
      timestamp: new Date().toISOString(),
      deps,
    },
    { status: coreOk ? 200 : 503 }
  )
}

export async function HEAD() {
  return new NextResponse(null, { status: 200 })
}
