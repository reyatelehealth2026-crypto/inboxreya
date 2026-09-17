import { Jimp } from 'jimp'
import { signValue, verifyValue } from './broadcast-link'
import { callPhpApiFormData } from './php-bridge'
import { IMAGEMAP_SIZES } from './imagemap-types'

/**
 * LINE clients fetch `<baseUrl>/{1040,700,460,300,240}` directly from our server
 * (one request per size per recipient who opens the chat), so every size must be
 * produced and uploaded ONCE here — never resized on the read path.
 */

const MAX_HEIGHT_AFTER_SCALE = 2500
const SIZES: readonly number[] = IMAGEMAP_SIZES

export interface ImagemapImageSet {
  baseKey: string
  width: 1040
  height: number
}

/**
 * Host `callPhpApiFormData` uploads to — same env precedence as php-bridge.ts —
 * used both to build the upload target and, in the serve route, to allow-list
 * which hosts a signed baseKey may point at (no open proxy/SSRF).
 */
export function getPhpUploadHost(): string | null {
  const baseUrl =
    process.env.PHP_API_URL ||
    process.env.NEXT_PUBLIC_PHP_API_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    ''
  if (!baseUrl) return null
  try {
    return new URL(baseUrl).host
  } catch {
    return null
  }
}

/** Public origin of this app — same resolution order as getPublicOrigin() in broadcast-runtime.ts. */
export function getPublicOrigin(): string {
  const origin =
    process.env.NEXT_PUBLIC_APP_URL ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    process.env.NEXTAUTH_URL ||
    'http://localhost:3000'
  return origin.replace(/\/+$/, '')
}

async function uploadOneSize(buffer: Buffer, isPng: boolean, size: number): Promise<string> {
  const mime = isPng ? 'image/png' : 'image/jpeg'
  const ext = isPng ? 'png' : 'jpg'

  const formData = new FormData()
  formData.append('file', new Blob([new Uint8Array(buffer)], { type: mime }), `imagemap-${size}.${ext}`)
  formData.append('type', 'image')

  const result = await callPhpApiFormData<{ mediaUrl?: string }>('/api/line/upload-only.php', formData)
  if (!result.success || !result.data?.mediaUrl) {
    throw new Error(result.error || `Imagemap upload failed for size ${size}`)
  }
  if (!result.data.mediaUrl.startsWith('https://')) {
    throw new Error(`Uploaded imagemap URL for size ${size} is not HTTPS`)
  }
  return result.data.mediaUrl
}

/**
 * Decode the source image, normalise to width 1040 (keeping aspect ratio),
 * produce the 5 LINE imagemap widths, upload each, and return a signed key
 * referencing the resulting URL set (order matches `IMAGEMAP_SIZES`).
 */
export async function createImagemapImageSet(input: Buffer): Promise<ImagemapImageSet> {
  const source = await Jimp.read(input)
  const isPng = source.mime === 'image/png'

  source.resize({ w: 1040 })
  const height = source.bitmap.height
  if (height > MAX_HEIGHT_AFTER_SCALE) {
    throw new Error(`Image too tall after scaling to width 1040 (${height}px > ${MAX_HEIGHT_AFTER_SCALE}px)`)
  }

  const urls: string[] = []
  for (const size of IMAGEMAP_SIZES) {
    // Always resize a clone (even for 1040, a cheap no-op) so `sized` has one
    // consistent type below instead of a source/clone union.
    const sized = source.clone().resize({ w: size })
    const buffer = isPng ? await sized.getBuffer('image/png') : await sized.getBuffer('image/jpeg')
    urls.push(await uploadOneSize(buffer, isPng, size))
  }

  const baseKey = signValue(JSON.stringify(urls))
  return { baseKey, width: 1040, height }
}

/** Resolve a signed baseKey back to its 5 upload URLs, in `IMAGEMAP_SIZES` order, or null if invalid/tampered. */
export function resolveImagemapUrls(baseKey: string): string[] | null {
  const json = verifyValue(baseKey)
  if (!json) return null
  try {
    const urls = JSON.parse(json)
    if (!Array.isArray(urls) || urls.length !== SIZES.length || !urls.every((u) => typeof u === 'string')) {
      return null
    }
    return urls as string[]
  } catch {
    return null
  }
}
