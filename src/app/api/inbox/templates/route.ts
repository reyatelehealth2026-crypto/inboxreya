import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'

// Validation schemas
const createTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  content: z.string().min(1, 'Template content is required'),
  category: z.string().optional(),
  shortcuts: z.array(z.string()).optional(),
  variables: z.array(z.string()).optional(),
})

// GET /api/inbox/templates - List all templates
export const GET = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    console.log('[Templates GET] User:', JSON.stringify(user, null, 2))
    
    const { searchParams } = new URL(request.url)
    
    const search = searchParams.get('search') || ''
    const category = searchParams.get('category') || ''
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const skip = (page - 1) * limit

    console.log('[Templates GET] Query params:', { search, category, page, limit })

    // Check if user has lineAccountId (should be set by requireAuth fallback)
    if (!user.lineAccountId) {
      console.error('[Templates GET] User missing lineAccountId:', user)
      return NextResponse.json(
        { success: false, error: 'User does not have a LINE account assigned' },
        { status: 400 }
      )
    }

    console.log('[Templates GET] Using lineAccountId:', user.lineAccountId)

    // Build where clause
    const where: any = {
      line_account_id: user.lineAccountId,
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { content: { contains: search } },
      ]
    }

    if (category) {
      where.category = category
    }

    console.log('[Templates GET] Where clause:', JSON.stringify(where, null, 2))

    // Get templates with pagination
    const [templates, total] = await Promise.all([
      prisma.quick_reply_templates.findMany({
        where,
        orderBy: [
          { usage_count: 'desc' },
          { name: 'asc' },
        ],
        skip,
        take: limit,
      }),
      prisma.quick_reply_templates.count({ where }),
    ])

    console.log('[Templates GET] Found templates:', templates.length, 'Total:', total)

    // Parse JSON fields
    const parsedTemplates = templates.map(template => ({
      ...template,
      shortcuts: template.shortcuts ? JSON.parse(template.shortcuts) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
    }))

    return NextResponse.json({
      success: true,
      data: parsedTemplates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error: any) {
    console.error('[Templates GET] Error:', error)
    console.error('[Templates GET] Error message:', error?.message)
    console.error('[Templates GET] Error stack:', error?.stack)
    return handleAPIError(error)
  }
})

// POST /api/inbox/templates - Create new template
export const POST = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    const body = await request.json()
    
    // Check if user has lineAccountId
    if (!user.lineAccountId) {
      return NextResponse.json(
        { success: false, error: 'User does not have a LINE account assigned' },
        { status: 400 }
      )
    }

    // Validate input
    const validated = createTemplateSchema.parse(body)

    // Create template
    const template = await prisma.quick_reply_templates.create({
      data: {
        line_account_id: user.lineAccountId,
        name: validated.name,
        content: validated.content,
        category: validated.category || '',
        shortcuts: validated.shortcuts ? JSON.stringify(validated.shortcuts) : null,
        variables: validated.variables ? JSON.stringify(validated.variables) : null,
        usage_count: 0,
        created_by: parseInt(user.id),
      },
    })

    // Parse JSON fields for response
    const parsedTemplate = {
      ...template,
      shortcuts: template.shortcuts ? JSON.parse(template.shortcuts) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
    }

    return NextResponse.json({
      success: true,
      message: 'Template created successfully',
      data: parsedTemplate,
    })
  } catch (error) {
    console.error('[Templates API] Create error:', error)
    return handleAPIError(error)
  }
})
