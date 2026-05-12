import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'
import { logger } from '@/lib/logger'

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

export async function GET() {
  const { error } = await guard()
  if (error) return error

  try {
    const rows = await prisma.featureFlag.findMany({ orderBy: { key: 'asc' } })
    return NextResponse.json({ data: rows })
  } catch (err) {
    logger.error(err, { scope: 'admin/feature-flags:GET' })
    return NextResponse.json({ error: 'Failed to load feature flags' }, { status: 500 })
  }
}
