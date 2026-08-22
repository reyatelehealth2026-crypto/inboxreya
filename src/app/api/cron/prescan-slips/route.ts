import { NextResponse } from 'next/server'
import prisma from '@/lib/prisma'
import { redisGet, redisSet } from '@/lib/redis'
import { decodeSlipQr, fetchSlipImage, verifySlip } from '@/lib/slip-verify'
import { getPendingBdos, pickBdoForAmount } from '@/lib/slip-auto-match'
import { attachSlip } from '@/lib/slip-attach'

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

/**
 * How many times an image may fail verification before we stop paying to retry
 * it. A slip the bank has not posted yet usually appears within a couple of
 * minutes; anything still failing after this was never going to verify.
 */
const MAX_ATTEMPTS = 3

function scannedKey(messageId: number) {
  return `slip:prescan:${messageId}`
}

function attemptsKey(messageId: number) {
  return `slip:prescan:attempts:${messageId}`
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

    // Both are overridable so a catch-up run can sweep further back than the
    // regular window — e.g. ?minutes=780&max=60 to cover everything since this
    // morning. Capped so a stray value cannot ask for the whole message history.
    const url = new URL(request.url)
    const minutesParam = Number(url.searchParams.get('minutes'))
    const maxParam = Number(url.searchParams.get('max'))
    const lookbackMinutes =
      Number.isFinite(minutesParam) && minutesParam > 0
        ? Math.min(minutesParam, 10_080) // 7 days
        : LOOKBACK_MINUTES
    const maxVerify =
      Number.isFinite(maxParam) && maxParam > 0 ? Math.min(maxParam, 200) : MAX_VERIFY_PER_RUN

    /**
     * Rehearsal mode: re-evaluate a window and report what would happen without
     * changing anything. It ignores the scanned markers — so a window that has
     * already been processed can still be inspected — and writes none of them
     * back, attaches nothing, awards no points and sends no LINE message.
     */
    const dryRun = url.searchParams.get('dryRun') === '1'

    const since = new Date(Date.now() - lookbackMinutes * 60 * 1000)

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
      // Generous because the lookback can be widened for a catch-up run; the
      // rows are four small columns and everything already scanned is skipped.
      take: 500,
      // userId is needed to look up that customer's outstanding BDOs.
      select: { id: true, userId: true, content: true, mediaUrl: true, createdAt: true },
    })

    const messages = recent.filter((m) => m.createdAt && m.createdAt >= since)

    // Same URL shape the modal sends to /api/inbox/verify-slip — the Redis key is
    // derived from it, so any difference here would silently miss the cache.
    const phpBase = process.env.NEXT_PUBLIC_PHP_API_URL || process.env.PHP_API_URL || ''

    let scanned = 0
    let noQr = 0
    let verified = 0
    let failed = 0
    /** Failed images that hit MAX_ATTEMPTS and will not be retried again. */
    let exhausted = 0
    /** Verified slips filed against the one BDO that matched their amount. */
    let autoMatched = 0
    /** Verified, but several outstanding BDOs share the amount — left for a rep. */
    let ambiguous = 0
    /** Verified, but no outstanding BDO has that amount. */
    let noBdoMatch = 0
    /** The BDO matched but Odoo refused the attachment. */
    let attachFailed = 0
    /** Dry-run only: what a real run would have filed. */
    const wouldAttach: Array<{
      messageId: number
      userId: number | null
      amount: number
      bdoId: number
      bdoName: string | null
    }> = []

    for (const message of messages) {
      if (verified + failed >= maxVerify) break

      if (!dryRun && (await redisGet(scannedKey(message.id)))) continue

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
          if (!dryRun) await redisSet(scannedKey(message.id), '1', SCANNED_TTL_SECONDS)
          continue
        }

        // No amount is passed on purpose. Nobody is waiting on this run, so the
        // slower OCR path is fine and it avoids guessing which pending BDO the
        // customer meant to pay.
        const result = await verifySlip({ imageUrl, image })
        if (result.verified) {
          verified += 1
          // verifySlip already stored the result under the key the modal reads.
          if (!dryRun) await redisSet(scannedKey(message.id), '1', SCANNED_TTL_SECONDS)

          // The bank confirmed this transfer. If the customer has exactly one
          // outstanding BDO for that same amount, there is nothing for a rep to
          // decide — file it now so the order stops looking unpaid.
          const paidAmount = Number(result.data?.amount)
          if (message.userId && Number.isFinite(paidAmount) && paidAmount > 0) {
            const bdos = await getPendingBdos(message.userId)
            const outcome = pickBdoForAmount(bdos, paidAmount)

            if (outcome.status === 'matched' && dryRun) {
              // Rehearsal: say what would be filed, touch nothing.
              autoMatched += 1
              wouldAttach.push({
                messageId: message.id,
                userId: message.userId,
                amount: paidAmount,
                bdoId: outcome.bdo.bdo_id,
                bdoName: outcome.bdo.bdo_name ?? null,
              })
            } else if (outcome.status === 'matched') {
              const attached = await attachSlip({
                userId: message.userId,
                messageId: message.id,
                amount: paidAmount,
                transferDate: result.data?.transDate
                  ? String(result.data.transDate).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3')
                  : undefined,
                bdoId: outcome.bdo.bdo_id,
                bdoName: outcome.bdo.bdo_name ?? null,
                notifyCustomer: true,
                slipVerified: true,
                slipVerifyRef: result.data?.transRef ?? null,
                slipVerifyAmount: paidAmount,
                slipVerifyData: result.data,
                uploadedBy: 'auto-match',
              })

              if (attached.success) {
                autoMatched += 1
                console.log(
                  `[prescan-slips] auto-matched message ${message.id} -> BDO ${outcome.bdo.bdo_id} (฿${paidAmount})`
                )
              } else {
                attachFailed += 1
                console.error('[prescan-slips] attach failed for message', message.id, attached.error)
              }
            } else if (outcome.status === 'ambiguous') {
              // Several BDOs share this amount; a rep has to say which one.
              ambiguous += 1
            } else {
              noBdoMatch += 1
            }
          }
        } else {
          // A slip the bank has not registered yet ("slip-not-found") shows up
          // minutes later, so it is worth retrying — but not forever. Each failed
          // attempt costs a full OCR round trip (~60s and one slip-c call), so an
          // image that will never verify would burn quota on every run.
          failed += 1
          if (!dryRun) {
            const attempts = Number((await redisGet(attemptsKey(message.id))) || 0) + 1
            await redisSet(attemptsKey(message.id), String(attempts), SCANNED_TTL_SECONDS)
            if (attempts >= MAX_ATTEMPTS) {
              exhausted += 1
              await redisSet(scannedKey(message.id), '1', SCANNED_TTL_SECONDS)
            }
          }
        }
      } catch (error) {
        failed += 1
        console.error('[prescan-slips] message', message.id, error instanceof Error ? error.message : error)
      }
    }

    const summary = {
      success: true,
      ...(dryRun ? { dryRun: true, wouldAttach } : {}),
      lookbackMinutes,
      candidates: messages.length,
      scanned,
      noQr,
      verified,
      autoMatched,
      ambiguous,
      noBdoMatch,
      attachFailed,
      failed,
      exhausted,
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
