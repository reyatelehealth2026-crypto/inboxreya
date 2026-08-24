import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

/**
 * GET /api/inbox/slip-report?days=7
 *
 * Every slip that passed verification and which BDO it was attached to.
 *
 * The Slip Center dashboard answers a different question — it reads Odoo through
 * PHP and shows what is still outstanding. This reads the record the inbox itself
 * writes when a rep attaches a slip (`Message.metadata.slip`), so it can say who
 * sent it, what the bank confirmed, and how many points the customer got.
 */

/** Raw row shape from the join below. */
interface ReportRow {
  id: number
  user_id: number | null
  content: string | null
  media_url: string | null
  metadata: string | null
  created_at: Date
  display_name: string | null
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const parsedDays = Number(new URL(request.url).searchParams.get('days'))
    // Clamped to a plain number before interpolation — by the time it reaches the
    // query it is no longer user text.
    const days = Number.isFinite(parsedDays) && parsedDays > 0 ? Math.min(Math.floor(parsedDays), 90) : 7

    // Raw SQL on purpose. `metadata` is a JSON string in a LongText column, which
    // Prisma cannot filter on, and the client extension in @/lib/prisma shifts
    // Date arguments by +7h inside range filters — `INTERVAL n DAY` sidesteps both.
    const rows = await prisma.$queryRawUnsafe<ReportRow[]>(
      `SELECT m.id, m.user_id, m.content, m.media_url, m.metadata, m.created_at,
              u.display_name
         FROM messages m
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.message_type = 'image'
          AND m.metadata LIKE '%"slip":%'
          AND m.created_at >= NOW() - INTERVAL ${days} DAY
        ORDER BY m.created_at DESC
        LIMIT 500`
    )

    // Every image the customers sent in the window, slip or not. Counted
    // separately because the rows above are already narrowed to the ones the
    // scanner wrote a result onto — without this the report can say how many
    // slips passed but not how many pictures it took to get them.
    const [images] = await prisma.$queryRawUnsafe<Array<{ received: bigint | number }>>(
      `SELECT COUNT(*) AS received
         FROM messages
        WHERE message_type = 'image'
          AND created_at >= NOW() - INTERVAL ${days} DAY`
    )

    const phpBase = process.env.NEXT_PUBLIC_PHP_API_URL || process.env.PHP_API_URL || ''

    const items = rows
      .map((row) => {
        let slip: Record<string, any> | null = null
        try {
          slip = JSON.parse(row.metadata || '{}')?.slip ?? null
        } catch {
          slip = null
        }
        if (!slip?.verified) return null

        const directUrl = row.content && /^https?:\/\//.test(row.content) ? row.content : null
        const proxyUrl =
          row.media_url && phpBase
            ? `${phpBase.replace(/\/$/, '')}/api/line_content.php?id=${row.media_url}`
            : null

        return {
          messageId: row.id,
          userId: row.user_id,
          customerName: row.display_name,
          bdoId: slip.bdoId ?? null,
          invoiceId: slip.invoiceId ?? null,
          bdoName: slip.bdoName ?? null,
          amount: typeof slip.amount === 'number' ? slip.amount : null,
          ref: slip.ref ?? null,
          points: typeof slip.points === 'number' ? slip.points : 0,
          verifiedAt: slip.at ?? null,
          receivedAt: row.created_at,
          imageUrl: directUrl || proxyUrl,
        }
      })
      .filter((item): item is NonNullable<typeof item> => item !== null)

    // The funnel, narrowing at each step: every picture that arrived, the ones
    // the scanner actually ruled on, the ones the bank confirmed, and finally
    // what each confirmed slip was filed against.
    const summary = {
      received: Number(images?.received ?? 0),
      checked: rows.length,
      slips: items.length,
      // Filed against a delivery order, the ordinary path.
      matchedBdo: items.filter((i) => i.bdoId).length,
      // Filed against an invoice — customers who pay before delivery, whose BDO
      // does not exist yet when the slip arrives.
      matchedInvoice: items.filter((i) => !i.bdoId && i.invoiceId).length,
      // Passed the bank check but sits against nothing: saved from the chat
      // shortcut, or the amount fit no outstanding bill. This is the queue.
      unmatched: items.filter((i) => !i.bdoId && !i.invoiceId).length,
      totalAmount: items.reduce((sum, i) => sum + (i.amount || 0), 0),
      totalPoints: items.reduce((sum, i) => sum + i.points, 0),
      customers: new Set(items.map((i) => i.userId).filter(Boolean)).size,
    }

    return NextResponse.json({ success: true, days, summary, items })
  } catch (error) {
    console.error('[slip-report] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
