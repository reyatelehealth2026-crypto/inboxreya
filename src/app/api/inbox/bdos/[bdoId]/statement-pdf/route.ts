import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

const DEFAULT_STATEMENT_BASE_URL = 'https://stg-erp.cnyrxapp.com'

function getStatementApiKey() {
  return (
    process.env.STG_ERP_STATEMENT_PDF_API_KEY ||
    process.env.STG_ERP_API_KEY ||
    process.env.ERP_API_KEY ||
    ''
  ).trim()
}

function buildFallbackUrl(bdoId: number) {
  const phpBase = process.env.PHP_API_URL || process.env.NEXT_PUBLIC_PHP_API_URL || 'https://cny.re-ya.com'
  return `${phpBase.replace(/\/$/, '')}/api/odoo-dashboard-api.php?action=statement_pdf&bdo_id=${bdoId}`
}

function buildPrimaryUrl(bdoId: number, apiKey: string) {
  const baseUrl = (process.env.STG_ERP_STATEMENT_PDF_BASE_URL || DEFAULT_STATEMENT_BASE_URL).replace(/\/$/, '')
  return `${baseUrl}/reya/bdo/statement-pdf/${bdoId}?api_key=${encodeURIComponent(apiKey)}`
}

async function fetchStatementPdf(url: string) {
  return fetch(url, {
    method: 'GET',
    headers: {
      Accept: 'application/pdf,application/octet-stream;q=0.9,*/*;q=0.8',
      'User-Agent': 'InboxReya-BDOStatement/1.0',
    },
    cache: 'no-store',
  })
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ bdoId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
    }

    const { bdoId: rawBdoId } = await params
    const bdoId = Number(rawBdoId)
    if (!Number.isFinite(bdoId) || bdoId <= 0) {
      return NextResponse.json({ success: false, error: 'Invalid BDO ID' }, { status: 400 })
    }

    const apiKey = getStatementApiKey()
    const upstreamUrl = apiKey ? buildPrimaryUrl(bdoId, apiKey) : buildFallbackUrl(bdoId)
    const upstreamRes = await fetchStatementPdf(upstreamUrl)

    if (!upstreamRes.ok) {
      const preview = await upstreamRes.text().catch(() => '')
      return NextResponse.json(
        {
          success: false,
          error: `Failed to load statement PDF (${upstreamRes.status})`,
          preview: preview.slice(0, 200) || undefined,
        },
        { status: 502 }
      )
    }

    const contentType = upstreamRes.headers.get('content-type') || 'application/pdf'
    const upstreamDisposition = upstreamRes.headers.get('content-disposition')
    const fileName = `BDO-${bdoId}-statement.pdf`

    return new NextResponse(upstreamRes.body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': upstreamDisposition || `inline; filename="${fileName}"`,
        'Cache-Control': 'private, no-store, max-age=0',
      },
    })
  } catch (error) {
    console.error('[bdo-statement-pdf] Error:', error)
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
