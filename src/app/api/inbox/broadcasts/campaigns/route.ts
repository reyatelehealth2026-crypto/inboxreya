import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import { parseStoredBroadcast } from '@/lib/broadcast-runtime'
import { toBroadcastCreatedAtIso } from '@/lib/broadcast-time'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

const VALID_STATUSES = ['draft', 'scheduled', 'sending', 'sent', 'failed', 'cancelled'] as const
type CampaignStatus = (typeof VALID_STATUSES)[number]

function isCampaignStatus(value: string): value is CampaignStatus {
  return (VALID_STATUSES as readonly string[]).includes(value)
}

// GET /api/inbox/broadcasts/campaigns
// Lists broadcasts (any status) parsed into campaign-shaped objects:
//   title, messageCount, messages[], tags[], targetMode, schedule, stats
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult

    const lineAccountId = user.lineAccountId as number
    const { searchParams } = new URL(req.url)

    const page = Math.max(1, parseInt(searchParams.get('page') || '1'))
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '20')))
    const statusParam = searchParams.get('status') || ''
    const search = (searchParams.get('search') || '').trim()

    const statusFilters: CampaignStatus[] = statusParam
      .split(',')
      .map((s) => s.trim())
      .filter((s): s is CampaignStatus => !!s && isCampaignStatus(s))

    const cacheKey = `broadcasts:campaigns:account:${lineAccountId}:p=${page}:l=${limit}:s=${statusFilters.join('|') || 'all'}:q=${search.toLowerCase()}`

    const data = await cacheQuery(
      cacheKey,
      async () => {
        const where: {
          lineAccountId: number
          status?: { in: CampaignStatus[] }
          content?: { contains: string }
        } = { lineAccountId }
        if (statusFilters.length > 0) where.status = { in: statusFilters }
        if (search) where.content = { contains: search }

        // Pull a bounded window to refine in memory.
        const fetchLimit = search ? 500 : limit * page + limit
        const rows = await prisma.broadcastMessageV2.findMany({
          where,
          orderBy: { createdAt: 'desc' },
          take: fetchLimit,
        })

        const parsedRows = rows.map((b) => {
          const parsed = parseStoredBroadcast(b.content, b.mediaUrl)
          const tagIds =
            parsed.target.mode === 'tags' && Array.isArray(parsed.target.tagIds)
              ? parsed.target.tagIds
              : []
          return { broadcast: b, parsed, tagIds }
        })

        const refined = search
          ? parsedRows.filter((r) => r.parsed.summaryText.toLowerCase().includes(search.toLowerCase()))
          : parsedRows

        const total = refined.length
        const start = (page - 1) * limit
        const pageSlice = refined.slice(start, start + limit)

        // Resolve tag display info for the visible slice only.
        const tagIdsToFetch = new Set<number>()
        for (const r of pageSlice) {
          for (const id of r.tagIds) tagIdsToFetch.add(id)
        }
        const tagRecords =
          tagIdsToFetch.size > 0
            ? await prisma.userTag.findMany({
                where: { id: { in: Array.from(tagIdsToFetch) } },
                select: { id: true, name: true, color: true },
              })
            : []
        const tagsById = new Map(tagRecords.map((t) => [t.id, t]))

        const campaigns = pageSlice.map(({ broadcast, parsed, tagIds }) => {
          const tags = tagIds
            .map((id) => tagsById.get(id))
            .filter((t): t is { id: number; name: string; color: string } => !!t)

          return {
            id: broadcast.id,
            title: parsed.summaryText || 'Broadcast',
            messageType: parsed.messageType,
            messageCount: parsed.messages.length,
            messages: parsed.messages,
            tags,
            tagIds,
            targetMode: parsed.target.mode,
            status: broadcast.status as CampaignStatus,
            scheduledAt: broadcast.scheduledAt?.toISOString() || null,
            sentAt: broadcast.sentAt?.toISOString() || null,
            totalRecipients: broadcast.totalRecipients,
            deliveredCount: broadcast.deliveredCount,
            readCount: broadcast.readCount,
            mediaUrl: broadcast.mediaUrl,
            createdAt: toBroadcastCreatedAtIso(broadcast.createdAt),
            createdBy: broadcast.createdBy,
          }
        })

        return {
          campaigns,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / limit)),
          },
        }
      },
      CACHE_TTL.BROADCASTS
    )

    return NextResponse.json({ success: true, data })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to fetch campaigns'
    console.error('[Campaigns] GET error:', error)
    return NextResponse.json(
      { success: false, error: message },
      { status: message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
