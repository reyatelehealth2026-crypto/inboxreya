import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { requireAuth } from '@/lib/auth-middleware'

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
    return null
  }

  return null
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

    const quickReplyTemplates = quickReplies.map((template) => ({
      id: template.id,
      sourceId: template.id,
      sourceTable: 'quick_reply_templates' as const,
      name: template.name,
      description: template.category ? `Quick reply • ${template.category}` : 'Quick reply template',
      content: template.content,
      category: 'text' as const,
      isActive: true,
      createdAt: (template.created_at || new Date()).toISOString(),
    }))

    const normalizedFlexTemplates = flexTemplates.map((template) => ({
      id: 1_000_000 + template.id,
      sourceId: template.id,
      sourceTable: 'flex_templates' as const,
      name: template.name,
      description: template.description || template.category || 'Flex template',
      flexContent: normalizeFlexPayload(template.flex_json, template.name),
      category: 'flex' as const,
      isActive: true,
      createdAt: template.created_at.toISOString(),
    }))

    const normalizedGenericTemplates = genericTemplates.map((template) => {
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
    })

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
