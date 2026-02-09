import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'

// POST /api/inbox/templates/[id]/use - Track template usage
export const POST = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const idIndex = pathParts.indexOf('templates') + 1
    const id = pathParts[idIndex]
    const templateId = parseInt(id)

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID' },
        { status: 400 }
      )
    }

    // Check if template exists and belongs to user's LINE account
    const existing = await prisma.quick_reply_templates.findFirst({
      where: {
        id: templateId,
        line_account_id: user.lineAccountId,
      },
    })

    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Update usage count and last used timestamp
    await prisma.quick_reply_templates.update({
      where: { id: templateId },
      data: {
        usage_count: {
          increment: 1,
        },
        last_used_at: new Date(),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Usage tracked successfully',
    })
  } catch (error) {
    return handleAPIError(error)
  }
})
