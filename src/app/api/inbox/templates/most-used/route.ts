import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'

// GET /api/inbox/templates/most-used - Get most used templates
export const GET = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    const { searchParams } = new URL(request.url)
    
    const limit = parseInt(searchParams.get('limit') || '5')

    // Get most used templates
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

    // Parse JSON fields
    const parsedTemplates = templates.map((template) => ({
      ...template,
      shortcuts: template.shortcuts ? JSON.parse(template.shortcuts) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
    }))

    return NextResponse.json({
      success: true,
      data: parsedTemplates,
    })
  } catch (error) {
    return handleAPIError(error)
  }
})
