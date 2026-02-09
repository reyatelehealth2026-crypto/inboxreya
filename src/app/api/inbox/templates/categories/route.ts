import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'

// GET /api/inbox/templates/categories - Get all template categories
export const GET = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    // Get distinct categories
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

    const categories = templates
      .map((t) => t.category)
      .filter((c): c is string => c !== null && c !== '')

    return NextResponse.json({
      success: true,
      data: categories,
    })
  } catch (error) {
    return handleAPIError(error)
  }
})
