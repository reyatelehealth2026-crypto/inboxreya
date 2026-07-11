import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { Jimp } from 'jimp'
import jsQR from 'jsqr'

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

async function readJsonResponse(response: Response) {
  const text = await response.text()
  if (!text) return null

  try {
    return JSON.parse(text)
  } catch {
    return { message: text }
  }
}

/**
 * Decode the bank-transfer / PromptPay QR embedded in a slip image.
 * GhostX verifies from the QR payload (not the image), so we read it here
 * server-side (mirrors what the GhostX web UI does client-side with jsQR).
 */
async function decodeQrFromImageUrl(imageUrl: string): Promise<string | null> {
  const res = await fetch(imageUrl)
  if (!res.ok) return null

  const buf = Buffer.from(await res.arrayBuffer())
  const image = await Jimp.read(buf)
  const { data, width, height } = image.bitmap
  const pixels = new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength)
  const code = jsQR(pixels, width, height)
  return code?.data ?? null
}

/**
 * Map a GhostX /qr/scan success payload to the internal transaction shape
 * (same fields the Thunder path produced, so the frontend contract is unchanged).
 * GhostX: { type, slipVerification: { transfer: { transactionRef, transactionDateTime,
 *          fromBankName, fromAccountNo, fromAccountName, toBankName, toAccountNo,
 *          toAccountName, amount: { amount, currency: { code, symbol } } } } }
 */
function normalizeGhostxTransaction(payload: any) {
  const t = payload?.slipVerification?.transfer || {}

  return {
    amount: t.amount?.amount,
    refId: t.transactionRef || '',
    date: t.transactionDateTime || '',
    sender: {
      name: t.fromAccountName || '',
      bank: t.fromBankName || '',
      bankName: t.fromBankName || '',
      account: t.fromAccountNo || '',
    },
    receiver: {
      name: t.toAccountName || '',
      bank: t.toBankName || '',
      bankName: t.toBankName || '',
      account: t.toAccountNo || '',
    },
    currency: t.amount?.currency?.code || 'THB',
    transFeeAmount: 0,
  }
}

/**
 * POST /api/inbox/verify-slip
 *
 * Verify a payment slip image via GhostX API (QR-based, IP-whitelisted, no token).
 * Flow: read the QR from the slip image → POST { qrData } to GhostX → map the result
 * back to the existing frontend contract. Proxied server-side.
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

    // 1) Read the QR payload from the slip image (GhostX needs the QR, not the image).
    let qrData: string | null = null
    try {
      qrData = await decodeQrFromImageUrl(imageUrl)
    } catch {
      qrData = null
    }

    if (!qrData) {
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: 'อ่าน QR จากสลิปไม่สำเร็จ กรุณาส่งรูปสลิปที่ชัดและเห็น QR เต็ม',
        },
        { status: 200 }
      )
    }

    // 2) Verify via GhostX (IP-whitelisted, no token required).
    const apiBaseUrl = (process.env.GHOSTX_API_BASE_URL || 'https://externalauth.ghostxapi.xyz').replace(/\/$/, '')
    const ghostxRes = await fetch(`${apiBaseUrl}/qr/scan`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ qrData }),
    })

    const ghostxData = await readJsonResponse(ghostxRes)
    const transfer = ghostxData?.slipVerification?.transfer

    if (!ghostxRes.ok || !transfer) {
      // GhostX returned an error (invalid QR, no permission, etc.).
      // Keep 200 so the frontend can handle it gracefully.
      return NextResponse.json(
        {
          success: false,
          verified: false,
          error: ghostxData?.message || ghostxData?.title || `GhostX API error (${ghostxRes.status})`,
          status: ghostxData?.code,
          statusCode: ghostxRes.status,
        },
        { status: 200 }
      )
    }

    // 3) Map GhostX → the existing frontend contract (unchanged shape).
    const tx = normalizeGhostxTransaction(ghostxData)
    const transDate = tx.date || ''
    const transTime = transDate
      ? transDate.split('T')[1]?.replace(/(\+\d{2}:\d{2}|Z)$/, '').replace(/\.\d+$/, '') || ''
      : ''

    // Validate receiver account / name against the company account.
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

    // Strip the GhostX contact block from the debug payload.
    const rawForDebug: Record<string, unknown> = { ...ghostxData }
    delete rawForDebug.contact

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
        sendingBankName: tx.sender?.bankName || tx.sender?.bank || '',

        // Receiver info
        receiver: {
          name: tx.receiver?.name || '',
          displayName: tx.receiver?.name || '',
          account: {
            value: tx.receiver?.account || '',
          },
        },
        receivingBank: tx.receiver?.bank || '',
        receivingBankName: tx.receiver?.bankName || tx.receiver?.bank || '',

        // Additional fields
        transFeeAmount: tx.transFeeAmount || 0,
        currency: tx.currency || 'THB',

        // Keep raw data for debugging (contact stripped)
        _raw: rawForDebug,
      },
    })
  } catch (error) {
    console.error('[verify-slip] Error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
