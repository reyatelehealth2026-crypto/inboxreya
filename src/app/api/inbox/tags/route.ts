import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { callPhpApi } from '@/lib/php-bridge'

// Get all tags
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const tags = await prisma.userTag.findMany({
      where: session.user.lineAccountId
        ? { lineAccountId: session.user.lineAccountId }
        : {},
      orderBy: [{ priority: 'asc' }, { name: 'asc' }],
      include: {
        _count: {
          select: { assignments: true },
        },
      },
    })

    return NextResponse.json({
      data: tags.map((tag) => ({
        id: tag.id.toString(),
        name: tag.name,
        color: tag.color ?? '#3B82F6',
        description: tag.description,
        isAuto: tag.tagType !== 'manual',
        sortOrder: tag.priority ?? 0,
        usageCount: tag._count.assignments,
      })),
    })
  } catch (error) {
    console.error('Error fetching tags:', error)
    return NextResponse.json({ error: 'Failed to fetch tags' }, { status: 500 })
  }
}

// Create a new tag
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { name, color = '#3B82F6', description } = body

    if (!name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 })
    }

    const tag = await prisma.userTag.create({
      data: {
        name,
        color,
        description,
        tagType: 'manual',
        priority: 0,
        lineAccountId: session.user.lineAccountId,
      },
    })

    return NextResponse.json({
      id: tag.id.toString(),
      name: tag.name,
      color: tag.color ?? '#3B82F6',
      description: tag.description,
      isAuto: tag.tagType !== 'manual',
      sortOrder: tag.priority ?? 0,
    })
  } catch (error) {
    console.error('Error creating tag:', error)
    return NextResponse.json({ error: 'Failed to create tag' }, { status: 500 })
  }
}

// Assign/remove tag from user
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { userId, tagId, action } = body

    if (!userId || !tagId || !action) {
      return NextResponse.json(
        { error: 'userId, tagId, and action are required' },
        { status: 400 }
      )
    }

    const parsedUserId = Number(userId)
    const parsedTagId = Number(tagId)
    if (!Number.isFinite(parsedUserId) || !Number.isFinite(parsedTagId)) {
      return NextResponse.json(
        { error: 'userId and tagId must be numbers' },
        { status: 400 }
      )
    }

    const shouldCallPhp = Boolean(process.env.PHP_API_URL)

    if (action === 'assign') {
      if (shouldCallPhp) {
        const result = await callPhpApi('/api/inbox-v2.php?action=assign_tag', {
          method: 'POST',
          body: JSON.stringify({
            user_id: parsedUserId,
            tag_id: parsedTagId,
            admin_id: session.user.id,
          }),
        })
        if (result.success) {
          return NextResponse.json({ success: true })
        }
        console.warn('PHP tag assign failed, falling back to Prisma:', result.error)
      }

      await prisma.userTagAssignment.upsert({
        where: {
          userId_tagId: {
            userId: parsedUserId,
            tagId: parsedTagId,
          },
        },
        create: {
          userId: parsedUserId,
          tagId: parsedTagId,
          assignedBy: String(session.user.id),
        },
        update: {},
      })
    } else if (action === 'remove') {
      if (shouldCallPhp) {
        const result = await callPhpApi('/api/inbox-v2.php?action=remove_customer_tag', {
          method: 'POST',
          body: JSON.stringify({
            user_id: parsedUserId,
            tag_id: parsedTagId,
            admin_id: session.user.id,
          }),
        })
        if (result.success) {
          return NextResponse.json({ success: true })
        }
        console.warn('PHP tag remove failed, falling back to Prisma:', result.error)
      }

      await prisma.userTagAssignment.deleteMany({
        where: {
          userId: parsedUserId,
          tagId: parsedTagId,
        },
      })
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error updating tag assignment:', error)
    return NextResponse.json(
      { error: 'Failed to update tag assignment' },
      { status: 500 }
    )
  }
}

// Delete a tag
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const tagId = searchParams.get('tagId')

    if (!tagId) {
      return NextResponse.json({ error: 'tagId is required' }, { status: 400 })
    }

    const parsedTagId = Number(tagId)
    if (!Number.isFinite(parsedTagId)) {
      return NextResponse.json({ error: 'tagId must be a number' }, { status: 400 })
    }

    await prisma.userTag.delete({
      where: { id: parsedTagId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting tag:', error)
    return NextResponse.json({ error: 'Failed to delete tag' }, { status: 500 })
  }
}
