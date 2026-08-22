import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { redisGet, redisSet } from '@/lib/redis'
import { decodeSlipQr, fetchSlipImage, verifySlip } from '@/lib/slip-verify'

/**
 * GET /api/cron/prescan-slips
 *
 * Verifies payment slips before anyone asks for them.
 *
 * A sales rep opening SlipUploadModal used to wait for the whole slip-c round
 * trip — up to ~56s when the QR path missed and OCR had to read the image. This
 * sweep does that work while nobody is watching and leaves the answer in the
 * same Redis key `verifySlip` reads, so the modal's check returns instantly.
 *
 * Cost control is the local QR decode: a genuine transfer slip carries a bank
 * QR, an ordinary chat photo does not, so images without one are dropped before
 * any paid call happens.
 *
 * Environment:
 * - CRON_SECRET: required secret for authorization (same scheme as the other crons)
 */

/** Marker so a message is only ever scanned once. */
const SCANNED_TTL_SECONDS = 86_400

/** Ceiling on paid slip-c calls per run. */
const MAX_VERIFY_PER_RUN = 20

/** Only look at images recent enough that a rep may still open them. */
const LOOKBACK_MINUTES = 180

function scannedKey(messageId: number) {
  return `slip:prescan:${messageId}`
}

export async function GET(request: Request) {
  const startedAt = Date.now()

  try {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret) {
      const authHeader = request.headers.get('authorization')
      if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
      }
    }

    const since = new Date(Date.now() - LOOKBACK_MINUTES * 60 * 1000)

    // The lookback is applied in JS, not as `createdAt: { gte: since }`.
    // The client in @/lib/prisma shifts every Date in a query by +7h unless the
    // field is a real TIMESTAMP column, but it decides that from the innermost
    // key — inside a range filter that key is `gte`, not `createdAt`, so the
    // exemption misses and the bound lands 7 hours in the future. This route
    // then found zero rows on every run. Taking the newest rows and filtering
    // here is correct whatever the extension does to Dates.
    const recent = await prisma.message.findMany({
      where: {
        messageType: 'image',
        direction: 'incoming',
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      select: { id: true, content: true, mediaUrl: true, createdAt: true },
    })

    const messages = recent.filter((m) => m.createdAt && m.createdAt >= since)

    // Same URL shape the modal sends to /api/inbox/verify-slip — the Redis key is
    // derived from it, so any difference here would silently miss the cache.
    const phpBase = process.env.NEXT_PUBLIC_PHP_API_URL || process.env.PHP_API_URL || ''

    let scanned = 0
    let noQr = 0
    let verified = 0
    let failed = 0

    for (const message of messages) {
      if (verified + failed >= MAX_VERIFY_PER_RUN) break

      if (await redisGet(scannedKey(message.id))) continue

      const directUrl = message.content && /^https?:\/\//.test(message.content) ? message.content : null
      const proxyUrl =
        message.mediaUrl && phpBase
          ? `${phpBase.replace(/\/$/, '')}/api/line_content.php?id=${message.mediaUrl}`
          : null
      const imageUrl = directUrl || proxyUrl
      if (!imageUrl) continue

      scanned += 1

      try {
        const image = await fetchSlipImage(imageUrl)
        if (!image) {
          // Transient download failure: leave it unmarked so the next run retries.
          continue
        }

        const qr = await decodeSlipQr(image.buffer)
        if (!qr) {
          // Not a transfer slip. Mark it so we never pay to look again.
          noQr += 1
          await redisSet(scannedKey(message.id), '1', SCANNED_TTL_SECONDS)
          continue
        }

        // No amount is passed on purpose. Nobody is waiting on this run, so the
        // slower OCR path is fine and it avoids guessing which pending BDO the
        // customer meant to pay.
        const result = await verifySlip({ imageUrl, image })
        if (result.verified) {
          verified += 1
          // verifySlip already stored the result under the key the modal reads.
          await redisSet(scannedKey(message.id), '1', SCANNED_TTL_SECONDS)
        } else {
          // A slip the bank has not registered yet ("slip-not-found") shows up
          // minutes later, so leave it unmarked and let the next run retry.
          failed += 1
        }
      } catch (error) {
        failed += 1
        console.error('[prescan-slips] message', message.id, error instanceof Error ? error.message : error)
      }
    }

    const summary = {
      success: true,
      candidates: messages.length,
      scanned,
      noQr,
      verified,
      failed,
      tookMs: Date.now() - startedAt,
      timestamp: new Date().toISOString(),
    }

    console.log('[prescan-slips]', JSON.stringify(summary))
    return NextResponse.json(summary)
  } catch (error) {
    console.error('[prescan-slips] Error:', error)
    return NextResponse.json({ error: 'Failed to run slip pre-scan' }, { status: 500 })
  }
}
