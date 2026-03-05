"use client"

import { useQuery } from '@tanstack/react-query'
import { CreditCard, Clock, AlertCircle } from 'lucide-react'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { OdooCreditCard } from './OdooCreditCard'
import { OdooOrderTimeline } from './OdooOrderTimeline'
import type { Customer360Credit, Customer360TimelineEvent, Customer360WebhookSummary } from '@/types/odoo'

interface Customer360SectionProps {
  userId: string
  lineUserId?: string | null
  memberId?: string | null
}

interface Customer360Result {
  credit: Customer360Credit | null
  timeline: Customer360TimelineEvent[]
  webhook_summary: Customer360WebhookSummary | null
}

async function fetchCustomer360(userId: string): Promise<Customer360Result> {
  try {
    const response = await fetch(`/api/inbox/customers/${userId}/customer-360`, {
      cache: 'no-store',
    })
    if (!response.ok) {
      return { credit: null, timeline: [], webhook_summary: null }
    }
    const result = await response.json()
    if (!result.success) {
      return { credit: null, timeline: [], webhook_summary: null }
    }
    const data = result.data
    return {
      credit: data?.credit || null,
      timeline: data?.timeline || [],
      webhook_summary: data?.webhook_summary || null,
    }
  } catch {
    return { credit: null, timeline: [], webhook_summary: null }
  }
}

export default function Customer360Section({ userId, lineUserId, memberId }: Customer360SectionProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['customer-360', userId],
    queryFn: () => fetchCustomer360(userId),
    enabled: !!userId,
    staleTime: 60 * 1000,
  })

  if (isLoading) {
    return (
      <Card className="p-6">
        <Skeleton className="h-6 w-32 mb-4" />
        <Skeleton className="h-20 w-full mb-3" />
        <Skeleton className="h-40 w-full" />
      </Card>
    )
  }

  const credit = data?.credit || null
  const timeline = data?.timeline || []
  const summary = data?.webhook_summary || null

  const hasCredit = credit && (credit.credit_limit || credit.total_due || credit.overdue_amount)
  const hasTimeline = timeline.length > 0

  if (!hasCredit && !hasTimeline) {
    return null
  }

  return (
    <>
      {hasCredit && (
        <Card className="p-6">
          <div className="flex items-center gap-2 mb-4">
            <CreditCard className="h-5 w-5 text-gray-600" />
            <h2 className="text-base font-semibold">วงเงินเครดิต</h2>
          </div>
          <OdooCreditCard credit={credit} />
        </Card>
      )}

      {hasTimeline && (
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-600" />
              <h2 className="text-base font-semibold">Webhook Timeline</h2>
            </div>
            {summary && (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <span className="text-green-600 font-medium">{summary.success} ✓</span>
                {summary.failed > 0 && (
                  <span className="text-red-600 font-medium">{summary.failed} ✗</span>
                )}
                <span>{summary.total} total</span>
              </div>
            )}
          </div>
          <OdooOrderTimeline events={timeline} maxItems={15} />
        </Card>
      )}
    </>
  )
}
