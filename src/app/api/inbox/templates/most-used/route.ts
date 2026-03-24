import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

// GET /api/inbox/templates/most-used - Get most used templates
export const GET = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '5')

    const parsedTemplates = await cacheQuery(
      `templates:mostused:${user.lineAccountId}:${limit}`,
      async () => {
        const templates = await prisma.quick_reply_templates.findMany({
          where: {
            line_account_id: user.lineAccountId,
            usage_count: {
              gt: 0,
            },
          },
          orderBy: {
            usage_count: 'desc',
          },
          take: limit,
        })

        return templates.map((template) => ({
          ...template,
          shortcuts: template.shortcuts ? JSON.parse(template.shortcuts) : [],
          variables: template.variables ? JSON.parse(template.variables) : [],
        }))
      },
      CACHE_TTL.CUSTOMER_PROFILE  // 120s
    )

    return NextResponse.json({
      success: true,
      data: parsedTemplates,
    })
  } catch (error) {
    return handleAPIError(error)
  }
})
