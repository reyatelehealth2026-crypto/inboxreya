import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

function normalizeAccountDigits(value: string) {
  return (value || '').replace(/\D/g, '')
}

function isReceiverAccountMatch(actualAccount: string, expectedAccount: string) {
  if (!actualAccount || !expectedAccount) return actualAccount === expectedAccount

  const actualDigits = normalizeAccountDigits(actualAccount)
  const expectedDigits = normalizeAccountDigits(expectedAccount)

  if (!actualDigits || !expectedDigits) return actualAccount === expectedAccount
  if (actualDigits === expectedDigits) return true

  const looksMasked = /[xX*]/.test(actualAccount)
  if (looksMasked && actualDigits.length >= 4) {
    return expectedDigits.includes(actualDigits)
  }

  return false
}

function canonicalizeCompanyName(value: string) {
  return (value || '')
    .toLowerCase()
    .normalize('NFKC')
    .replace(/[()\[\]{}.,:/\\\-]+/g, ' ')
    .replace(/&/g, ' และ ')
    .replace(/\bco\b/g, ' ')
    .replace(/\bltd\b/g, ' ')
    .replace(/\blimited\b/g, ' ')
    .replace(/\bcompany\b/g, ' ')
    .replace(/บริษัท/g, ' ')
    .replace(/บจก/g, ' ')
    .replace(/บมจ/g, ' ')
    .replace(/หจก/g, ' ')
    .replace(/จำกัด/g, ' ')
    .replace(/จํากัด/g, ' ')
    .replace(/มหาชน/g, ' ')
    .replace(/health\s*care/g, ' healthcare ')
    .replace(/เฮลท์\s*แคร์/g, ' healthcare ')
    .replace(/ซี\s*เอ็น\s*วาย/g, ' cny ')
    .replace(/ซี\s*เอน\s*วาย/g, ' cny ')
    .replace(/c\s*n\s*y/g, ' cny ')
    .replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isReceiverNameMatch(actualName: string, expectedName: string) {
  if (!actualName || !expectedName) return actualName === expectedName

  const actualCanonical = canonicalizeCompanyName(actualName)
  const expectedCanonical = canonicalizeCompanyName(expectedName)

  if (!actualCanonical || !expectedCanonical) return actualCanonical === expectedCanonical
  if (actualCanonical === expectedCanonical) return true

  const actualJoined = actualCanonical.replace(/\s+/g, '')
  const expectedJoined = expectedCanonical.replace(/\s+/g, '')
  if (actualJoined === expectedJoined) return true
  if (actualJoined.includes(expectedJoined) || expectedJoined.includes(actualJoined)) return true

  const actualTokens = actualCanonical.split(' ').filter(Boolean)
  const expectedTokens = expectedCanonical.split(' ').filter(Boolean)
  const expectedTokenSet = new Set(expectedTokens)
  const actualTokenSet = new Set(actualTokens)

  const receiverIsMeaningfulSubset = actualTokens.length > 0 && actualTokens.every((token) => expectedTokenSet.has(token))
  const expectedIsMeaningfulSubset = expectedTokens.length > 0 && expectedTokens.every((token) => actualTokenSet.has(token))

  if (receiverIsMeaningfulSubset || expectedIsMeaningfulSubset) return true

  return false
}

function buildIdempotencyKey(imageUrl: string) {
  return `inboxreya-slip-${crypto.createHash('sha256').update(imageUrl).digest('hex')}`
}

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

function normalizeHaveSlipTransaction(data: any) {
  const result = data?.result || {}
  const tx = result?.transactionData || {}

  return {
    amount: tx.amount,
    refId: tx.refId || tx.referenceId || tx.transactionId || data?.uuid || '',
    date: tx.transactionDate || tx.date || data?.completedAt || data?.createdAt || '',
    sender: {
      name: tx.sender?.name || '',
      bank: tx.sender?.bank || '',
      account: tx.sender?.account || tx.sender?.accountNumber || '',
    },
    receiver: {
      name: tx.receiver?.name || '',
      bank: tx.receiver?.bank || '',
      account: tx.receiver?.account || tx.receiver?.accountNumber || '',
    },
    currency: tx.currency || 'THB',
    transFeeAmount: tx.transFeeAmount || 0,
  }
}

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip image via HaveSLIP API.
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

    const apiKey = process.env.HAVESLIP_API_KEY
    if (!apiKey) {
      return NextResponse.json(
        { error: 'HaveSLIP API key not configured (HAVESLIP_API_KEY)' },
        { status: 500 }
      )
    }

    const apiBaseUrl = (process.env.HAVESLIP_API_BASE_URL || 'https://api.haveslip.com/api').replace(/\/$/, '')
    const haveSlipRes = await fetch(`${apiBaseUrl}/verify`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': buildIdempotencyKey(imageUrl),
      },
      body: JSON.stringify({
        inputType: 'image',
        imageUrl,
        mode: 'sync',
        forceRefresh: false,
      }),
    })

    const haveSlipData = await readJsonResponse(haveSlipRes)

    if (!haveSlipRes.ok) {
      // HaveSLIP returned an error. Keep 200 so the frontend can handle gracefully.
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: haveSlipData?.message || haveSlipData?.error || `HaveSLIP API error (${haveSlipRes.status})`,
          statusCode: haveSlipRes.status,
        },
        { status: 200 }
      )
    }

    // Parse HaveSLIP response format to match frontend expectations.
    // HaveSLIP: { success, data: { status, result: { valid, transactionData } } }
    // Frontend expects: { success, verified, data: { amount, transRef, sender, receiver, ... } }
    
    const { data } = haveSlipData || {}
    const tx = normalizeHaveSlipTransaction(data)
    
    if (haveSlipData?.success === true && data?.status === 'completed' && data?.result?.valid === true) {
      // Build response compatible with the existing frontend contract.
      const transDate = tx.date || ''
      const transTime = transDate ? transDate.split('T')[1]?.replace(/\.\d+Z$/, '') || '' : ''
      
      // Validate receiver account
      const EXPECTED_RECEIVER_ACCOUNT = process.env.EXPECTED_RECEIVER_ACCOUNT || '068-3-84622-8'
      const EXPECTED_RECEIVER_NAME = process.env.EXPECTED_RECEIVER_NAME || 'บริษัท ซี เอ็น วาย เฮลท์แคร์ จำกัด'
      
      const warnings: Array<{ type: string; message: string }> = []
      
      const receiverAccount = tx.receiver?.account || ''
      const receiverName = tx.receiver?.name || ''
      const receiverAccountMatches = isReceiverAccountMatch(receiverAccount, EXPECTED_RECEIVER_ACCOUNT)
      const receiverNameMatches = isReceiverNameMatch(receiverName, EXPECTED_RECEIVER_NAME)
      
      if (receiverAccount && !receiverAccountMatches) {
        warnings.push({
          type: 'receiver_account_mismatch',
          message: `⚠️ บัญชีผู้รับอาจไม่ตรงกับบริษัท\nพบ: ${receiverAccount}\nคาดหวัง: ${EXPECTED_RECEIVER_ACCOUNT}`,
        })
      }
      
      if (receiverName && !receiverNameMatches) {
        warnings.push({
          type: 'receiver_name_mismatch',
          message: `⚠️ ชื่อผู้รับอาจไม่ตรงกับบริษัท\nพบ: ${receiverName}\nคาดหวัง: ${EXPECTED_RECEIVER_NAME}`,
        })
      }
      
      return NextResponse.json({
        success: true,
        verified: true,
        warnings, // คำเตือนถ้ามี
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
        error: data?.result?.message || data?.error || `Verification failed: ${data?.status || 'unknown'}`,
        status: data?.status,
        isAuthentic: data?.result?.valid === true,
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
