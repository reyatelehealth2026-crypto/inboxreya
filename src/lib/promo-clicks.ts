import { z } from 'zod'
import { imagemapRegionSchema } from '@/lib/imagemap-types'

/**
 * Imagemap clicks per brand. /r/<token> logs one `broadcast_engagement` row per
 * tap (`eventType: 'click'`, `action: 'region:<index>'`); the region's brand is
 * read back from the broadcast's stored `imagemapMeta`.
 */

export interface RegionClickRow {
  broadcastId: number
  action: string | null
  clicks: number
}

export interface ClickBroadcast {
  id: number
  content: string
  recipients: number
}

export interface BrandClicks {
  label: string
  clicks: number
  /** Recipients of every broadcast that had a region for this brand. */
  recipients: number
  /** clicks / recipients, 0 when nothing was sent. */
  ctr: number
}

export interface RegionClickSummary {
  totals: { clicks: number; recipients: number; broadcasts: number }
  brands: BrandClicks[]
}

const metaSchema = z.object({
  imagemapMeta: z.object({ regions: z.array(imagemapRegionSchema) }).optional(),
})

/** What a region was "for": its keyword, the ?k= brand of a /promo link, or the link's host. */
export function regionLabel(region: { url: string; keyword?: string }, origin: string): string {
  if (region.keyword?.trim()) return region.keyword.trim()
  try {
    const url = new URL(region.url)
    if (region.url.startsWith(`${origin.replace(/\/+$/, '')}/promo`)) {
      return url.searchParams.get('k')?.trim() || 'หน้ารวมโปร'
    }
    return url.host
  } catch {
    return region.url.slice(0, 60)
  }
}

function regionsOf(content: string) {
  try {
    const parsed = metaSchema.safeParse(JSON.parse(content))
    return parsed.success ? (parsed.data.imagemapMeta?.regions ?? []) : []
  } catch {
    return []
  }
}

export function aggregateRegionClicks(
  rows: RegionClickRow[],
  broadcasts: ClickBroadcast[],
  origin: string
): RegionClickSummary {
  const labelsByBroadcast = new Map(
    broadcasts.map((b) => [b.id, regionsOf(b.content).map((region) => regionLabel(region, origin))])
  )
  const recipientsByBroadcast = new Map(broadcasts.map((b) => [b.id, b.recipients]))

  const clicks = new Map<string, number>()
  for (const row of rows) {
    const index = Number(row.action?.match(/^region:(\d+)$/)?.[1])
    const label = labelsByBroadcast.get(row.broadcastId)?.[index]
    if (!label) continue
    clicks.set(label, (clicks.get(label) ?? 0) + row.clicks)
  }

  // A brand's reach is every broadcast that carried it, counted once per broadcast.
  const reach = new Map<string, number>()
  for (const [id, labels] of labelsByBroadcast) {
    for (const label of new Set(labels)) {
      reach.set(label, (reach.get(label) ?? 0) + (recipientsByBroadcast.get(id) ?? 0))
    }
  }

  const brands: BrandClicks[] = Array.from(reach.keys())
    .map((label) => {
      const c = clicks.get(label) ?? 0
      const r = reach.get(label) ?? 0
      return { label, clicks: c, recipients: r, ctr: r > 0 ? c / r : 0 }
    })
    // Ties keep region order (stable sort), so an untapped broadcast still lists brands as laid out.
    .sort((a, b) => b.clicks - a.clicks || b.ctr - a.ctr)

  return {
    totals: {
      clicks: rows.reduce((sum, row) => sum + row.clicks, 0),
      recipients: broadcasts.reduce((sum, b) => sum + b.recipients, 0),
      broadcasts: broadcasts.length,
    },
    brands,
  }
}
