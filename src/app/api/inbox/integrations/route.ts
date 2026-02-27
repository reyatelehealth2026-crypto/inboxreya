import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import prisma from '@/lib/prisma'

export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const [facebookAccounts, tiktokAccounts] = await Promise.all([
      prisma.facebookAccount.findMany({
        select: {
          id: true,
          name: true,
          pageId: true,
          appId: true,
          appSecret: true,
          pageAccessToken: true,
          verifyToken: true,
          webhookUrl: true,
          pictureUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.tikTokShopAccount.findMany({
        select: {
          id: true,
          name: true,
          shopId: true,
          appKey: true,
          appSecret: true,
          accessToken: true,
          refreshToken: true,
          tokenExpiresAt: true,
          shopCipher: true,
          webhookUrl: true,
          pictureUrl: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
    ])

    return NextResponse.json({
      facebook: facebookAccounts.map((a) => ({
        ...a,
        id: a.id.toString(),
        appSecret: maskSecret(a.appSecret),
        pageAccessToken: maskSecret(a.pageAccessToken),
      })),
      tiktok: tiktokAccounts.map((a) => ({
        ...a,
        id: a.id.toString(),
        appSecret: maskSecret(a.appSecret),
        accessToken: maskSecret(a.accessToken),
        refreshToken: a.refreshToken ? maskSecret(a.refreshToken) : null,
      })),
    })
  } catch (error) {
    console.error('Error fetching integrations:', error)
    return NextResponse.json({ error: 'Failed to fetch integrations' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { platform, ...data } = body

    if (platform === 'facebook') {
      const required = ['name', 'pageId', 'appId', 'appSecret', 'pageAccessToken', 'verifyToken']
      for (const field of required) {
        if (!data[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }

      const account = await prisma.facebookAccount.create({
        data: {
          name: data.name,
          pageId: data.pageId,
          appId: data.appId,
          appSecret: data.appSecret,
          pageAccessToken: data.pageAccessToken,
          verifyToken: data.verifyToken,
          webhookUrl: data.webhookUrl || null,
          pictureUrl: data.pictureUrl || null,
          isActive: true,
        },
      })

      return NextResponse.json({ success: true, id: account.id.toString() })
    }

    if (platform === 'tiktok') {
      const required = ['name', 'shopId', 'appKey', 'appSecret', 'accessToken']
      for (const field of required) {
        if (!data[field]) {
          return NextResponse.json({ error: `Missing required field: ${field}` }, { status: 400 })
        }
      }

      const account = await prisma.tikTokShopAccount.create({
        data: {
          name: data.name,
          shopId: data.shopId,
          appKey: data.appKey,
          appSecret: data.appSecret,
          accessToken: data.accessToken,
          refreshToken: data.refreshToken || null,
          tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
          shopCipher: data.shopCipher || null,
          webhookUrl: data.webhookUrl || null,
          pictureUrl: data.pictureUrl || null,
          isActive: true,
        },
      })

      return NextResponse.json({ success: true, id: account.id.toString() })
    }

    return NextResponse.json({ error: 'Invalid platform' }, { status: 400 })
  } catch (error) {
    console.error('Error creating integration:', error)
    return NextResponse.json({ error: 'Failed to create integration' }, { status: 500 })
  }
}

function maskSecret(value: string): string {
  if (!value || value.length <= 8) return '••••••••'
  return value.substring(0, 4) + '••••••••' + value.substring(value.length - 4)
}
