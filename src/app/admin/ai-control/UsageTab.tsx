'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface DailyPoint {
  day: string
  feature: string
  calls: number
  tokens: number
  cost: number
}

interface UsageResponse {
  daily: DailyPoint[]
  monthCost: number
  monthCalls: number
}

const COLORS = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#0891b2']

async function fetchUsage(): Promise<UsageResponse> {
  const res = await fetch('/api/admin/ai-usage')
  if (!res.ok) throw new Error('Failed to load usage: ' + res.status)
  return (await res.json()) as UsageResponse
}

export function UsageTab() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['admin', 'ai-usage'],
    queryFn: fetchUsage,
  })

  const { chartData, features } = useMemo(() => {
    if (!data) return { chartData: [] as Array<Record<string, number | string>>, features: [] as string[] }
    const featureSet = new Set<string>()
    const byDay = new Map<string, Record<string, number | string>>()
    for (const row of data.daily) {
      featureSet.add(row.feature)
      const existing = byDay.get(row.day) ?? { day: row.day }
      existing[row.feature] = row.calls
      byDay.set(row.day, existing)
    }
    const days = Array.from(byDay.keys()).sort()
    const series = days.map((d) => byDay.get(d) ?? { day: d })
    return { chartData: series, features: Array.from(featureSet).sort() }
  }, [data])

  if (isLoading) return <div className="text-sm text-muted-foreground">Loading usage…</div>
  if (error) return <div className="text-sm text-red-600">Failed to load usage.</div>

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">เดือนนี้ใช้จ่าย</div>
          <div className="mt-1 text-2xl font-semibold">
            ${(data?.monthCost ?? 0).toFixed(2)}
          </div>
        </div>
        <div className="rounded-lg border bg-card p-4">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">เดือนนี้เรียก</div>
          <div className="mt-1 text-2xl font-semibold">
            {(data?.monthCalls ?? 0).toLocaleString()} ครั้ง
          </div>
        </div>
      </div>

      <div className="rounded-lg border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium text-muted-foreground">
          Calls / day by feature (30d)
        </h2>
        <div style={{ width: '100%', height: 320 }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis dataKey="day" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              {features.map((f, idx) => (
                <Line
                  key={f}
                  type="monotone"
                  dataKey={f}
                  stroke={COLORS[idx % COLORS.length]}
                  strokeWidth={2}
                  dot={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  )
}
