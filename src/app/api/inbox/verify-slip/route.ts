import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip image via ApiSlip API.
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

    const apiKey = process.env.APISLIP_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ApiSlip API key not configured (APISLIP_API_KEY)' },
        { status: 500 }
      )
    }

    // Download image from imageUrl
    const imageRes = await fetch(imageUrl)
    if (!imageRes.ok) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: `Failed to download image (${imageRes.status})`,
        },
        { status: 200 }
      )
    }

    const imageBuffer = await imageRes.arrayBuffer()
    const contentType = imageRes.headers.get('content-type') || 'image/jpeg'
    const filename = imageUrl.split('/').pop() || 'slip.jpg'

    // Build multipart/form-data
    const formData = new FormData()
    const blob = new Blob([imageBuffer], { type: contentType })
    formData.append('slip', blob, filename)

    // Call ApiSlip verify endpoint
    const apiSlipRes = await fetch('https://apislip-public.n0tify.pro/api/v1/verify/slip', {
      method: 'POST',
      headers: {
        'X-Api-Key': apiKey,
      },
      body: formData,
    })

    const apiSlipData = await apiSlipRes.json()

    if (!apiSlipRes.ok) {
      // ApiSlip returned an error
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: apiSlipData?.message || apiSlipData?.error || `ApiSlip API error (${apiSlipRes.status})`,
          statusCode: apiSlipRes.status,
        },
        { status: 200 } // Return 200 so frontend can handle gracefully
      )
    }

    // Parse ApiSlip response format to match frontend expectations
    // ApiSlip: { success, data: { status, isAuthentic, transaction: { amount, refId, sender, receiver, date } } }
    // Frontend expects: { success, verified, data: { amount, transRef, sender, receiver, ... } }
    
    const { data } = apiSlipData
    const tx = data.transaction || {}
    
    if (data.status === 'success' && data.isAuthentic === true) {
      // Build response compatible with both old SlipMate format and new ApiSlip format
      const transDate = tx.date || ''
      const transTime = transDate ? transDate.split('T')[1]?.replace(/\.\d+Z$/, '') || '' : ''
      
      return NextResponse.json({
        success: true,
        verified: true,
        data: {
          // Core fields (used by frontend)
          amount: tx.amount,
          transRef: tx.refId,
          transDate: transDate.split('T')[0]?.replace(/-/g, '') || transDate.split('T')[0] || '', // YYYYMMDD or YYYY-MM-DD
          transTime: transTime,
          transDateTime: transDate,
          date: transDate,
          
          // Sender info
          sender: {
            name: tx.sender?.name || '',
            displayName: tx.sender?.name || '',
            account: {
              value: tx.sender?.account || '',
            },
          },
          sendingBank: tx.sender?.bank || '',
          sendingBankName: tx.sender?.bank || '',
          
          // Receiver info
          receiver: {
            name: tx.receiver?.name || '',
            displayName: tx.receiver?.name || '',
            account: {
              value: tx.receiver?.account || '',
            },
          },
          receivingBank: tx.receiver?.bank || '',
          receivingBankName: tx.receiver?.bank || '',
          
          // Additional fields
          transFeeAmount: tx.transFeeAmount || 0,
          currency: tx.currency || 'THB',
          
          // Keep raw data for debugging
          _raw: data,
        },
      })
    } else {
      // Verification failed (not_found, fraud, amount_mismatch, etc.)
      return NextResponse.json({
        success: false,
        verified: false,
        error: data.message || `Verification failed: ${data.status}`,
        status: data.status,
        isAuthentic: data.isAuthentic,
        data: data,
      }, { status: 200 })
    }
  } catch (error) {
    console.error('[verify-slip] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
