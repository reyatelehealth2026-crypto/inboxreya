import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, ...data } = body
    const { id: idStr } = await params
    const id = parseInt(idStr)

    if (platform === 'facebook') {
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.pageId !== undefined) updateData.pageId = data.pageId
      if (data.appId !== undefined) updateData.appId = data.appId
      if (data.appSecret !== undefined && !data.appSecret.includes('••')) updateData.appSecret = data.appSecret
      if (data.pageAccessToken !== undefined && !data.pageAccessToken.includes('••')) updateData.pageAccessToken = data.pageAccessToken
      if (data.verifyToken !== undefined) updateData.verifyToken = data.verifyToken
      if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl
      if (data.pictureUrl !== undefined) updateData.pictureUrl = data.pictureUrl
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      await prisma.facebookAccount.update({ where: { id }, data: updateData })
      return NextResponse.json({ success: true })
    }

    if (platform === 'tiktok') {
      const updateData: Record<string, unknown> = {}
      if (data.name !== undefined) updateData.name = data.name
      if (data.shopId !== undefined) updateData.shopId = data.shopId
      if (data.appKey !== undefined) updateData.appKey = data.appKey
      if (data.appSecret !== undefined && !data.appSecret.includes('••')) updateData.appSecret = data.appSecret
      if (data.accessToken !== undefined && !data.accessToken.includes('••')) updateData.accessToken = data.accessToken
      if (data.refreshToken !== undefined && !data.refreshToken?.includes('••')) updateData.refreshToken = data.refreshToken
      if (data.tokenExpiresAt !== undefined) updateData.tokenExpiresAt = data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null
      if (data.shopCipher !== undefined) updateData.shopCipher = data.shopCipher
      if (data.webhookUrl !== undefined) updateData.webhookUrl = data.webhookUrl
      if (data.pictureUrl !== undefined) updateData.pictureUrl = data.pictureUrl
      if (data.isActive !== undefined) updateData.isActive = data.isActive

      await prisma.tikTokShopAccount.update({ where: { id }, data: updateData })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  } catch (error) {
    console.error('Error updating integration:', error)
    return NextResponse.json({ error: 'Failed to update integration' }, { status: 500 })
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const platform = searchParams.get('platform')
    const { id: idStr } = await params
    const id = parseInt(idStr)

    if (platform === 'facebook') {
      await prisma.facebookAccount.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    if (platform === 'tiktok') {
      await prisma.tikTokShopAccount.delete({ where: { id } })
      return NextResponse.json({ success: true })
    }

    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  } catch (error) {
    console.error('Error deleting integration:', error)
    return NextResponse.json({ error: 'Failed to delete integration' }, { status: 500 })
  }
}
