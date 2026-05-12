'use client'

import { useEffect, useState } from 'react'
import { AlertCircle, Loader2, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination'
import { useCampaigns, type Campaign } from '@/hooks/use-campaigns'
import { useCancelBroadcast, useSendBroadcast } from '@/hooks/use-broadcasts'
import { useToast } from '@/hooks/use-toast'
import { CampaignFilters } from './CampaignFilters'
import { CampaignCard } from './CampaignCard'
import { CampaignDetailSheet } from './CampaignDetailSheet'
import { CreateBroadcastDialog } from '../CreateBroadcastDialog'

const PAGE_SIZE = 12

export function CampaignList() {
  const [status, setStatus] = useState<string>('all')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [activeCampaign, setActiveCampaign] = useState<Campaign | null>(null)

  const { toast } = useToast()
  const cancelBroadcast = useCancelBroadcast()
  const sendBroadcast = useSendBroadcast()

  // Reset to page 1 when filters change.
  useEffect(() => {
    setPage(1)
  }, [status, search])

  const { data, isLoading, isFetching, error } = useCampaigns({
    page,
    limit: PAGE_SIZE,
    status: status === 'all' ? '' : status,
    search,
  })

  const campaigns = data?.data?.campaigns || []
  const pagination = data?.data?.pagination

  const handleOpenCampaign = (campaign: Campaign) => {
    setActiveCampaign(campaign)
    setDetailOpen(true)
  }

  const handleCancel = async (campaign: Campaign) => {
    try {
      await cancelBroadcast.mutateAsync(campaign.id)
      toast({ title: 'ยกเลิก Campaign สำเร็จ' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง'
      toast({ title: 'ยกเลิกไม่สำเร็จ', description: message, variant: 'destructive' })
    }
  }

  const handleSendNow = async (campaign: Campaign) => {
    try {
      await sendBroadcast.mutateAsync(campaign.id)
      toast({ title: 'ส่ง Campaign สำเร็จ' })
    } catch (err) {
      const message = err instanceof Error ? err.message : 'กรุณาลองใหม่อีกครั้ง'
      toast({ title: 'ส่งไม่สำเร็จ', description: message, variant: 'destructive' })
    }
  }

  const pageNumbers = pagination ? buildPageList(pagination.page, pagination.totalPages) : []

  return (
    <Card>
      <CardContent className="space-y-4 p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <CampaignFilters
            status={status}
            search={search}
            onStatusChange={setStatus}
            onSearchChange={setSearch}
            className="flex-1"
          />
          <Button onClick={() => setCreateOpen(true)} className="shrink-0">
            <Plus className="mr-2 h-4 w-4" />
            สร้าง Campaign
          </Button>
        </div>

        {error ? (
          <Card className="border-destructive/30 bg-destructive/5">
            <CardContent className="flex items-center gap-2 p-4 text-sm text-destructive">
              <AlertCircle className="h-4 w-4" />
              {(error as Error).message || 'โหลดข้อมูล Campaign ไม่สำเร็จ'}
            </CardContent>
          </Card>
        ) : null}

        {isLoading && campaigns.length === 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="space-y-3 p-4">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                  <Skeleton className="h-3 w-2/3" />
                  <Skeleton className="h-2 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : campaigns.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center justify-center gap-2 p-12 text-center text-muted-foreground">
              <AlertCircle className="h-8 w-8 opacity-50" />
              <p className="font-medium">ยังไม่มี Campaign</p>
              <p className="text-xs">
                {search || status !== 'all'
                  ? 'ไม่พบ Campaign ตามตัวกรอง ลองล้างตัวกรอง หรือสร้างใหม่'
                  : 'เริ่มต้นด้วยการสร้าง Campaign แรกของคุณ'}
              </p>
              <Button onClick={() => setCreateOpen(true)} variant="outline" className="mt-2">
                <Plus className="mr-2 h-4 w-4" />
                สร้าง Campaign แรก
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="relative">
            {isFetching ? (
              <div className="pointer-events-none absolute right-0 top-0 z-10 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                อัปเดต...
              </div>
            ) : null}
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  onOpen={handleOpenCampaign}
                  onCancel={handleCancel}
                  onSendNow={handleSendNow}
                  isCancelling={cancelBroadcast.isPending}
                  isSending={sendBroadcast.isPending}
                />
              ))}
            </div>
          </div>
        )}

        {pagination && pagination.totalPages > 1 ? (
          <Pagination>
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className={page === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer'}
                />
              </PaginationItem>
              {pageNumbers.map((p, idx) =>
                p === 'ellipsis' ? (
                  <PaginationItem key={`e-${idx}`}>
                    <span className="px-3 text-muted-foreground">…</span>
                  </PaginationItem>
                ) : (
                  <PaginationItem key={p}>
                    <PaginationLink
                      isActive={p === pagination.page}
                      onClick={() => setPage(p)}
                      className="cursor-pointer"
                    >
                      {p}
                    </PaginationLink>
                  </PaginationItem>
                )
              )}
              <PaginationItem>
                <PaginationNext
                  onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                  className={
                    page === pagination.totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer'
                  }
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        ) : null}
      </CardContent>

      <CampaignDetailSheet
        open={detailOpen}
        campaign={activeCampaign}
        onOpenChange={(open) => {
          setDetailOpen(open)
          if (!open) setActiveCampaign(null)
        }}
      />

      <CreateBroadcastDialog open={createOpen} onOpenChange={setCreateOpen} />
    </Card>
  )
}

// Generate compact pagination list like: 1 … 4 5 6 … 20
function buildPageList(current: number, total: number): (number | 'ellipsis')[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const pages: (number | 'ellipsis')[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) pages.push('ellipsis')
  for (let p = left; p <= right; p++) pages.push(p)
  if (right < total - 1) pages.push('ellipsis')
  pages.push(total)
  return pages
}
