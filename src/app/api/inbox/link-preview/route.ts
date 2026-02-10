
import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const url = searchParams.get('url')

    if (!url) {
        return NextResponse.json({ error: 'Missing URL' }, { status: 400 })
    }

    try {
        // Validate URL
        const parsedUrl = new URL(url)
        if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
            return NextResponse.json({ error: 'Invalid protocol' }, { status: 400 })
        }

        // SSRF prevention: reject localhost/private IPs (basic check)
        if (
            parsedUrl.hostname === 'localhost' ||
            parsedUrl.hostname === '127.0.0.1' ||
            parsedUrl.hostname.startsWith('192.168.') ||
            parsedUrl.hostname.startsWith('10.')
        ) {
            return NextResponse.json({ error: 'Invalid hostname' }, { status: 400 })
        }

        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 5000) // 5s timeout

        const response = await fetch(url, {
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; InboxLinkPreview/1.0)',
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            }
        })

        clearTimeout(timeoutId)

        if (!response.ok) {
            return NextResponse.json({ error: 'Failed to fetch' }, { status: response.status })
        }

        const contentType = response.headers.get('content-type')
        if (!contentType || !contentType.includes('text/html')) {
            return NextResponse.json({ error: 'Not HTML content' }, { status: 400 })
        }

        const html = await response.text()

        // Simple regex parser for basic OG tags
        const getMetaContent = (prop: string) => {
            const regex = new RegExp(`<meta\\s+(?:property|name)=["']${prop}["']\\s+content=["'](.*?)["']`, 'i')
            const match = html.match(regex)
            // Handle escaped quotes if necessary, simpler here
            return match ? match[1] : null
        }

        let title = getMetaContent('og:title')
        if (!title) {
            const titleMatch = html.match(/<title>(.*?)<\/title>/i)
            title = titleMatch ? titleMatch[1] : ''
        }

        let description = getMetaContent('og:description') || getMetaContent('description') || ''

        let image = getMetaContent('og:image')
        if (image && !image.startsWith('http')) {
            try {
                image = new URL(image, url).toString()
            } catch { }
        }

        // Try to find favicon
        let favicon = ''
        const iconMatch = html.match(/<link\\s+rel=["'](?:shortcut )?icon["']\\s+href=["'](.*?)["']/)
        if (iconMatch) {
            let icon = iconMatch[1]
            if (icon && !icon.startsWith('http')) {
                try {
                    favicon = new URL(icon, url).toString()
                } catch { }
            } else {
                favicon = icon
            }
        } else {
            try {
                favicon = new URL('/favicon.ico', url).toString()
            } catch { }
        }

        const data = {
            title: title || '',
            description: description || '',
            image: image || '',
            favicon: favicon || '',
            url: url,
            hostname: parsedUrl.hostname
        }

        return NextResponse.json(data, {
            headers: {
                'Cache-Control': 'public, max-age=86400',
            }
        })

    } catch (error) {
        console.error('Link preview error:', error)
        return NextResponse.json({ error: 'Failed to process URL' }, { status: 500 })
    }
}
