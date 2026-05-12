import { NextRequest, NextResponse } from 'next/server'
import type { Prisma } from '@prisma/client'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'
import { __resetFeatureFlagCache } from '@/lib/feature-flags'

async function guard() {
  const session = await auth()
  if (!session?.user) {
    return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }
  }
  const role = session.user.role
  if (role !== 'admin' && role !== 'super_admin') {
    return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  }
  return { error: null as null }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ key: string }> }
) {
  const { error } = await guard()
  if (error) return error

  try {
    const { key } = await params
    if (!key || typeof key !== 'string') {
      return NextResponse.json({ error: 'Invalid key' }, { status: 400 })
    }

    const body = (await request.json()) as {
      enabled?: unknown
      enabledForRoles?: unknown
      enabledForUserIds?: unknown
      metadata?: unknown
    }

    const updateData: Prisma.FeatureFlagUpdateInput = {}
    const createData: Prisma.FeatureFlagCreateInput = { key, enabled: false }

    if (typeof body.enabled === 'boolean') {
      updateData.enabled = body.enabled
      createData.enabled = body.enabled
    }
    if (typeof body.enabledForRoles === 'string' || body.enabledForRoles === null) {
      updateData.enabledForRoles = body.enabledForRoles as string | null
      createData.enabledForRoles = body.enabledForRoles as string | null
    }
    if (typeof body.enabledForUserIds === 'string' || body.enabledForUserIds === null) {
      updateData.enabledForUserIds = body.enabledForUserIds as string | null
      createData.enabledForUserIds = body.enabledForUserIds as string | null
    }
    if (body.metadata !== undefined) {
      updateData.metadata = body.metadata as Prisma.InputJsonValue
      createData.metadata = body.metadata as Prisma.InputJsonValue
    }

    const row = await prisma.featureFlag.upsert({
      where: { key },
      update: updateData,
      create: createData,
    })

    __resetFeatureFlagCache()
    logger.info('feature flag updated', { scope: 'admin/feature-flags:PATCH', key })
    return NextResponse.json({ data: row })
  } catch (err) {
    logger.error(err, { scope: 'admin/feature-flags:PATCH' })
    return NextResponse.json({ error: 'Failed to update feature flag' }, { status: 500 })
  }
}
