import { NextRequest, NextResponse } from 'next/server'
import { IMAGEMAP_SIZES } from '@/lib/imagemap-types'
import { getPhpUploadHost, resolveImagemapUrls } from '@/lib/imagemap-images'

/**
 * Public, extensionless image endpoint LINE clients fetch directly:
 * `/api/imagemap/<signed baseKey>/<size>`. The signed key limits which URLs
 * this route may ever proxy to — the destination never comes from the request.
 */

const SIZES: readonly number[] = IMAGEMAP_SIZES
const CACHE_MAX_ENTRIES = 50

interface CachedImage {
  buffer: Buffer
  contentType: string
}

// ponytail: in-process Map cache of image buffers; move to CDN/nginx cache if load grows
const imageCache = new Map<string, CachedImage>()

function cacheSet(key: string, value: CachedImage) {
  imageCache.set(key, value)
  if (imageCache.size > CACHE_MAX_ENTRIES) {
    const oldestKey = imageCache.keys().next().value
    if (oldestKey !== undefined) imageCache.delete(oldestKey)
  }
}

function notFound() {
  return new NextResponse(null, { status: 404 })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ key: string; size: string }> }
) {
  try {
    const { key, size: rawSize } = await params
    const size = Number(rawSize)
    if (!Number.isInteger(size) || !SIZES.includes(size)) return notFound()

    const cacheKey = `${key}:${size}`
    const cached = imageCache.get(cacheKey)
    if (cached) {
      return new NextResponse(new Uint8Array(cached.buffer), {
        status: 200,
        headers: {
          'Content-Type': cached.contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      })
    }

    const urls = resolveImagemapUrls(key)
    if (!urls) return notFound()

    const index = SIZES.indexOf(size)
    const upstreamUrl = urls[index]
    if (!upstreamUrl) return notFound()

    const allowedHost = getPhpUploadHost()
    let parsed: URL
    try {
      parsed = new URL(upstreamUrl)
    } catch {
      return notFound()
    }
    if (!allowedHost || parsed.protocol !== 'https:' || parsed.host !== allowedHost) {
      return notFound()
    }

    const upstreamRes = await fetch(upstreamUrl, { cache: 'no-store' })
    if (!upstreamRes.ok) return notFound()

    const contentType = upstreamRes.headers.get('content-type') || 'image/jpeg'
    const buffer = Buffer.from(await upstreamRes.arrayBuffer())

    cacheSet(cacheKey, { buffer, contentType })

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    })
  } catch (error) {
    // Public route: never leak error details, just log server-side and 404.
    console.error('[imagemap-serve] error:', error)
    return notFound()
  }
}
