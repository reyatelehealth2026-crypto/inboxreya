import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

const paramsSchema = z.object({
  sourceTable: z.enum(['templates', 'flex_templates']),
  sourceId: z.coerce.number().int().positive(),
})

const updateBroadcastTemplateSchema = z.object({
  name: z.string().min(1).max(100),
  templateType: z.enum(['text', 'image', 'flex', 'video']),
  categoryLabel: z.string().max(100).optional(),
  content: z.string().optional(),
  mediaUrl: z.string().url().optional(),
  flexContent: z.any().optional(),
})

function normalizeCategory(messageType?: string | null): 'text' | 'flex' | 'image' | 'video' {
  if (messageType === 'flex') return 'flex'
  if (messageType === 'image') return 'image'
  if (messageType === 'video') return 'video'
  return 'text'
}

function normalizeFlexPayload(raw: string | null | undefined, altText: string) {
  if (!raw) return null

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null

    if (parsed.type === 'flex' && parsed.contents) return parsed

    if (parsed.type === 'bubble' || parsed.type === 'carousel') {
      return { type: 'flex', altText, contents: parsed }
    }

    if (parsed.contents && (parsed.contents.type === 'bubble' || parsed.contents.type === 'carousel')) {
      return { type: 'flex', altText, contents: parsed.contents }
    }
  } catch {
    return null
  }

  return null
}

function serializeFlexPayload(input: unknown, altText: string) {
  if (!input) return null
  const raw = typeof input === 'string' ? input : JSON.stringify(input)
  const normalized = normalizeFlexPayload(raw, altText)
  if (!normalized) return null
  return JSON.stringify(normalized)
}

function normalizeFlexTemplateRecord(template: {
  id: number
  name: string
  description: string | null
  category: string | null
  flex_json: string
  created_at: Date
}) {
  return {
    id: 1_000_000 + template.id,
    sourceId: template.id,
    sourceTable: 'flex_templates' as const,
    name: template.name,
    description: template.description || template.category || 'Flex template',
    flexContent: normalizeFlexPayload(template.flex_json, template.name),
    category: 'flex' as const,
    isActive: true,
    createdAt: template.created_at.toISOString(),
  }
}

function normalizeGenericTemplateRecord(template: {
  id: number
  name: string
  category: string | null
  message_type: string | null
  content: string
  created_at: Date
}) {
  const category = normalizeCategory(template.message_type)
  return {
    id: 2_000_000 + template.id,
    sourceId: template.id,
    sourceTable: 'templates' as const,
    name: template.name,
    description: template.category || `${category} template`,
    content: category === 'text' ? template.content : undefined,
    mediaUrl: category === 'image' || category === 'video' ? template.content : undefined,
    flexContent: category === 'flex' ? normalizeFlexPayload(template.content, template.name) : undefined,
    category,
    isActive: true,
    createdAt: template.created_at.toISOString(),
  }
}

async function getOwnedTemplate(lineAccountId: number, sourceTable: 'templates' | 'flex_templates', sourceId: number) {
  if (sourceTable === 'templates') {
    return prisma.templates.findFirst({
      where: { id: sourceId, line_account_id: lineAccountId },
    })
  }

  return prisma.flex_templates.findFirst({
    where: { id: sourceId, line_account_id: lineAccountId },
  })
}

function requireLineAccountId(lineAccountId: number | null | undefined) {
  if (lineAccountId == null) {
    return NextResponse.json({ success: false, error: 'User does not have a LINE account assigned' }, { status: 400 })
  }

  return lineAccountId
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ sourceTable: string; sourceId: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const lineAccountId = requireLineAccountId(user.lineAccountId)
    if (lineAccountId instanceof NextResponse) return lineAccountId

    const parsedParams = paramsSchema.parse(await params)
    const record = await getOwnedTemplate(lineAccountId, parsedParams.sourceTable, parsedParams.sourceId)

    if (!record) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    return NextResponse.json({
      success: true,
      data: parsedParams.sourceTable === 'templates'
        ? normalizeGenericTemplateRecord(record as any)
        : normalizeFlexTemplateRecord(record as any),
    })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch template' },
      { status: error?.name === 'ZodError' ? 400 : 500 }
    )
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ sourceTable: string; sourceId: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const lineAccountId = requireLineAccountId(user.lineAccountId)
    if (lineAccountId instanceof NextResponse) return lineAccountId

    const parsedParams = paramsSchema.parse(await params)
    const validated = updateBroadcastTemplateSchema.parse(await req.json())
    const categoryLabel = validated.categoryLabel?.trim() || null

    if (parsedParams.sourceTable === 'templates') {
      if (validated.templateType === 'flex') {
        return NextResponse.json({ success: false, error: 'Generic templates do not support flex in this route' }, { status: 400 })
      }

      const content = validated.templateType === 'text'
        ? validated.content?.trim()
        : validated.mediaUrl?.trim()

      if (!content) {
        return NextResponse.json({ success: false, error: 'Template content is required' }, { status: 400 })
      }

      const existing = await prisma.templates.findFirst({
        where: { id: parsedParams.sourceId, line_account_id: lineAccountId },
      })

      if (!existing) {
        return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
      }

      const updated = await prisma.templates.update({
        where: { id: parsedParams.sourceId },
        data: {
          name: validated.name.trim(),
          category: categoryLabel,
          message_type: validated.templateType,
          content,
        },
      })

      return NextResponse.json({ success: true, data: normalizeGenericTemplateRecord(updated) })
    }

    if (validated.templateType !== 'flex') {
      return NextResponse.json({ success: false, error: 'Flex template route only accepts flex type' }, { status: 400 })
    }

    const existing = await prisma.flex_templates.findFirst({
      where: { id: parsedParams.sourceId, line_account_id: lineAccountId },
    })

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    const serializedFlex = serializeFlexPayload(validated.flexContent, validated.name)
    if (!serializedFlex) {
      return NextResponse.json({ success: false, error: 'Flex template requires valid flexContent JSON' }, { status: 400 })
    }

    const updated = await prisma.flex_templates.update({
      where: { id: parsedParams.sourceId },
      data: {
        name: validated.name.trim(),
        category: categoryLabel,
        description: categoryLabel,
        flex_json: serializedFlex,
      },
    })

    return NextResponse.json({ success: true, data: normalizeFlexTemplateRecord(updated) })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to update template', details: error?.issues },
      { status: error?.name === 'ZodError' ? 400 : 500 }
    )
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ sourceTable: string; sourceId: string }> }
) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult
    const { user } = authResult
    const lineAccountId = requireLineAccountId(user.lineAccountId)
    if (lineAccountId instanceof NextResponse) return lineAccountId

    const parsedParams = paramsSchema.parse(await params)
    const existing = await getOwnedTemplate(lineAccountId, parsedParams.sourceTable, parsedParams.sourceId)

    if (!existing) {
      return NextResponse.json({ success: false, error: 'Template not found' }, { status: 404 })
    }

    if (parsedParams.sourceTable === 'templates') {
      await prisma.templates.delete({ where: { id: parsedParams.sourceId } })
    } else {
      await prisma.flex_templates.delete({ where: { id: parsedParams.sourceId } })
    }

    return NextResponse.json({ success: true })
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to delete template' },
      { status: error?.name === 'ZodError' ? 400 : 500 }
    )
  }
}
