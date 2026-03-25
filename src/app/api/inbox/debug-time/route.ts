
import { NextRequest, NextResponse } from 'next/server'
import prisma from '@/lib/prisma'

export async function GET(request: NextRequest) {
    try {
        // 1. Get Node.js System Time
        const systemDate = new Date()
        const systemTimeISO = systemDate.toISOString()
        const systemTimeBangkok = systemDate.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })

        // 2. Get DB Time via Raw Query
        const dbTimeResult = await prisma.$queryRaw`SELECT NOW() as db_now, @@global.time_zone as global_tz, @@session.time_zone as session_tz`

        // 3. Read latest message via Prisma ORM
        const latestMessage = await prisma.message.findFirst({
            orderBy: { id: 'desc' },
            take: 1
        })

        // 4. Read same message via raw SQL to see the naked DATETIME string MySQL stores
        type RawMsg = { id: bigint; created_at_raw: string }
        const rawRows = await prisma.$queryRaw<RawMsg[]>`
            SELECT id, DATE_FORMAT(created_at, '%Y-%m-%dT%H:%i:%sZ') AS created_at_raw
            FROM messages ORDER BY id DESC LIMIT 1`
        const rawRow = rawRows[0] ?? null

        const dbUrl = process.env.DATABASE_URL ?? ''
        const hasTimezone = /[?&]timezone=/.test(dbUrl)
        const timezoneMatch = dbUrl.match(/[?&]timezone=([^&]*)/)

        return NextResponse.json({
            system: {
                iso: systemTimeISO,
                bangkok: systemTimeBangkok,
                timezoneOffset: systemDate.getTimezoneOffset()
            },
            db_url_debug: {
                has_timezone_param: hasTimezone,
                timezone_value: timezoneMatch ? decodeURIComponent(timezoneMatch[1]) : null,
                DATABASE_MYSQL_TIMEZONE_env: process.env.DATABASE_MYSQL_TIMEZONE ?? '(not set)',
            },
            db_status: dbTimeResult,
            latest_message_prisma: latestMessage ? {
                id: latestMessage.id.toString(),
                createdAt_JS_Date: latestMessage.createdAt,
                createdAt_ISO: latestMessage.createdAt.toISOString(),
                createdAt_Bangkok: latestMessage.createdAt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
            } : null,
            latest_message_raw_sql: rawRow ? {
                id: rawRow.id.toString(),
                // DATE_FORMAT with 'Z' suffix shows the naked value MySQL stores (no TZ conversion)
                created_at_naked: rawRow.created_at_raw,
            } : null,
            diagnosis: latestMessage && rawRow ? (() => {
                const naked = rawRow.created_at_raw  // e.g. "2026-03-25T10:51:08Z"
                const prismaUTC = latestMessage.createdAt.toISOString()  // what Prisma thinks
                const nakedHour = parseInt(naked.slice(11, 13))
                const prismaHour = parseInt(prismaUTC.slice(11, 13))
                const diff = prismaHour - nakedHour
                return {
                    naked_mysql_value: naked,
                    prisma_interpreted_as_utc: prismaUTC,
                    hour_diff_prisma_minus_naked: diff,
                    meaning: diff === 0
                        ? 'Prisma treats naked value as UTC (timezone param NOT working or +00:00)'
                        : diff === -7
                        ? 'Prisma correctly subtracts 7h (timezone=+07:00 working)'
                        : diff === -8
                        ? 'Prisma subtracts 8h (timezone=+08:00)'
                        : `Prisma offset = ${diff}h from naked value`
                }
            })() : null
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
