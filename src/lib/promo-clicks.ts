import { z } from 'zod'
import { imagemapRegionSchema } from '@/lib/imagemap-types'

/**
 * Link taps per brand. /r/<token> logs one `broadcast_engagement` row per tap
 * (`eventType: 'click'`, `action: 'region:<index>'`). The index points into the
 * broadcast's imagemap regions, then its tracked flex links (see broadcast-runtime).
 *
 * CTR is people over recipients, not taps: one person tapping three times is one.
 */

/** Taps from the native all-followers broadcast carry no identity. */
const ANON = 'anon'

export interface RegionClickRow {
  broadcastId: number
  action: string | null
  lineUserId: string
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
  /** Distinct people who tapped this brand (anonymous taps count one each). */
  people: number
  /** Recipients of every broadcast that had a link for this brand. */
  recipients: number
  /** people / recipients, 0 when nothing was sent. */
  ctr: number
}

export interface RegionClickSummary {
  totals: { clicks: number; people: number; recipients: number; broadcasts: number }
  brands: BrandClicks[]
}

const metaSchema = z.object({
  imagemapMeta: z.object({ regions: z.array(imagemapRegionSchema) }).optional(),
  flexLinks: z.array(z.string()).optional(),
})

/** What a link was "for": its keyword, the ?k= brand of a /promo link, or the link's host. */
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

/** Every tracked link of a broadcast, in /r/ index order: imagemap regions, then flex links. */
function linksOf(content: string): { url: string; keyword?: string }[] {
  try {
    const parsed = metaSchema.safeParse(JSON.parse(content))
    if (!parsed.success) return []
    const regions = parsed.data.imagemapMeta?.regions ?? []
    return [...regions, ...(parsed.data.flexLinks ?? []).map((url) => ({ url }))]
  } catch {
    return []
  }
}

/** One key per person per broadcast; each anonymous tap is its own "person". */
function personKeys(row: RegionClickRow): string[] {
  if (row.lineUserId !== ANON) return [`${row.broadcastId}:${row.lineUserId}`]
  return Array.from({ length: row.clicks }, (_, i) => `${row.broadcastId}:${row.action}:${ANON}:${i}`)
}

export function aggregateRegionClicks(
  rows: RegionClickRow[],
  broadcasts: ClickBroadcast[],
  origin: string
): RegionClickSummary {
  const labelsByBroadcast = new Map(
    broadcasts.map((b) => [b.id, linksOf(b.content).map((link) => regionLabel(link, origin))])
  )
  const recipientsByBroadcast = new Map(broadcasts.map((b) => [b.id, b.recipients]))

  const clicks = new Map<string, number>()
  const people = new Map<string, Set<string>>()
  const everyone = new Set<string>()
  for (const row of rows) {
    const index = Number(row.action?.match(/^region:(\d+)$/)?.[1])
    const label = labelsByBroadcast.get(row.broadcastId)?.[index]
    if (!label) continue
    clicks.set(label, (clicks.get(label) ?? 0) + row.clicks)
    const who = people.get(label) ?? new Set<string>()
    for (const key of personKeys(row)) {
      who.add(key)
      everyone.add(key)
    }
    people.set(label, who)
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
      const p = people.get(label)?.size ?? 0
      const r = reach.get(label) ?? 0
      return { label, clicks: clicks.get(label) ?? 0, people: p, recipients: r, ctr: r > 0 ? p / r : 0 }
    })
    // Ties keep link order (stable sort), so an untapped broadcast still lists brands as laid out.
    .sort((a, b) => b.people - a.people || b.clicks - a.clicks)

  return {
    totals: {
      clicks: Array.from(clicks.values()).reduce((sum, n) => sum + n, 0),
      people: everyone.size,
      recipients: broadcasts.reduce((sum, b) => sum + b.recipients, 0),
      broadcasts: broadcasts.length,
    },
    brands,
  }
}
