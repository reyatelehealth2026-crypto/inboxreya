import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'
import { cacheQuery, CACHE_TTL } from '@/lib/redis'

// GET /api/inbox/templates/categories - Get all template categories
export const GET = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    const categories = await cacheQuery(
      `templates:categories:${user.lineAccountId}`,
      async () => {
        const templates = await prisma.quick_reply_templates.findMany({
          where: {
            line_account_id: user.lineAccountId,
            AND: [
              { category: { not: null } },
              { category: { not: '' } },
            ],
          },
          select: {
            category: true,
          },
          distinct: ['category'],
          orderBy: {
            category: 'asc',
          },
        })

        return templates
          .map((t) => t.category)
          .filter((c): c is string => c !== null && c !== '')
      },
      CACHE_TTL.TEMPLATES  // 300s
    )

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    return handleAPIError(error)
  }
})
