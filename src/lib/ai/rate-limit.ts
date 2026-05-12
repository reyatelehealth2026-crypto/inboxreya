/** Per-admin hourly + org-wide monthly USD budget gate for AI calls. Fail-open on Redis/DB errors. */
import { getRedis } from '@/lib/redis'
import { prisma } from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { RateLimitError } from '@/lib/errors'

export type RateLimitFeature =
  | 'ghost_draft'
  | 'summarizer'
  | 'action_suggester'
  | 'order_parser'
  | 'analyze'

const KEY_PREFIX = 'inbox:'
const SPEND_CACHE_TTL_SEC = 300

function hourlyCap(): number {
  return parseInt(process.env.AI_PER_ADMIN_HOURLY_CAP || '50', 10)
}

function monthlyBudgetUsd(): number {
  return parseFloat(process.env.AI_MONTHLY_BUDGET_USD || '200')
}

function currentMonthKey(now: Date): string {
  const y = now.getUTCFullYear()
  const m = String(now.getUTCMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

function startOfMonthUtc(now: Date): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 0, 0, 0, 0))
}

export async function getCurrentMonthSpendUsd(): Promise<number> {
  const now = new Date()
  const cacheKey = `${KEY_PREFIX}ai:spend:month:${currentMonthKey(now)}`

  try {
    const cached = await getRedis().get(cacheKey)
    if (cached !== null) {
      const parsed = parseFloat(cached)
      if (!Number.isNaN(parsed)) return parsed
    }
  } catch (err) {
    logger.warn('rate limit redis read failed', { scope: 'ai:rate-limit', err: String(err) })
  }

  let total = 0
  try {
    const result = await prisma.aiUsageLog.aggregate({
      _sum: { costUsd: true },
      where: { createdAt: { gte: startOfMonthUtc(now) } },
    })
    total = Number(result._sum.costUsd ?? 0)
  } catch (err) {
    logger.warn('rate limit budget query failed', { scope: 'ai:rate-limit', err: String(err) })
    return 0
  }

  try {
    await getRedis().set(cacheKey, String(total), 'EX', SPEND_CACHE_TTL_SEC)
  } catch {
    // cache write failure is non-fatal
  }

  return total
}

export async function checkAndIncrementRateLimit(
  adminUserId: number | string,
  feature: RateLimitFeature
): Promise<void> {
  // 1. Monthly budget gate (cheaper, cached) — check first.
  const spend = await getCurrentMonthSpendUsd()
  const budget = monthlyBudgetUsd()
  if (spend >= budget) {
    logger.warn('rate limit blocked', {
      scope: 'ai:rate-limit',
      adminUserId,
      feature,
      reason: 'monthly_budget',
    })
    throw new RateLimitError('AI budget สำหรับเดือนนี้หมดแล้ว กรุณาติดต่อแอดมิน')
  }

  // 2. Per-admin hourly window via Redis INCR/EXPIRE.
  const epochHour = Math.floor(Date.now() / 3600000)
  const key = `${KEY_PREFIX}ai:limit:${adminUserId}:${feature}:${epochHour}`
  const cap = hourlyCap()

  let count = 0
  try {
    const r = getRedis()
    const results = await r.multi().incr(key).expire(key, 3600).exec()
    const incrResult = results?.[0]
    if (incrResult && incrResult[0] == null) {
      count = Number(incrResult[1])
    }
  } catch (err) {
    logger.warn('rate limit redis incr failed', { scope: 'ai:rate-limit', err: String(err) })
    return // fail-open
  }

  if (count > cap) {
    const minutesLeft = 60 - new Date().getMinutes()
    logger.warn('rate limit blocked', {
      scope: 'ai:rate-limit',
      adminUserId,
      feature,
      reason: 'hourly_cap',
    })
    throw new RateLimitError(`ใช้ AI ครบโควต้าชั่วโมงนี้แล้ว ลองอีก ${minutesLeft} นาที`)
  }
}
