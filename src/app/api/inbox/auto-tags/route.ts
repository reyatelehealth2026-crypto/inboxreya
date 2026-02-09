import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

// Get all auto-tag rules
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const rules = await prisma.autoTagRule.findMany({
      where: session.user.lineAccountId
        ? {
            OR: [
              { lineAccountId: session.user.lineAccountId },
              { lineAccountId: null },
            ],
          }
        : {},
      include: {
        tag: true,
      },
      orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
    })

    return NextResponse.json({
      data: rules.map((rule) => ({
        id: rule.id.toString(),
        tagId: rule.tagId.toString(),
        ruleName: rule.ruleName,
        triggerType: rule.triggerType,
        conditions: JSON.parse(rule.conditions),
        isActive: rule.isActive,
        priority: rule.priority,
        tag: {
          id: rule.tag.id.toString(),
          name: rule.tag.name,
          color: rule.tag.color ?? '#3B82F6',
        },
        createdAt: rule.createdAt.toISOString(),
        updatedAt: rule.updatedAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error fetching auto-tag rules:', error)
    return NextResponse.json(
      { error: 'Failed to fetch auto-tag rules' },
      { status: 500 }
    )
  }
}

// Create a new auto-tag rule
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check admin permissions
    if (!['super_admin', 'admin'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { tagId, triggerType, conditions, priority = 0, ruleName } = body

    if (!tagId || !triggerType) {
      return NextResponse.json(
        { error: 'tagId and triggerType are required' },
        { status: 400 }
      )
    }

    const parsedTagId = Number(tagId)
    if (!Number.isFinite(parsedTagId)) {
      return NextResponse.json({ error: 'tagId must be a number' }, { status: 400 })
    }

    const tag = await prisma.userTag.findFirst({
      where: {
        id: parsedTagId,
        ...(session.user.lineAccountId ? { lineAccountId: session.user.lineAccountId } : {}),
      },
    })

    if (!tag) {
      return NextResponse.json({ error: 'Tag not found' }, { status: 404 })
    }

    const rule = await prisma.autoTagRule.create({
      data: {
        tagId: parsedTagId,
        lineAccountId: session.user.lineAccountId,
        ruleName: ruleName || tag.name,
        triggerType,
        conditions: JSON.stringify(conditions || []),
        priority,
        isActive: true,
      },
      include: {
        tag: true,
      },
    })

    return NextResponse.json({
      id: rule.id.toString(),
      tagId: rule.tagId.toString(),
      ruleName: rule.ruleName,
      triggerType: rule.triggerType,
      conditions: JSON.parse(rule.conditions),
      isActive: rule.isActive,
      priority: rule.priority,
      tag: {
        id: rule.tag.id.toString(),
        name: rule.tag.name,
        color: rule.tag.color ?? '#3B82F6',
      },
    })
  } catch (error) {
    console.error('Error creating auto-tag rule:', error)
    return NextResponse.json(
      { error: 'Failed to create auto-tag rule' },
      { status: 500 }
    )
  }
}

// Update an auto-tag rule
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['super_admin', 'admin'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { id, conditions, isActive, priority, ruleName } = body

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'id must be a number' }, { status: 400 })
    }

    const rule = await prisma.autoTagRule.update({
      where: { id: parsedId },
      data: {
        ...(ruleName !== undefined && { ruleName }),
        ...(conditions !== undefined && { conditions: JSON.stringify(conditions) }),
        ...(isActive !== undefined && { isActive }),
        ...(priority !== undefined && { priority }),
      },
      include: {
        tag: true,
      },
    })

    return NextResponse.json({
      id: rule.id.toString(),
      tagId: rule.tagId.toString(),
      ruleName: rule.ruleName,
      triggerType: rule.triggerType,
      conditions: JSON.parse(rule.conditions),
      isActive: rule.isActive,
      priority: rule.priority,
      tag: {
        id: rule.tag.id.toString(),
        name: rule.tag.name,
        color: rule.tag.color ?? '#3B82F6',
      },
    })
  } catch (error) {
    console.error('Error updating auto-tag rule:', error)
    return NextResponse.json(
      { error: 'Failed to update auto-tag rule' },
      { status: 500 }
    )
  }
}

// Delete an auto-tag rule
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!['super_admin', 'admin'].includes(session.user.role as string)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json({ error: 'id is required' }, { status: 400 })
    }

    const parsedId = Number(id)
    if (!Number.isFinite(parsedId)) {
      return NextResponse.json({ error: 'id must be a number' }, { status: 400 })
    }

    await prisma.autoTagRule.delete({
      where: { id: parsedId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting auto-tag rule:', error)
    return NextResponse.json(
      { error: 'Failed to delete auto-tag rule' },
      { status: 500 }
    )
  }
}
