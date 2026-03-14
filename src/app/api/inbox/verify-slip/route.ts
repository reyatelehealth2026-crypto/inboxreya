import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip image via SlipMate Open API.
 * Proxies the request server-side so the API key stays hidden.
 *
 * Body (JSON):
 *   imageUrl  – public URL of the slip image (required)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { imageUrl } = body

    if (!imageUrl) {
      return NextResponse.json(
        { error: 'imageUrl is required' },
        { status: 400 }
      )
    }

    const apiKey = process.env.SLIPMATE_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'SlipMate API key not configured (SLIPMATE_API_KEY)' },
        { status: 500 }
      )
    }

    // Call SlipMate verify by Image URL
    const slipMateRes = await fetch('https://api.slipmate.ai/open-api/v1/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-KEY': apiKey,
      },
      body: JSON.stringify({
        qrImageUrl: imageUrl,
        allowDuplicate: false,
      }),
    })

    const slipMateData = await slipMateRes.json()

    if (!slipMateRes.ok) {
      // SlipMate returned an error
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: slipMateData?.message || slipMateData?.error || `SlipMate API error (${slipMateRes.status})`,
          statusCode: slipMateRes.status,
        },
        { status: 200 } // Return 200 so frontend can handle gracefully
      )
    }

    // Successful verification — SlipMate returns SlipData directly
    return NextResponse.json({
      success: true,
      verified: true,
      data: slipMateData,
    })
  } catch (error) {
    console.error('[verify-slip] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
