import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { withAuth } from '@/lib/auth-middleware'
import { handleAPIError } from '@/lib/api-utils'

// Validation schemas
const updateTemplateSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  content: z.string().min(1).optional(),
  category: z.string().optional(),
  shortcuts: z.array(z.string()).optional(),
  variables: z.array(z.string()).optional(),
})

// GET /api/inbox/templates/[id] - Get single template
export const GET = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]
    const templateId = parseInt(id)

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID' },
        { status: 400 }
      )
    }

    const template = await prisma.quick_reply_templates.findFirst({
      where: {
        id: templateId,
        line_account_id: user.lineAccountId,
      },
    })

    if (!template) {
      return NextResponse.json(
        { success: false, error: 'Template not found' },
        { status: 404 }
      )
    }

    // Parse JSON fields
    const parsedTemplate = {
      ...template,
      shortcuts: template.shortcuts ? JSON.parse(template.shortcuts) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
    }

    return NextResponse.json({
      success: true,
      data: parsedTemplate,
    })
  } catch (error) {
    return handleAPIError(error)
  }
})

// PATCH /api/inbox/templates/[id] - Update template
export const PATCH = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]
    const templateId = parseInt(id)

    if (isNaN(templateId)) {
      return NextResponse.json(
        { success: false, error: 'Invalid template ID' },
        { status: 400 }
      )
    }

    const body = await request.json()
    const validated = updateTemplateSchema.parse(body)

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

    // Update template
    const updateData: any = {}
    if (validated.name !== undefined) updateData.name = validated.name
    if (validated.content !== undefined) updateData.content = validated.content
    if (validated.category !== undefined) updateData.category = validated.category
    if (validated.shortcuts !== undefined) {
      updateData.shortcuts = JSON.stringify(validated.shortcuts)
    }
    if (validated.variables !== undefined) {
      updateData.variables = JSON.stringify(validated.variables)
    }

    const template = await prisma.quick_reply_templates.update({
      where: { id: templateId },
      data: updateData,
    })

    // Parse JSON fields for response
    const parsedTemplate = {
      ...template,
      shortcuts: template.shortcuts ? JSON.parse(template.shortcuts) : [],
      variables: template.variables ? JSON.parse(template.variables) : [],
    }

    return NextResponse.json({
      success: true,
      message: 'Template updated successfully',
      data: parsedTemplate,
    })
  } catch (error) {
    return handleAPIError(error)
  }
})

// DELETE /api/inbox/templates/[id] - Delete template
export const DELETE = withAuth(async (
  request: NextRequest,
  { user }
) => {
  try {
    // Extract ID from URL path
    const url = new URL(request.url)
    const pathParts = url.pathname.split('/')
    const id = pathParts[pathParts.length - 1]
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

    // Delete template
    await prisma.quick_reply_templates.delete({
      where: { id: templateId },
    })

    return NextResponse.json({
      success: true,
      message: 'Template deleted successfully',
    })
  } catch (error) {
    return handleAPIError(error)
  }
})
