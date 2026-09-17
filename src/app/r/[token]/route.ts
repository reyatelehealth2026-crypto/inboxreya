// GET /r/[token] — imagemap broadcast click redirect.
//
// Public route (see middleware.ts publicRoutes: '/r/'). Verifies the signed
// token, logs a click, optionally tags the clicking user with the region's
// interest tag, then 302s to the region's destination URL. The destination
// comes ONLY from the DB (never from the request) — no open redirect.
//
// The customer must never see an error: any invalid token, missing
// broadcast/region, or thrown DB error falls back to a 302 to /promo.
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { verifyLink, type BroadcastLinkPayload } from '@/lib/broadcast-link'
import { imagemapRegionSchema, type ImagemapRegion } from '@/lib/imagemap-types'
import { getPublicOrigin } from '@/lib/broadcast-runtime'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Defensive re-validation of the stored envelope's imagemapMeta — it is
// stored data written by another code path, never trusted blindly here.
const imagemapMetaSchema = z.object({
  baseKey: z.string().min(1),
  regions: z.array(imagemapRegionSchema).min(1).max(12),
})

interface RouteContext {
  params: Promise<{ token: string }>
}

function redirectToPromo(): NextResponse {
  return NextResponse.redirect(`${getPublicOrigin()}/promo`, 302)
}

export async function GET(req: NextRequest, { params }: RouteContext) {
  const { token } = await params

  let payload: BroadcastLinkPayload | null
  try {
    payload = verifyLink(token)
  } catch (error) {
    console.error('[click-redirect] verifyLink failed:', error)
    return redirectToPromo()
  }
  if (!payload) return redirectToPromo()

  let region: ImagemapRegion
  let broadcastLineAccountId: number
  try {
    const broadcast = await prisma.broadcastMessageV2.findUnique({
      where: { id: payload.b },
      select: { content: true, lineAccountId: true },
    })
    if (!broadcast) return redirectToPromo()

    const parsedContent = JSON.parse(broadcast.content) as unknown
    const metaResult = imagemapMetaSchema.safeParse(
      (parsedContent as { imagemapMeta?: unknown } | null)?.imagemapMeta
    )
    if (!metaResult.success) return redirectToPromo()

    const candidate = metaResult.data.regions[payload.r]
    if (!candidate || !candidate.url.startsWith('https://')) return redirectToPromo()

    region = candidate
    broadcastLineAccountId = broadcast.lineAccountId
  } catch (error) {
    console.error('[click-redirect] failed to resolve broadcast/region:', error)
    return redirectToPromo()
  }

  // From here the redirect destination is known — logging/tagging failures
  // must never block the customer from reaching region.url.
  try {
    let lineUserId = 'anon'
    let lineUserPkId: number | null = null
    let canTag = false

    if (payload.u > 0) {
      const user = await prisma.lineUser.findUnique({
        where: { id: payload.u },
        select: { id: true, lineUserId: true, lineAccountId: true },
      })
      if (user) {
        lineUserId = user.lineUserId
        lineUserPkId = user.id
        canTag = user.lineAccountId === broadcastLineAccountId
      }
    }

    const userAgent = req.headers.get('user-agent')?.slice(0, 255) ?? null

    await prisma.broadcastEngagement.create({
      data: {
        broadcastId: payload.b,
        lineUserId,
        lineUserPkId,
        eventType: 'click',
        action: `region:${payload.r}`,
        source: 'redirect',
        userAgent,
      },
    })

    if (canTag && lineUserPkId !== null && typeof region.tagId === 'number') {
      const tag = await prisma.userTag.findUnique({
        where: { id: region.tagId },
        select: { id: true, lineAccountId: true },
      })
      if (tag && (tag.lineAccountId === null || tag.lineAccountId === broadcastLineAccountId)) {
        const assignedReason = `broadcast:${payload.b}:region:${payload.r}`
        await prisma.userTagAssignment.upsert({
          where: { userId_tagId: { userId: lineUserPkId, tagId: tag.id } },
          update: {},
          create: {
            userId: lineUserPkId,
            tagId: tag.id,
            assignedBy: 'broadcast_click',
            assignedReason,
          },
        })
      }
    }
  } catch (error) {
    console.error('[click-redirect] logging/tagging failed:', error)
  }

  return NextResponse.redirect(region.url, 302)
}
