import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

async function guard() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = session.user.role
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { error: null as null }
}

interface DailyRow {
  day: string | Date
  feature: string
  calls: bigint
  tokens: bigint
  cost: number
}

interface MonthRow {
  cost: number | null
  calls: bigint
}

export async function GET() {
  const { error } = await guard()
  if (error) return error

  try {
    const rows = await prisma.$queryRaw<DailyRow[]>`
      SELECT DATE(created_at) as day, feature,
             COUNT(*) as calls,
             SUM(prompt_tokens + output_tokens) as tokens,
             SUM(cost_usd) as cost
      FROM ai_usage_logs
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
      GROUP BY DATE(created_at), feature
      ORDER BY day ASC`

    const monthRows = await prisma.$queryRaw<MonthRow[]>`
      SELECT SUM(cost_usd) as cost, COUNT(*) as calls
      FROM ai_usage_logs
      WHERE YEAR(created_at) = YEAR(NOW())
        AND MONTH(created_at) = MONTH(NOW())`

    const daily = rows.map((r) => ({
      day:
        r.day instanceof Date
          ? r.day.toISOString().slice(0, 10)
          : String(r.day).slice(0, 10),
      feature: r.feature,
      calls: Number(r.calls),
      tokens: Number(r.tokens ?? 0),
      cost: Number(r.cost ?? 0),
    }))

    const monthCost = Number(monthRows[0]?.cost ?? 0)
    const monthCalls = Number(monthRows[0]?.calls ?? 0)

    return NextResponse.json({ daily, monthCost, monthCalls })
  } catch (err) {
    logger.error(err, { scope: 'admin/ai-usage:GET' })
    return NextResponse.json({ error: 'Failed to load usage' }, { status: 500 })
  }
}
