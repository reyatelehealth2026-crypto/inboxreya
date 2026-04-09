import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'
import type { BroadcastTemplate, FlexMessage } from '@/types/broadcast'

const createBroadcastTemplateSchema = z.object({
  name: z.string().min(1, 'Template name is required').max(100),
  templateType: z.enum(['text', 'image', 'flex', 'video']),
  categoryLabel: z.string().max(100).optional(),
  content: z.string().optional(),
  mediaUrl: z.string().url('Media URL must be a valid URL').optional(),
  flexContent: z.any().optional(),
})

function normalizeCategory(messageType?: string | null): 'text' | 'flex' | 'image' | 'video' {
  if (messageType === 'flex') return 'flex'
  if (messageType === 'image') return 'image'
  if (messageType === 'video') return 'video'
  return 'text'
}

function normalizeFlexPayload(raw: string | null | undefined, altText: string): FlexMessage | undefined {
  if (!raw) return undefined

  try {
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return undefined

    if (parsed.type === 'flex' && parsed.contents) {
      return parsed
    }

    if (parsed.type === 'bubble' || parsed.type === 'carousel') {
      return {
        type: 'flex',
        altText,
        contents: parsed,
      }
    }

    if (parsed.contents && (parsed.contents.type === 'bubble' || parsed.contents.type === 'carousel')) {
      return {
        type: 'flex',
        altText,
        contents: parsed.contents,
      }
    }
  } catch {
    return undefined
  }

  return undefined
}

function serializeFlexPayload(input: unknown, altText: string) {
  if (!input) return null

  const raw = typeof input === 'string' ? input : JSON.stringify(input)
  const normalized = normalizeFlexPayload(raw, altText)
  if (!normalized) return null
  return JSON.stringify(normalized)
}

function normalizeQuickReplyTemplate(template: {
  id: number
  name: string
  category: string | null
  content: string
  created_at: Date | null
}): BroadcastTemplate {
  return {
    id: template.id,
    sourceId: template.id,
    sourceTable: 'quick_reply_templates' as const,
    name: template.name,
    description: template.category ? `Quick reply • ${template.category}` : 'Quick reply template',
    content: template.content,
    category: 'text' as const,
    isActive: true,
    createdAt: (template.created_at || new Date()).toISOString(),
  }
}

function normalizeFlexTemplateRecord(template: {
  id: number
  name: string
  description: string | null
  category: string | null
  flex_json: string
  created_at: Date
}): BroadcastTemplate {
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
}): BroadcastTemplate {
  const category = normalizeCategory(template.message_type)
  const content = category === 'text' ? template.content : undefined
  const mediaUrl = category === 'image' || category === 'video' ? template.content : undefined
  const flexContent = category === 'flex' ? normalizeFlexPayload(template.content, template.name) : undefined

  return {
    id: 2_000_000 + template.id,
    sourceId: template.id,
    sourceTable: 'templates' as const,
    name: template.name,
    description: template.category || `${category} template`,
    content,
    mediaUrl,
    flexContent,
    category,
    isActive: true,
    createdAt: template.created_at.toISOString(),
  }
}

// GET /api/inbox/broadcasts/templates - normalized template list for broadcast selector
export async function GET(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult

    const { user } = authResult
    if (!user.lineAccountId) {
      return NextResponse.json(
        { success: false, error: 'User does not have a LINE account assigned' },
        { status: 400 }
      )
    }

    const { searchParams } = new URL(req.url)
    const search = (searchParams.get('search') || '').trim().toLowerCase()

    const [quickReplies, flexTemplates, genericTemplates] = await Promise.all([
      prisma.quick_reply_templates.findMany({
        where: { line_account_id: user.lineAccountId },
        orderBy: [{ usage_count: 'desc' }, { created_at: 'desc' }],
        take: 50,
      }),
      prisma.flex_templates.findMany({
        where: { line_account_id: user.lineAccountId },
        orderBy: [{ use_count: 'desc' }, { created_at: 'desc' }],
        take: 50,
      }),
      prisma.templates.findMany({
        where: { line_account_id: user.lineAccountId },
        orderBy: { created_at: 'desc' },
        take: 50,
      }),
    ])

    const quickReplyTemplates = quickReplies.map(normalizeQuickReplyTemplate)

    const normalizedFlexTemplates = flexTemplates.map(normalizeFlexTemplateRecord)

    const normalizedGenericTemplates = genericTemplates.map(normalizeGenericTemplateRecord)

    const merged = [...normalizedFlexTemplates, ...normalizedGenericTemplates, ...quickReplyTemplates]
      .filter((template) => {
        if (!search) return true
        const haystack = [template.name, template.description, template.content]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return haystack.includes(search)
      })
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json({
      success: true,
      data: merged,
      meta: {
        quickReplyCount: quickReplyTemplates.length,
        flexTemplateCount: normalizedFlexTemplates.length,
        genericTemplateCount: normalizedGenericTemplates.length,
      },
    })
  } catch (error: any) {
    console.error('[Broadcast Templates] Error:', error)
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to fetch broadcast templates' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}

// POST /api/inbox/broadcasts/templates - create a broadcast-oriented template
export async function POST(req: NextRequest) {
  try {
    const authResult = await requireAuth(req)
    if (authResult instanceof NextResponse) return authResult

    const { user } = authResult
    if (!user.lineAccountId) {
      return NextResponse.json(
        { success: false, error: 'User does not have a LINE account assigned' },
        { status: 400 }
      )
    }

    const body = await req.json()
    const validated = createBroadcastTemplateSchema.parse(body)
    const categoryLabel = validated.categoryLabel?.trim() || null

    if (validated.templateType === 'text' && !validated.content?.trim()) {
      return NextResponse.json({ success: false, error: 'Text template requires content' }, { status: 400 })
    }

    if ((validated.templateType === 'image' || validated.templateType === 'video') && !validated.mediaUrl) {
      return NextResponse.json({ success: false, error: 'Media template requires mediaUrl' }, { status: 400 })
    }

    if (validated.templateType === 'flex') {
      const serializedFlex = serializeFlexPayload(validated.flexContent, validated.name)
      if (!serializedFlex) {
        return NextResponse.json({ success: false, error: 'Flex template requires valid flexContent JSON' }, { status: 400 })
      }

      const created = await prisma.flex_templates.create({
        data: {
          line_account_id: user.lineAccountId,
          name: validated.name.trim(),
          category: categoryLabel,
          description: categoryLabel,
          flex_json: serializedFlex,
          created_by: Number(user.id) || null,
          use_count: 0,
          is_public: false,
        },
      })

      return NextResponse.json({
        success: true,
        data: normalizeFlexTemplateRecord(created),
      })
    }

    const content = validated.templateType === 'text'
      ? validated.content!.trim()
      : validated.mediaUrl!

    const created = await prisma.templates.create({
      data: {
        line_account_id: user.lineAccountId,
        name: validated.name.trim(),
        category: categoryLabel,
        message_type: validated.templateType,
        content,
      },
    })

    return NextResponse.json({
      success: true,
      data: normalizeGenericTemplateRecord(created),
    })
  } catch (error: any) {
    console.error('[Broadcast Templates POST] Error:', error)

    if (error?.name === 'ZodError') {
      return NextResponse.json(
        {
          success: false,
          error: error.issues?.[0]?.message || 'Invalid payload',
          details: error.issues,
        },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { success: false, error: error.message || 'Failed to create broadcast template' },
      { status: error.message === 'Unauthorized' ? 401 : 500 }
    )
  }
}
