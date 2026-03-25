
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

        // 3. Create a test record (optional, or just check existing)
        // We will just read the latest message to see how it looks
        const latestMessage = await prisma.message.findFirst({
            orderBy: { id: 'desc' },
            take: 1
        })

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
            latest_message: latestMessage ? {
                id: latestMessage.id.toString(),
                createdAt_Raw: latestMessage.createdAt,
                createdAt_ISO: latestMessage.createdAt.toISOString(),
                createdAt_Bangkok: latestMessage.createdAt.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
            } : null
        })
    } catch (error: any) {
        return NextResponse.json({ error: error.message }, { status: 500 })
    }
}
